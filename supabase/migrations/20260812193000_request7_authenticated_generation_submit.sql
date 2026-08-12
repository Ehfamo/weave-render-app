-- Authenticated browser-facing submission wrapper for the Request 7 durable worker.
-- The provider, model and reservation are intentionally server-controlled so a
-- browser cannot spoof routing or credit reservations.
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
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;

  IF p_routing_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ROUTING_MODE';
  END IF;

  IF p_routing_mode = 'manual' THEN
    IF p_requested_provider IS DISTINCT FROM 'cloudflare' THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_UNAVAILABLE';
    END IF;
    IF p_requested_model IS DISTINCT FROM '@cf/meta/llama-3.1-8b-instruct-fast' THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_MODEL_UNAVAILABLE';
    END IF;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.xeomx_create_generation_job(
    v_actor_id,
    p_project_id,
    p_conversation_id,
    p_prompt,
    p_routing_mode,
    p_requested_provider,
    p_requested_model,
    'cloudflare',
    '@cf/meta/llama-3.1-8b-instruct-fast',
    p_idempotency_key,
    p_request_hash,
    5::BIGINT
  );
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_submit_generation_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_submit_generation_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
TO authenticated;
