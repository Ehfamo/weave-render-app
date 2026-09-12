ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS approval_requests_unconsumed_idx ON public.approval_requests(run_id) WHERE status='approved' AND consumed_at IS NULL;

CREATE OR REPLACE FUNCTION private.xeomx_consume_agent_approval(
  p_approval_id UUID, p_task_id TEXT, p_execution_id TEXT, p_step_id TEXT,
  p_tool_id TEXT, p_project_id UUID
) RETURNS public.approval_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_result public.approval_requests%ROWTYPE;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  UPDATE public.approval_requests ar SET consumed_at=now(),updated_at=now()
  FROM public.controlled_runs r
  WHERE ar.id=p_approval_id AND r.id=ar.run_id AND ar.project_id=p_project_id
    AND ar.status='approved' AND ar.consumed_at IS NULL
    AND (ar.expires_at IS NULL OR ar.expires_at>now()) AND r.state='queued'
    AND r.input->>'taskId'=p_task_id AND r.input->>'executionId'=p_execution_id
    AND r.input->>'stepId'=p_step_id AND r.input->>'toolId'=p_tool_id
  RETURNING ar.* INTO v_result;
  IF v_result.id IS NULL THEN RAISE EXCEPTION 'APPROVAL_INVALID_EXPIRED_OR_CONSUMED' USING ERRCODE='42501'; END IF;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION private.xeomx_consume_agent_approval(UUID,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.xeomx_consume_agent_approval(UUID,TEXT,TEXT,TEXT,TEXT,UUID) TO service_role;
