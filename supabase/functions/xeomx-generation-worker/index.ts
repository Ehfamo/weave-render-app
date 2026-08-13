import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const CF_DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
  return createClient(url, secrets['default'], { auth: { persistSession: false, autoRefreshToken: false } })
}

async function authorized(req: Request) {
  const token = req.headers.get('x-xeomx-worker-token')
  if (!token) return false
  const admin = createAdmin()
  const result = await admin.rpc('xeomx_validate_worker_token', { p_token: token })
  return !result.error && result.data === true
}

async function processOne() {
  const admin = createAdmin()
  const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN')
  const cfAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
  if (!cfToken || !cfAccount) throw new Error('CLOUDFLARE_CONFIG_MISSING')

  const queued = await admin.from('generation_jobs')
    .select('id,user_id,project_id,conversation_id,input_message_id,selected_provider,selected_model,status')
    .eq('status','queued').order('queued_at',{ascending:true}).limit(1)
  if (queued.error) throw queued.error
  const job = queued.data?.[0]
  if (!job) return {processed:false, reason:'no_queued_job'}

  const started = await admin.rpc('xeomx_start_generation_job',{p_job_id:job.id})
  if (started.error || started.data !== true) return {processed:false, reason:'claim_lost'}

  try {
    const msg = await admin.from('messages').select('content').eq('id',job.input_message_id).single()
    if (msg.error) throw msg.error
    if ((job.selected_provider || 'cloudflare') !== 'cloudflare') throw new Error(`PROVIDER_UNAVAILABLE:${job.selected_provider}`)
    const model = job.selected_model || CF_DEFAULT_MODEL
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAccount)}/ai/run/${model}`
    const r = await fetch(endpoint, {
      method:'POST',
      headers:{Authorization:`Bearer ${cfToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        messages:[
          {role:'system',content:'You are the XEOMX text generation provider. Follow the user instruction precisely and return only the requested answer.'},
          {role:'user',content:msg.data.content}
        ],
        max_tokens:128,
        temperature:0
      })
    })
    const body = await r.json().catch(()=>({}))
    if (!r.ok || body?.success === false) {
      const err = body?.errors?.[0]
      throw new Error(`cloudflare:${r.status}:${err?.code ?? 'error'}:${err?.message ?? 'request_failed'}`)
    }
    const raw = body?.result?.response ?? body?.result?.choices?.[0]?.message?.content ?? body?.result?.text ?? ''
    const text = Array.isArray(raw)
      ? raw.map((x:any)=>typeof x==='string'?x:(x?.text ?? x?.content ?? '')).join('').trim()
      : String(raw ?? '').trim()
    if (!text) throw new Error('cloudflare:empty_output')

    const usage = body?.result?.usage ?? body?.usage ?? null
    const providerRequestId = r.headers.get('cf-ray') ?? r.headers.get('x-request-id') ?? body?.result?.id ?? null
    const completed = await admin.rpc('xeomx_complete_generation_job',{
      p_job_id:job.id,
      p_output_text:text,
      p_provider_request_identifier:providerRequestId,
      p_input_units:usage?.prompt_tokens ?? usage?.input_tokens ?? null,
      p_output_units:usage?.completion_tokens ?? usage?.output_tokens ?? null,
      p_estimated_cost_microunits:null,
      p_actual_cost_microunits:0,
      p_actual_credit_units:1,
      p_usage_unavailable:!usage,
      p_finish_reason:'stop'
    })
    if (completed.error) throw completed.error
    console.log('xeomx-worker-success', JSON.stringify({job_id:job.id,provider:'cloudflare',model,output_present:true}))
    return {processed:true,provider:'cloudflare',model}
  } catch (e) {
    const message=e instanceof Error?e.message.slice(0,300):String(e).slice(0,300)
    await admin.rpc('xeomx_fail_generation_job',{
      p_job_id:job.id,
      p_error_category:message.startsWith('PROVIDER_UNAVAILABLE')?'PROVIDER_UNAVAILABLE':'GENERATION_FAILED',
      p_safe_error_message:message,
      p_provider_request_identifier:null
    })
    console.error('xeomx-worker-failed', JSON.stringify({job_id:job.id,error:message}))
    throw e
  }
}

Deno.serve(async(req)=>{
  if (!(await authorized(req))) {
    return Response.json({accepted:false,error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}})
  }
  // @ts-ignore Supabase Edge Runtime global.
  EdgeRuntime.waitUntil(processOne().catch(()=>{}))
  return Response.json({accepted:true},{status:202,headers:{'Cache-Control':'no-store'}})
})
