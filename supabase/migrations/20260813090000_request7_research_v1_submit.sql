CREATE OR REPLACE FUNCTION public.xeomx_submit_research_job(
  p_project_id UUID,
  p_conversation_id UUID,
  p_question TEXT,
  p_sources JSONB,
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
  v_submission RECORD;
  v_source_count INTEGER;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;

  IF char_length(btrim(p_question)) NOT BETWEEN 3 AND 50000 THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_RESEARCH_QUESTION';
  END IF;

  IF p_sources IS NULL OR jsonb_typeof(p_sources) <> 'array' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_RESEARCH_SOURCES';
  END IF;

  v_source_count := jsonb_array_length(p_sources);
  IF v_source_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_RESEARCH_SOURCES';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_sources) AS source(value)
    WHERE jsonb_typeof(source.value) <> 'object'
      OR COALESCE(source.value->>'url', '') !~ '^https://'
      OR char_length(COALESCE(source.value->>'url', '')) NOT BETWEEN 9 AND 2048
      OR char_length(COALESCE(source.value->>'title', '')) NOT BETWEEN 1 AND 300
      OR char_length(COALESCE(source.value->>'excerpt', '')) NOT BETWEEN 1 AND 6000
      OR char_length(COALESCE(source.value->>'domain', '')) NOT BETWEEN 1 AND 253
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_RESEARCH_SOURCES';
  END IF;

  SELECT * INTO v_submission
  FROM public.xeomx_submit_generation_job(
    p_project_id,
    p_conversation_id,
    btrim(p_question),
    'auto',
    NULL,
    NULL,
    p_idempotency_key,
    p_request_hash
  );

  IF v_submission.created THEN
    UPDATE public.generation_jobs AS gj
    SET request_metadata = COALESCE(gj.request_metadata, '{}'::jsonb) || jsonb_build_object(
      'mode', 'research-v1',
      'source_count', v_source_count,
      'sources', p_sources,
      'grounding_policy', 'provided-sources-only'
    )
    WHERE gj.id = v_submission.job_id
      AND gj.user_id = v_actor_id;

    INSERT INTO public.audit_events (
      actor_id,
      project_id,
      job_id,
      event_type,
      target_type,
      target_id,
      result,
      policy_context,
      metadata
    ) VALUES (
      v_actor_id,
      p_project_id,
      v_submission.job_id,
      'research.sources_attached',
      'generation_job',
      v_submission.job_id,
      'allowed',
      jsonb_build_object('authorization', 'project-writer'),
      jsonb_build_object('mode', 'research-v1', 'source_count', v_source_count)
    );
  END IF;

  RETURN QUERY
  SELECT
    v_submission.job_id::UUID,
    v_submission.conversation_id::UUID,
    v_submission.created::BOOLEAN,
    v_submission.status::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_submit_research_job(UUID, UUID, TEXT, JSONB, TEXT, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_submit_research_job(UUID, UUID, TEXT, JSONB, TEXT, TEXT)
TO authenticated;
