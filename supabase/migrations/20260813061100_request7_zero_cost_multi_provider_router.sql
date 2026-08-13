-- Request 7 zero-cost multi-provider routing and durable fallback bookkeeping.
-- Auto routing starts with Cloudflare and may fall back to Gemini then Groq.
-- Manual routing stays exact and never crosses providers.

CREATE OR REPLACE FUNCTION public.xeomx_submit_generation_job(
  p_project_id UUID,
  p_conversation_id UUID,
  p_prompt TEXT,
  p_routing_mode TEXT,
  p_requested_provider TEXT,
  p_requested_model TEXT,
  p_idempotency_key TEXT,
  p_request_hash TEXT
)
RETURNS TABLE (job_id UUID, conversation_id UUID, created BOOLEAN, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_selected_provider TEXT;
  v_selected_model TEXT;
  v_max_attempts INTEGER;
  v_submission RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;

  IF p_routing_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ROUTING_MODE';
  END IF;

  IF p_routing_mode = 'manual' THEN
    IF p_requested_provider NOT IN ('cloudflare', 'gemini', 'groq') THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_UNAVAILABLE';
    END IF;

    IF NOT (
      (p_requested_provider = 'cloudflare' AND p_requested_model = '@cf/meta/llama-3.1-8b-instruct-fast') OR
      (p_requested_provider = 'gemini' AND p_requested_model = 'gemini-3.5-flash') OR
      (p_requested_provider = 'groq' AND p_requested_model = 'llama-3.1-8b-instant')
    ) THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_MODEL_UNAVAILABLE';
    END IF;

    v_selected_provider := p_requested_provider;
    v_selected_model := p_requested_model;
    v_max_attempts := 1;
  ELSE
    v_selected_provider := 'cloudflare';
    v_selected_model := '@cf/meta/llama-3.1-8b-instruct-fast';
    v_max_attempts := 3;
  END IF;

  SELECT * INTO v_submission
  FROM public.xeomx_create_generation_job(
    v_actor_id,
    p_project_id,
    p_conversation_id,
    p_prompt,
    p_routing_mode,
    p_requested_provider,
    p_requested_model,
    v_selected_provider,
    v_selected_model,
    p_idempotency_key,
    p_request_hash,
    5::BIGINT
  );

  IF v_submission.created THEN
    UPDATE public.generation_jobs
    SET
      max_attempts = v_max_attempts,
      request_metadata = COALESCE(request_metadata, '{}'::jsonb) || jsonb_build_object(
        'router', 'zero-cost-v1',
        'fallback_order', CASE
          WHEN p_routing_mode = 'auto'
            THEN jsonb_build_array('cloudflare', 'gemini', 'groq')
          ELSE jsonb_build_array(v_selected_provider)
        END
      )
    WHERE id = v_submission.job_id;
  END IF;

  RETURN QUERY
  SELECT
    v_submission.job_id::UUID,
    v_submission.conversation_id::UUID,
    v_submission.created::BOOLEAN,
    v_submission.status::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_submit_generation_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_submit_generation_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
TO authenticated;

CREATE OR REPLACE FUNCTION public.xeomx_begin_provider_fallback(
  p_job_id UUID,
  p_provider TEXT,
  p_model TEXT,
  p_error_category TEXT,
  p_safe_error_message TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
  v_next_attempt INTEGER;
  v_previous_request_id UUID;
BEGIN
  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_JOB_NOT_FOUND';
  END IF;

  IF v_job.status <> 'running' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_INVALID_JOB_STATE';
  END IF;

  IF v_job.routing_mode <> 'auto' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FALLBACK_NOT_ALLOWED';
  END IF;

  IF v_job.attempt_count >= v_job.max_attempts THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_MAX_ATTEMPTS_REACHED';
  END IF;

  IF NOT (
    (p_provider = 'cloudflare' AND p_model = '@cf/meta/llama-3.1-8b-instruct-fast') OR
    (p_provider = 'gemini' AND p_model = 'gemini-3.5-flash') OR
    (p_provider = 'groq' AND p_model = 'llama-3.1-8b-instant')
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_ROUTE_INVALID';
  END IF;

  UPDATE public.provider_requests
  SET
    status = CASE
      WHEN left(COALESCE(p_error_category, 'GENERATION_FAILED'), 100) = 'PROVIDER_UNAVAILABLE'
        THEN 'unavailable'
      ELSE 'failed'
    END,
    error_category = left(COALESCE(p_error_category, 'GENERATION_FAILED'), 100),
    response_metadata = COALESCE(response_metadata, '{}'::jsonb) || jsonb_build_object(
      'fallback', true,
      'safe_error', left(COALESCE(p_safe_error_message, 'provider attempt failed'), 300)
    ),
    completed_at = now()
  WHERE job_id = p_job_id AND attempt = v_job.attempt_count
  RETURNING id INTO v_previous_request_id;

  IF v_previous_request_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_ATTEMPT_MISSING';
  END IF;

  v_next_attempt := v_job.attempt_count + 1;

  UPDATE public.generation_jobs
  SET
    attempt_count = v_next_attempt,
    selected_provider = p_provider,
    selected_model = p_model,
    request_metadata = COALESCE(request_metadata, '{}'::jsonb) || jsonb_build_object(
      'fallback_count', v_next_attempt - 1,
      'last_fallback_reason', left(COALESCE(p_error_category, 'GENERATION_FAILED'), 100)
    )
  WHERE id = p_job_id;

  INSERT INTO public.provider_requests (
    job_id,
    user_id,
    provider,
    model,
    attempt,
    status,
    request_metadata,
    started_at
  ) VALUES (
    v_job.id,
    v_job.user_id,
    p_provider,
    p_model,
    v_next_attempt,
    'running',
    jsonb_build_object(
      'capability', 'text-generation',
      'routing_mode', 'auto',
      'fallback_from_provider', v_job.selected_provider,
      'fallback_from_model', v_job.selected_model
    ),
    now()
  );

  INSERT INTO public.audit_events (
    actor_id,
    project_id,
    job_id,
    event_type,
    target_type,
    target_id,
    result,
    error_category,
    metadata
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    'provider.fallback',
    'provider_request',
    v_previous_request_id,
    'submitted',
    left(COALESCE(p_error_category, 'GENERATION_FAILED'), 100),
    jsonb_build_object(
      'from_provider', v_job.selected_provider,
      'from_model', v_job.selected_model,
      'to_provider', p_provider,
      'to_model', p_model,
      'attempt', v_next_attempt
    )
  );

  RETURN v_next_attempt;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_begin_provider_fallback(UUID, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_begin_provider_fallback(UUID, TEXT, TEXT, TEXT, TEXT)
TO service_role;
