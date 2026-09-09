-- Reject nullable routing mode rather than treating SQL NULL as an implicit auto route.
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

  IF p_routing_mode IS NULL OR p_routing_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ROUTING_MODE';
  END IF;

  IF p_routing_mode = 'manual' THEN
    IF p_requested_provider IS NULL
       OR p_requested_provider NOT IN ('cloudflare', 'gemini', 'groq') THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_UNAVAILABLE';
    END IF;

    IF p_requested_model IS NULL OR NOT (
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
