import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryService } from "../src/lib/memory/service.ts";
import { NativeMemoryAdapter } from "../src/lib/memory/native-adapter.ts";
const migrations=new URL("../supabase/migrations/",import.meta.url);
const read=name=>readFile(new URL(name,migrations),"utf8");
const a="10000000-0000-4000-8000-000000000001",b="10000000-0000-4000-8000-000000000002",viewer="10000000-0000-4000-8000-000000000003";
const goal=text=>[{id:"goal",kind:"goal",text,resolved:false}];
const hash="a".repeat(64);

test("FI2 SQL source migration and canonical RPCs enforce real PostgreSQL persistence and RLS",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"xeomx-fi2-sql-"));let db=new PGlite(dir);
  t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});
  const scalar=async(sql,params=[])=>{const r=await db.query(sql,params);return Object.values(r.rows[0]??{})[0];};
  const actor=async(id)=>{await db.exec("RESET ROLE");await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??""]);await db.exec(id?"SET ROLE authenticated":"SET ROLE anon");};
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
  const initial=await read("20260621060717_f63c7e99-8137-4c9b-8dcc-6f9f64d46285.sql");
  const timestampFunction=initial.match(/CREATE OR REPLACE FUNCTION public\.set_updated_at\(\)[\s\S]*?\$\$;/)?.[0];assert.ok(timestampFunction);await db.exec(timestampFunction);
  const base=await read("20260811000000_request_7_backend_vertical_slice.sql");
  // Exact canonical project/conversation/message schema, triggers, membership helper and RLS.
  // Storage bucket setup and unrelated generation RPCs are outside this database fixture.
  const storageAt=base.indexOf("INSERT INTO storage.buckets");assert.ok(storageAt>0);
  await db.exec(base.slice(0,storageAt)+"\nCOMMIT;");
  const createAt=base.indexOf("CREATE OR REPLACE FUNCTION public.xeomx_create_project(");
  await db.exec(base.slice(createAt,base.indexOf("CREATE OR REPLACE FUNCTION public.xeomx_credit_balance",createAt)));
  await db.exec(await read("20260814200500_stage53_project_membership_acl_hardening.sql"));
  await db.exec(await read("20260912000000_p1_memory_core.sql"));
  await db.query("INSERT INTO auth.users(id) VALUES ($1),($2),($3)",[a,b,viewer]);
  await actor(a);const pa=(await db.query("SELECT * FROM public.xeomx_create_project($1,$2)",["Campaign A",null])).rows[0].id;
  const p2=(await db.query("SELECT * FROM public.xeomx_create_project($1,$2)",["Campaign A2",null])).rows[0].id;
  await actor(b);const pb=(await db.query("SELECT * FROM public.xeomx_create_project($1,$2)",["Campaign B",null])).rows[0].id;
  await db.exec("RESET ROLE");
  // Pre-existing owner Brain document is migrated without deleting/reclassifying private memories.
  await db.query("INSERT INTO public.xeomx_memories(user_id,project_id,type,content,importance,source) VALUES ($1,$2,'ProjectMemory',$3,1,$4)",[a,pa,JSON.stringify({format:"xeomx.project-brain.v1",entries:goal("Preserved legacy project goal")}),JSON.stringify({kind:"user",reference:"xeomx.project-brain.v1"})]);
  await db.exec(await read("20260915115854_fi2_project_brain_and_execution_continuity.sql"));
  await db.query("INSERT INTO public.project_members(project_id,user_id,role) VALUES ($1,$2,'editor'),($1,$3,'viewer')",[pa,b,viewer]);
  let cid;
  await t.test("create/list/open stable projects and private Brain enforce authorization and CAS",async()=>{
    await actor(a);assert.deepEqual((await db.query("SELECT id FROM public.projects ORDER BY id")).rows.map(r=>r.id),[pa,p2].sort());
    assert.deepEqual(await scalar("SELECT brain_entries FROM public.projects WHERE id=$1",[pa]),goal("Preserved legacy project goal"));
    await db.query("SELECT public.xeomx_put_project_brain($1,$2,$3)",[pa,goal("Durable new goal"),goal("Preserved legacy project goal")]);
    await assert.rejects(db.query("SELECT public.xeomx_put_project_brain($1,$2,$3)",[pa,goal("Stale write"),[]]),/BRAIN_CONFLICT/);
    await assert.rejects(db.query("SELECT public.xeomx_put_project_brain($1,$2,$3)",[pb,goal("Unauthorized"),[]]),/PROJECT_ACCESS_DENIED/);
    await assert.rejects(db.query("UPDATE public.projects SET brain_entries=$1 WHERE id=$2",[goal("Direct bypass"),pa]),/permission denied/);
    await actor(viewer);await assert.rejects(db.query("SELECT public.xeomx_put_project_brain($1,$2,$3)",[pa,goal("Viewer write"),goal("Durable new goal")]),/PROJECT_ACCESS_DENIED/);
    await actor(a);assert.equal(await scalar("SELECT count(*)::int FROM public.projects WHERE id=$1",[pb]),0);
    await assert.rejects(db.query("INSERT INTO public.project_members(project_id,user_id,role) VALUES ($1,$2,'owner')",[pb,a]),/permission denied/);
  });
  await t.test("Memory OFF and disabled types stop automatic memory behavior while durable Brain remains editable",async()=>{
    await actor(a);
    const rpc={rpc:async(_name,{operation,payload})=>{try{return {data:await scalar("SELECT public.xeomx_memory($1,$2)",[operation,payload]),error:null};}catch(error){return {data:null,error};}}};
    const memory=new MemoryService(new NativeMemoryAdapter(a,rpc));const scope={kind:"project",projectId:pa};
    await memory.setSettings({enabled:true,disabledTypes:[]});const r=await memory.create({type:"ProjectMemory",scope,content:"Optional long term note",importance:1,source:{kind:"user"}});
    await memory.setSettings({enabled:false,disabledTypes:[]});assert.equal((await memory.relevant({scope})).length,0);assert.equal((await memory.get(r.id)).content,"Optional long term note");
    await assert.rejects(memory.create({type:"ProjectMemory",scope,content:"blocked",importance:1,source:{kind:"user"}}),/MEMORY_DISABLED/);
    await assert.rejects(db.query("SELECT public.xeomx_memory('create',$1)",[{type:"ProjectMemory",scope,content:"Direct blocked write",importance:1,source:{kind:"user"}}]),/row-level security/);
    await db.query("SELECT public.xeomx_put_project_brain($1,$2,$3)",[pa,goal("Edited with Memory OFF"),goal("Durable new goal")]);
    assert.deepEqual(await scalar("SELECT brain_entries FROM public.projects WHERE id=$1",[pa]),goal("Edited with Memory OFF"));
    await memory.setSettings({enabled:true,disabledTypes:["ProjectMemory"]});assert.equal((await memory.relevant({scope})).length,0);
    await memory.update(r.id,{content:"Edited through canonical adapter"});await memory.archive(r.id);assert.equal((await memory.get(r.id)).status,"archived");await memory.delete(r.id);assert.equal(await memory.get(r.id),null);
  });
  await t.test("core execution persists messages once, replays exact completion, and keeps project goal",async()=>{
    await actor(a);cid=crypto.randomUUID();const key=crypto.randomUUID();
    const begin=(id=cid,k=key,p=pa,h=hash)=>scalar("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)",[p,id,null,"Research launch",k,h]);
    assert.deepEqual(await begin(),{created:true,conversationId:cid});assert.deepEqual(await begin(crypto.randomUUID()),{created:false,conversationId:cid});
    await assert.rejects(begin(crypto.randomUUID(),key,pa,"b".repeat(64)),/IDEMPOTENCY_CONFLICT/);
    const response={ok:true,data:{executionId:cid,conversationId:cid,goal:"Research launch",state:"COMPLETED",output:"Private persisted assistant output",quality:{confidence:"NOT_INDEPENDENTLY_VERIFIED",findings:[],repairCount:0},nextAction:"RETURN_TO_GOAL"}};
    await db.query("SELECT public.xeomx_finish_core_execution($1,$2)",[cid,response]);await db.query("SELECT public.xeomx_finish_core_execution($1,$2)",[cid,response]);
    assert.equal(await scalar("SELECT count(*)::int FROM public.messages WHERE conversation_id=$1",[cid]),2);
    const replay=await begin(crypto.randomUUID());assert.deepEqual(replay.response,response);
    const stored=await scalar("SELECT core_execution FROM public.conversations WHERE id=$1",[cid]);assert.equal(stored.response.data.output,undefined);assert.equal(stored.response.data.goal,undefined);
    assert.deepEqual(await scalar("SELECT brain_entries FROM public.projects WHERE id=$1",[pa]),goal("Edited with Memory OFF"));
    const next=crypto.randomUUID();const continued=await scalar("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)",[pa,next,cid,"Keep everything else; change heading",crypto.randomUUID(),hash]);assert.equal(continued.created,true);
    assert.equal(await scalar("SELECT core_execution->>'previousConversationId' FROM public.conversations WHERE id=$1",[next]),cid);
    await assert.rejects(scalar("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)",[p2,crypto.randomUUID(),cid,"Wrong project",crypto.randomUUID(),hash]),/CONVERSATION_ACCESS_DENIED/);
  });
  await t.test("same-project editors cannot read, reparent, impersonate or finish another actor's execution",async()=>{
    await actor(b);assert.equal(await scalar("SELECT count(*)::int FROM public.conversations WHERE id=$1",[cid]),0);
    assert.equal(await scalar("SELECT count(*)::int FROM public.messages WHERE conversation_id=$1",[cid]),0);
    await assert.rejects(db.query("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)",[pa,crypto.randomUUID(),cid,"Wrong actor",crypto.randomUUID(),hash]),/CONVERSATION_ACCESS_DENIED/);
    await assert.rejects(db.query("SELECT public.xeomx_finish_core_execution($1,$2)",[cid,{ok:false,data:{executionId:cid,state:"FAILED"}}]),/PROJECT_ACCESS_DENIED/);
    assert.equal(await scalar("SELECT count(*)::int FROM public.xeomx_memories WHERE project_id=$1",[pa]),0);
    await actor(a);await assert.rejects(db.query("UPDATE public.conversations SET created_by=$1 WHERE id=$2",[b,cid]),/IMMUTABLE_CONVERSATION_IDENTITY/);
    await assert.rejects(db.query("UPDATE public.conversations SET project_id=$1 WHERE id=$2",[p2,cid]),/IMMUTABLE_CONVERSATION_IDENTITY/);
    await assert.rejects(db.query("UPDATE public.conversations SET core_execution='{}' WHERE id=$1",[cid]),/CONTROLLED_EXECUTION_REQUIRED/);
    await assert.rejects(db.query("INSERT INTO public.conversations(project_id,created_by,title,core_execution) VALUES ($1,$2,'Forged',$3)",[pa,a,{key:"forged-key-123456"}]),/CONTROLLED_EXECUTION_REQUIRED/);
    await actor(viewer);await assert.rejects(db.query("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)",[pa,crypto.randomUUID(),null,"Viewer cannot execute",crypto.randomUUID(),hash]),/PROJECT_ACCESS_DENIED/);
    await actor(null);await assert.rejects(db.query("SELECT public.xeomx_put_project_brain($1,$2,$3)",[pa,goal("Anonymous"),[]]),/permission denied/);
  });
  await t.test("project identity, goal and continuation survive closing and reopening the actual database",async()=>{
    await db.close();db=new PGlite(dir);await actor(a);
    assert.deepEqual(await scalar("SELECT brain_entries FROM public.projects WHERE id=$1",[pa]),goal("Edited with Memory OFF"));
    assert.equal(await scalar("SELECT content FROM public.messages WHERE conversation_id=$1 AND role='assistant'",[cid]),"Private persisted assistant output");
    assert.equal(await scalar("SELECT core_execution->>'state' FROM public.conversations WHERE id=$1",[cid]),"COMPLETED");
    assert.ok(await scalar("SELECT updated_at FROM public.projects WHERE id=$1",[pa]));
  });
});
