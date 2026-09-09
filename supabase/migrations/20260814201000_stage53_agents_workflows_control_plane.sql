-- XEOMX Stage 5.3: sandbox-only agents and workflows control plane.
-- This migration deliberately exposes no authenticated SECURITY DEFINER RPC.
-- Authenticated callers use ordinary table mutations constrained by RLS and
-- trigger-enforced state machines. Trigger helpers live in the private schema
-- and are not executable through the Data API.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  objective TEXT NOT NULL CHECK (char_length(objective) BETWEEN 1 AND 4000),
  tool_scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    CHECK (cardinality(tool_scopes) <= 40),
  credential_refs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    CHECK (cardinality(credential_refs) <= 20),
  timeout_seconds INTEGER NOT NULL DEFAULT 300 CHECK (timeout_seconds BETWEEN 1 AND 3600),
  max_risk_tier TEXT NOT NULL DEFAULT 'R0'
    CHECK (max_risk_tier IN ('R0', 'R1', 'R2', 'R3')),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(configuration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

CREATE TABLE public.workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  max_risk_tier TEXT NOT NULL DEFAULT 'R0'
    CHECK (max_risk_tier IN ('R0', 'R1', 'R2', 'R3')),
  definition JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(definition) = 'object'),
  credential_refs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    CHECK (cardinality(credential_refs) <= 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version)
);

CREATE TABLE public.controlled_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('agent', 'workflow')),
  agent_version_id UUID REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  workflow_version_id UUID REFERENCES public.workflow_versions(id) ON DELETE RESTRICT,
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('R0', 'R1', 'R2', 'R3')),
  action_key TEXT NOT NULL CHECK (char_length(action_key) BETWEEN 3 AND 120),
  input JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(input) = 'object'),
  credential_refs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    CHECK (cardinality(credential_refs) <= 20),
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN (
      'awaiting_approval', 'queued', 'running', 'succeeded', 'failed',
      'cancelled', 'denied', 'unavailable'
    )),
  approval_required BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 10),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  result JSONB CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  failure_code TEXT CHECK (failure_code IS NULL OR char_length(failure_code) <= 100),
  failure_message TEXT CHECK (failure_message IS NULL OR char_length(failure_message) <= 500),
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requested_by, idempotency_key),
  CHECK (attempt_count <= max_attempts),
  CHECK (
    (subject_type = 'agent' AND agent_version_id IS NOT NULL AND workflow_version_id IS NULL)
    OR
    (subject_type = 'workflow' AND workflow_version_id IS NOT NULL AND agent_version_id IS NULL)
  ),
  CHECK (
    (risk_tier = 'R2' AND approval_required)
    OR (risk_tier <> 'R2' AND NOT approval_required)
  )
);

CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES public.controlled_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_reason TEXT CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 1000),
  expires_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status <> 'pending' AND decided_at IS NOT NULL)
  )
);

-- Every foreign-key access path is indexed explicitly.
CREATE INDEX agents_project_idx ON public.agents(project_id);
CREATE INDEX agents_owner_idx ON public.agents(owner_id);
CREATE INDEX agent_versions_agent_idx ON public.agent_versions(agent_id);
CREATE INDEX agent_versions_created_by_idx ON public.agent_versions(created_by);
CREATE INDEX workflow_definitions_project_idx ON public.workflow_definitions(project_id);
CREATE INDEX workflow_definitions_owner_idx ON public.workflow_definitions(owner_id);
CREATE INDEX workflow_versions_workflow_idx ON public.workflow_versions(workflow_id);
CREATE INDEX workflow_versions_created_by_idx ON public.workflow_versions(created_by);
CREATE INDEX controlled_runs_project_created_idx
  ON public.controlled_runs(project_id, created_at DESC);
CREATE INDEX controlled_runs_requested_by_idx
  ON public.controlled_runs(requested_by, created_at DESC);
CREATE INDEX controlled_runs_agent_version_idx
  ON public.controlled_runs(agent_version_id) WHERE agent_version_id IS NOT NULL;
CREATE INDEX controlled_runs_workflow_version_idx
  ON public.controlled_runs(workflow_version_id) WHERE workflow_version_id IS NOT NULL;
CREATE INDEX controlled_runs_active_idx
  ON public.controlled_runs(project_id, created_at DESC)
  WHERE state IN ('awaiting_approval', 'queued', 'running');
CREATE INDEX approval_requests_project_idx ON public.approval_requests(project_id);
CREATE INDEX approval_requests_requested_by_idx ON public.approval_requests(requested_by);
CREATE INDEX approval_requests_decided_by_idx
  ON public.approval_requests(decided_by) WHERE decided_by IS NOT NULL;

-- Values stored in JSON must never carry credential values. Only opaque
-- references with the cred_ prefix may cross the control-plane boundary.
CREATE OR REPLACE FUNCTION private.xeomx_json_has_sensitive_key(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_key TEXT;
  v_child JSONB;
BEGIN
  IF p_value IS NULL THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(p_value) = 'object' THEN
    FOR v_key, v_child IN SELECT key, value FROM jsonb_each(p_value)
    LOOP
      IF v_key ~* '(^|_)(api_?key|secret|token|password|service_?role|private_?key|credential_?value)($|_)' THEN
        RETURN true;
      END IF;
      IF private.xeomx_json_has_sensitive_key(v_child) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    FOR v_child IN SELECT value FROM jsonb_array_elements(p_value)
    LOOP
      IF private.xeomx_json_has_sensitive_key(v_child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_valid_opaque_refs(p_refs TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_ref TEXT;
BEGIN
  IF cardinality(COALESCE(p_refs, ARRAY[]::TEXT[])) > 20 THEN
    RETURN false;
  END IF;
  FOREACH v_ref IN ARRAY COALESCE(p_refs, ARRAY[]::TEXT[])
  LOOP
    IF v_ref !~ '^cred_[A-Za-z0-9_-]{8,120}$' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_definition_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('agents', 'workflow_definitions') THEN
    IF NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'CONTROL_PLANE_IMMUTABLE_FIELD' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'archived' AND NEW.status <> 'archived' THEN
      RAISE EXCEPTION 'CONTROL_PLANE_ARCHIVED' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'agent_versions' THEN
    IF private.xeomx_json_has_sensitive_key(NEW.configuration)
      OR NOT private.xeomx_valid_opaque_refs(NEW.credential_refs) THEN
      RAISE EXCEPTION 'CONTROL_PLANE_SECRET_REJECTED' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_versions' THEN
    IF private.xeomx_json_has_sensitive_key(NEW.definition)
      OR NOT private.xeomx_valid_opaque_refs(NEW.credential_refs) THEN
      RAISE EXCEPTION 'CONTROL_PLANE_SECRET_REJECTED' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_controlled_run_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_jwt_role TEXT := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  v_subject_project UUID;
  v_subject_max_risk TEXT;
  v_owner UUID;
  v_approval public.approval_requests%ROWTYPE;
  v_old_rank INTEGER;
  v_max_rank INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_jwt_role <> 'service_role' THEN
      IF v_actor IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
      END IF;
      NEW.requested_by := v_actor;
    END IF;

    IF NEW.subject_type = 'agent' THEN
      SELECT a.project_id, av.max_risk_tier
      INTO v_subject_project, v_subject_max_risk
      FROM public.agent_versions av
      JOIN public.agents a ON a.id = av.agent_id
      WHERE av.id = NEW.agent_version_id;
    ELSE
      SELECT w.project_id, wv.max_risk_tier
      INTO v_subject_project, v_subject_max_risk
      FROM public.workflow_versions wv
      JOIN public.workflow_definitions w ON w.id = wv.workflow_id
      WHERE wv.id = NEW.workflow_version_id;
    END IF;

    IF v_subject_project IS NULL OR v_subject_project <> NEW.project_id THEN
      RAISE EXCEPTION 'CONTROL_PLANE_SUBJECT_PROJECT_MISMATCH' USING ERRCODE = '23514';
    END IF;

    v_old_rank := CASE NEW.risk_tier WHEN 'R0' THEN 0 WHEN 'R1' THEN 1 WHEN 'R2' THEN 2 ELSE 3 END;
    v_max_rank := CASE v_subject_max_risk WHEN 'R0' THEN 0 WHEN 'R1' THEN 1 WHEN 'R2' THEN 2 ELSE 3 END;
    IF v_old_rank > v_max_rank THEN
      RAISE EXCEPTION 'CONTROL_PLANE_RISK_EXCEEDS_DEFINITION' USING ERRCODE = '23514';
    END IF;

    IF NOT (
      (NEW.risk_tier = 'R0' AND NEW.action_key IN (
        'project.read', 'dataset.read', 'search.read', 'evidence.read'
      )) OR
      (NEW.risk_tier = 'R1' AND NEW.action_key IN (
        'sandbox.echo', 'sandbox.transform', 'draft.write', 'temporary.create'
      )) OR
      (NEW.risk_tier = 'R2' AND NEW.action_key IN (
        'credential.use', 'external.write', 'member.change', 'billing.change'
      )) OR
      (NEW.risk_tier = 'R3' AND NEW.action_key IN (
        'external.irreversible', 'production.deploy', 'payment.charge', 'data.delete'
      ))
    ) THEN
      RAISE EXCEPTION 'CONTROL_PLANE_ACTION_NOT_ALLOWLISTED' USING ERRCODE = '23514';
    END IF;

    IF private.xeomx_json_has_sensitive_key(NEW.input)
      OR NOT private.xeomx_valid_opaque_refs(NEW.credential_refs) THEN
      RAISE EXCEPTION 'CONTROL_PLANE_SECRET_REJECTED' USING ERRCODE = '23514';
    END IF;

    NEW.result := NULL;
    NEW.started_at := NULL;
    NEW.completed_at := NULL;
    NEW.attempt_count := 1;
    NEW.failure_message := NULL;
    IF NEW.risk_tier IN ('R0', 'R1') THEN
      NEW.state := 'queued';
      NEW.approval_required := false;
      NEW.failure_code := NULL;
      NEW.queued_at := now();
    ELSIF NEW.risk_tier = 'R2' THEN
      NEW.state := 'awaiting_approval';
      NEW.approval_required := true;
      NEW.failure_code := NULL;
      NEW.queued_at := NULL;
    ELSE
      -- R3 is not merely approval-required. It is unavailable to this control
      -- plane even if an ordinary approval record were somehow presented.
      NEW.state := 'denied';
      NEW.approval_required := false;
      NEW.failure_code := 'R3_DEFAULT_DENY';
      NEW.completed_at := now();
      NEW.queued_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
    OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
    OR NEW.agent_version_id IS DISTINCT FROM OLD.agent_version_id
    OR NEW.workflow_version_id IS DISTINCT FROM OLD.workflow_version_id
    OR NEW.risk_tier IS DISTINCT FROM OLD.risk_tier
    OR NEW.action_key IS DISTINCT FROM OLD.action_key
    OR NEW.input IS DISTINCT FROM OLD.input
    OR NEW.credential_refs IS DISTINCT FROM OLD.credential_refs
    OR NEW.approval_required IS DISTINCT FROM OLD.approval_required
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
    OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CONTROL_PLANE_IMMUTABLE_FIELD' USING ERRCODE = '42501';
  END IF;

  IF OLD.risk_tier = 'R3' OR OLD.state = 'denied' THEN
    RAISE EXCEPTION 'R3_DEFAULT_DENY' USING ERRCODE = '42501';
  END IF;
  IF private.xeomx_json_has_sensitive_key(NEW.result) THEN
    RAISE EXCEPTION 'CONTROL_PLANE_SECRET_REJECTED' USING ERRCODE = '23514';
  END IF;

  SELECT p.owner_id INTO v_owner FROM public.projects p WHERE p.id = OLD.project_id;

  -- Approval-triggered transition. Exact project-owner approval is mandatory.
  IF pg_trigger_depth() > 1 AND OLD.risk_tier = 'R2' AND OLD.state = 'awaiting_approval' THEN
    SELECT * INTO v_approval
    FROM public.approval_requests ar
    WHERE ar.run_id = OLD.id;
    IF NEW.state = 'queued' THEN
      IF v_approval.status <> 'approved' OR v_approval.decided_by IS DISTINCT FROM v_owner THEN
        RAISE EXCEPTION 'R2_EXACT_OWNER_APPROVAL_REQUIRED' USING ERRCODE = '42501';
      END IF;
      NEW.queued_at := now();
      NEW.failure_code := NULL;
      NEW.failure_message := NULL;
    ELSIF NEW.state = 'denied' THEN
      IF v_approval.status <> 'denied' OR v_approval.decided_by IS DISTINCT FROM v_owner THEN
        RAISE EXCEPTION 'R2_EXACT_OWNER_DECISION_REQUIRED' USING ERRCODE = '42501';
      END IF;
      NEW.failure_code := 'OWNER_DENIED';
      NEW.completed_at := now();
    ELSE
      RAISE EXCEPTION 'CONTROL_PLANE_INVALID_APPROVAL_TRANSITION' USING ERRCODE = '23514';
    END IF;
  ELSIF v_jwt_role = 'service_role' THEN
    IF NOT (
      (OLD.state = 'queued' AND NEW.state IN ('running', 'cancelled')) OR
      (OLD.state = 'running' AND NEW.state IN ('succeeded', 'failed', 'cancelled', 'unavailable')) OR
      (OLD.state IN ('failed', 'cancelled', 'unavailable') AND NEW.state = 'queued')
    ) THEN
      RAISE EXCEPTION 'CONTROL_PLANE_INVALID_SERVICE_TRANSITION' USING ERRCODE = '23514';
    END IF;
    IF OLD.state IN ('failed', 'cancelled', 'unavailable') AND NEW.state = 'queued' THEN
      IF OLD.attempt_count >= OLD.max_attempts THEN
        RAISE EXCEPTION 'CONTROL_PLANE_ATTEMPTS_EXHAUSTED' USING ERRCODE = '23514';
      END IF;
      IF OLD.risk_tier = 'R2' AND NOT EXISTS (
        SELECT 1 FROM public.approval_requests ar
        WHERE ar.run_id = OLD.id AND ar.status = 'approved' AND ar.decided_by = v_owner
      ) THEN
        RAISE EXCEPTION 'R2_EXACT_OWNER_APPROVAL_REQUIRED' USING ERRCODE = '42501';
      END IF;
      NEW.attempt_count := OLD.attempt_count + 1;
    ELSE
      NEW.attempt_count := OLD.attempt_count;
    END IF;
  ELSE
    IF v_actor IS NULL OR NOT (v_actor = OLD.requested_by OR v_actor = v_owner) THEN
      RAISE EXCEPTION 'CONTROL_PLANE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF OLD.state IN ('awaiting_approval', 'queued', 'running') AND NEW.state = 'cancelled' THEN
      NEW.attempt_count := OLD.attempt_count;
    ELSIF OLD.risk_tier IN ('R0', 'R1')
      AND OLD.state IN ('failed', 'cancelled', 'unavailable') AND NEW.state = 'queued' THEN
      IF OLD.attempt_count >= OLD.max_attempts THEN
        RAISE EXCEPTION 'CONTROL_PLANE_ATTEMPTS_EXHAUSTED' USING ERRCODE = '23514';
      END IF;
      NEW.attempt_count := OLD.attempt_count + 1;
    ELSE
      RAISE EXCEPTION 'CONTROL_PLANE_INVALID_USER_TRANSITION' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.state = 'queued' THEN
    NEW.queued_at := now();
    NEW.started_at := NULL;
    NEW.completed_at := NULL;
    NEW.result := NULL;
    NEW.failure_code := NULL;
    NEW.failure_message := NULL;
  ELSIF NEW.state = 'running' THEN
    NEW.started_at := now();
    NEW.completed_at := NULL;
    NEW.result := NULL;
    NEW.failure_code := NULL;
    NEW.failure_message := NULL;
  ELSIF NEW.state = 'succeeded' THEN
    IF NEW.result IS NULL THEN
      RAISE EXCEPTION 'CONTROL_PLANE_RESULT_REQUIRED' USING ERRCODE = '23514';
    END IF;
    NEW.completed_at := now();
    NEW.failure_code := NULL;
    NEW.failure_message := NULL;
  ELSE
    NEW.completed_at := now();
    IF NEW.state IN ('failed', 'unavailable') AND NEW.failure_code IS NULL THEN
      RAISE EXCEPTION 'CONTROL_PLANE_FAILURE_CODE_REQUIRED' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_create_run_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.risk_tier = 'R2' THEN
    INSERT INTO public.approval_requests (run_id, project_id, requested_by)
    VALUES (NEW.id, NEW.project_id, NEW.requested_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_approval_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_owner UUID;
  v_run public.controlled_runs%ROWTYPE;
BEGIN
  IF NEW.run_id IS DISTINCT FROM OLD.run_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'CONTROL_PLANE_IMMUTABLE_FIELD' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'APPROVAL_ALREADY_DECIDED' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_run FROM public.controlled_runs r WHERE r.id = OLD.run_id;
  SELECT p.owner_id INTO v_owner FROM public.projects p WHERE p.id = OLD.project_id;

  -- Nested cancellation is initiated by the run owner through the run guard.
  IF pg_trigger_depth() > 1 AND NEW.status = 'cancelled' AND v_run.state = 'cancelled' THEN
    NEW.decided_by := COALESCE(v_actor, OLD.requested_by);
  ELSE
    IF v_actor IS NULL OR v_actor IS DISTINCT FROM v_owner THEN
      RAISE EXCEPTION 'APPROVAL_EXACT_PROJECT_OWNER_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF NEW.status NOT IN ('approved', 'denied', 'cancelled') THEN
      RAISE EXCEPTION 'APPROVAL_INVALID_DECISION' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'denied' AND NULLIF(btrim(NEW.decision_reason), '') IS NULL THEN
      RAISE EXCEPTION 'APPROVAL_DENIAL_REASON_REQUIRED' USING ERRCODE = '23514';
    END IF;
    NEW.decided_by := v_actor;
  END IF;

  NEW.decided_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_apply_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.controlled_runs SET state = 'queued' WHERE id = NEW.run_id;
  ELSIF NEW.status = 'denied' THEN
    UPDATE public.controlled_runs SET state = 'denied' WHERE id = NEW.run_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_close_pending_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.state = 'cancelled' AND OLD.state = 'awaiting_approval' THEN
    UPDATE public.approval_requests
    SET status = 'cancelled', decision_reason = 'Run cancelled before decision'
    WHERE run_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.xeomx_control_plane_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_project UUID;
  v_target UUID;
  v_event TEXT;
  v_result TEXT := 'allowed';
  v_error TEXT;
  v_policy JSONB := '{}'::jsonb;
  v_metadata JSONB := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'agents' THEN
    v_project := NEW.project_id; v_target := NEW.id;
    v_event := CASE WHEN TG_OP = 'INSERT' THEN 'agent.created' ELSE 'agent.updated' END;
    v_metadata := jsonb_build_object('status', NEW.status);
  ELSIF TG_TABLE_NAME = 'agent_versions' THEN
    SELECT a.project_id INTO v_project FROM public.agents a WHERE a.id = NEW.agent_id;
    v_target := NEW.id; v_event := 'agent.version.created';
    v_metadata := jsonb_build_object('version', NEW.version, 'max_risk_tier', NEW.max_risk_tier);
  ELSIF TG_TABLE_NAME = 'workflow_definitions' THEN
    v_project := NEW.project_id; v_target := NEW.id;
    v_event := CASE WHEN TG_OP = 'INSERT' THEN 'workflow.created' ELSE 'workflow.updated' END;
    v_metadata := jsonb_build_object('status', NEW.status);
  ELSIF TG_TABLE_NAME = 'workflow_versions' THEN
    SELECT w.project_id INTO v_project FROM public.workflow_definitions w WHERE w.id = NEW.workflow_id;
    v_target := NEW.id; v_event := 'workflow.version.created';
    v_metadata := jsonb_build_object('version', NEW.version, 'max_risk_tier', NEW.max_risk_tier);
  ELSIF TG_TABLE_NAME = 'controlled_runs' THEN
    v_project := NEW.project_id; v_target := NEW.id; v_actor := COALESCE(v_actor, NEW.requested_by);
    v_event := CASE WHEN TG_OP = 'INSERT' THEN 'controlled_run.submitted' ELSE 'controlled_run.state_changed' END;
    v_result := CASE
      WHEN NEW.state = 'succeeded' THEN 'succeeded'
      WHEN NEW.state IN ('failed', 'denied', 'unavailable') THEN 'failed'
      WHEN NEW.state = 'cancelled' THEN 'cancelled'
      WHEN TG_OP = 'INSERT' THEN 'submitted'
      ELSE 'allowed'
    END;
    v_error := NEW.failure_code;
    v_policy := jsonb_build_object(
      'risk_tier', NEW.risk_tier,
      'approval_required', NEW.approval_required,
      'state', NEW.state
    );
    v_metadata := jsonb_build_object('action_key', NEW.action_key, 'attempt_count', NEW.attempt_count);
  ELSE
    v_project := NEW.project_id; v_target := NEW.id; v_actor := COALESCE(NEW.decided_by, v_actor);
    v_event := 'approval.' || NEW.status;
    v_result := CASE
      WHEN NEW.status = 'pending' THEN 'submitted'
      WHEN NEW.status = 'approved' THEN 'allowed'
      WHEN NEW.status = 'denied' THEN 'failed'
      ELSE 'cancelled'
    END;
    v_policy := jsonb_build_object('status', NEW.status, 'exact_project_owner', NEW.decided_by IS NOT NULL);
  END IF;

  INSERT INTO public.audit_events (
    actor_id, project_id, event_type, target_type, target_id,
    result, error_category, policy_context, metadata
  ) VALUES (
    v_actor, v_project, v_event, TG_TABLE_NAME, v_target,
    v_result, v_error, v_policy, v_metadata
  );
  RETURN NEW;
END;
$$;

-- Trigger helpers are deliberately uncallable by browser roles. PostgreSQL
-- trigger execution does not require the invoker to hold EXECUTE on them.
REVOKE ALL ON FUNCTION private.xeomx_json_has_sensitive_key(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_valid_opaque_refs(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_definition_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_controlled_run_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_create_run_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_approval_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_apply_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_close_pending_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.xeomx_control_plane_audit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.xeomx_json_has_sensitive_key(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_valid_opaque_refs(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_definition_guard() TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_controlled_run_guard() TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_create_run_approval() TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_approval_guard() TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_apply_approval() TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_close_pending_approval() TO service_role;
GRANT EXECUTE ON FUNCTION private.xeomx_control_plane_audit() TO service_role;

CREATE TRIGGER agents_guard
  BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION private.xeomx_definition_guard();
CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agents_audit
  AFTER INSERT OR UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION private.xeomx_control_plane_audit();
CREATE TRIGGER agent_versions_guard
  BEFORE INSERT OR UPDATE ON public.agent_versions FOR EACH ROW EXECUTE FUNCTION private.xeomx_definition_guard();
CREATE TRIGGER agent_versions_audit
  AFTER INSERT ON public.agent_versions FOR EACH ROW EXECUTE FUNCTION private.xeomx_control_plane_audit();
CREATE TRIGGER workflow_definitions_guard
  BEFORE UPDATE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION private.xeomx_definition_guard();
CREATE TRIGGER workflow_definitions_updated_at
  BEFORE UPDATE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workflow_definitions_audit
  AFTER INSERT OR UPDATE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION private.xeomx_control_plane_audit();
CREATE TRIGGER workflow_versions_guard
  BEFORE INSERT OR UPDATE ON public.workflow_versions FOR EACH ROW EXECUTE FUNCTION private.xeomx_definition_guard();
CREATE TRIGGER workflow_versions_audit
  AFTER INSERT ON public.workflow_versions FOR EACH ROW EXECUTE FUNCTION private.xeomx_control_plane_audit();
CREATE TRIGGER controlled_runs_guard
  BEFORE INSERT OR UPDATE ON public.controlled_runs FOR EACH ROW EXECUTE FUNCTION private.xeomx_controlled_run_guard();
CREATE TRIGGER controlled_runs_create_approval
  AFTER INSERT ON public.controlled_runs FOR EACH ROW EXECUTE FUNCTION private.xeomx_create_run_approval();
CREATE TRIGGER controlled_runs_close_approval
  AFTER UPDATE ON public.controlled_runs FOR EACH ROW EXECUTE FUNCTION private.xeomx_close_pending_approval();
CREATE TRIGGER controlled_runs_audit
  AFTER INSERT OR UPDATE ON public.controlled_runs FOR EACH ROW EXECUTE FUNCTION private.xeomx_control_plane_audit();
CREATE TRIGGER approval_requests_guard
  BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION private.xeomx_approval_guard();
CREATE TRIGGER approval_requests_apply
  AFTER UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION private.xeomx_apply_approval();
CREATE TRIGGER approval_requests_audit
  AFTER INSERT OR UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION private.xeomx_control_plane_audit();

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agent_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.workflow_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.workflow_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.controlled_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.approval_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.agents, public.agent_versions,
  public.workflow_definitions, public.workflow_versions,
  public.controlled_runs, public.approval_requests TO authenticated;
GRANT INSERT (project_id, owner_id, name, description, status)
  ON public.agents TO authenticated;
GRANT UPDATE (name, description, status) ON public.agents TO authenticated;
GRANT INSERT (
  agent_id, created_by, version, objective, tool_scopes,
  credential_refs, timeout_seconds, max_risk_tier, configuration
) ON public.agent_versions TO authenticated;
GRANT INSERT (project_id, owner_id, name, description, status)
  ON public.workflow_definitions TO authenticated;
GRANT UPDATE (name, description, status) ON public.workflow_definitions TO authenticated;
GRANT INSERT (
  workflow_id, created_by, version, max_risk_tier, definition, credential_refs
) ON public.workflow_versions TO authenticated;
GRANT INSERT (
  project_id, requested_by, subject_type, agent_version_id, workflow_version_id,
  risk_tier, action_key, input, credential_refs, idempotency_key, request_hash, max_attempts
) ON public.controlled_runs TO authenticated;
GRANT UPDATE (state) ON public.controlled_runs TO authenticated;
GRANT UPDATE (status, decision_reason) ON public.approval_requests TO authenticated;
GRANT ALL ON public.agents, public.agent_versions,
  public.workflow_definitions, public.workflow_versions,
  public.controlled_runs, public.approval_requests TO service_role;

CREATE POLICY agents_member_select ON public.agents FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY agents_editor_insert ON public.agents FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND public.xeomx_project_role(project_id) IN ('owner', 'editor')
  );
CREATE POLICY agents_owner_update ON public.agents FOR UPDATE TO authenticated
  USING (
    public.xeomx_project_role(project_id) IS NOT NULL
    AND (
      owner_id = (SELECT auth.uid())
      OR public.xeomx_project_role(project_id) = 'owner'
    )
  )
  WITH CHECK (
    public.xeomx_project_role(project_id) IS NOT NULL
    AND (
      owner_id = (SELECT auth.uid())
      OR public.xeomx_project_role(project_id) = 'owner'
    )
  );

CREATE POLICY agent_versions_member_select ON public.agent_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_versions.agent_id
      AND public.xeomx_project_role(a.project_id) IS NOT NULL
  ));
CREATE POLICY agent_versions_editor_insert ON public.agent_versions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_versions.agent_id
        AND public.xeomx_project_role(a.project_id) IN ('owner', 'editor')
    )
  );

CREATE POLICY workflows_member_select ON public.workflow_definitions FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY workflows_editor_insert ON public.workflow_definitions FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND public.xeomx_project_role(project_id) IN ('owner', 'editor')
  );
CREATE POLICY workflows_owner_update ON public.workflow_definitions FOR UPDATE TO authenticated
  USING (
    public.xeomx_project_role(project_id) IS NOT NULL
    AND (
      owner_id = (SELECT auth.uid())
      OR public.xeomx_project_role(project_id) = 'owner'
    )
  )
  WITH CHECK (
    public.xeomx_project_role(project_id) IS NOT NULL
    AND (
      owner_id = (SELECT auth.uid())
      OR public.xeomx_project_role(project_id) = 'owner'
    )
  );

CREATE POLICY workflow_versions_member_select ON public.workflow_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflow_definitions w
    WHERE w.id = workflow_versions.workflow_id
      AND public.xeomx_project_role(w.project_id) IS NOT NULL
  ));
CREATE POLICY workflow_versions_editor_insert ON public.workflow_versions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.workflow_definitions w
      WHERE w.id = workflow_versions.workflow_id
        AND public.xeomx_project_role(w.project_id) IN ('owner', 'editor')
    )
  );

CREATE POLICY controlled_runs_member_select ON public.controlled_runs FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY controlled_runs_editor_insert ON public.controlled_runs FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND public.xeomx_project_role(project_id) IN ('owner', 'editor')
  );
CREATE POLICY controlled_runs_requester_update ON public.controlled_runs FOR UPDATE TO authenticated
  USING (
    requested_by = (SELECT auth.uid())
    OR public.xeomx_project_role(project_id) = 'owner'
  )
  WITH CHECK (
    requested_by = (SELECT auth.uid())
    OR public.xeomx_project_role(project_id) = 'owner'
  );

CREATE POLICY approval_requests_member_select ON public.approval_requests FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY approval_requests_exact_owner_update ON public.approval_requests FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = approval_requests.project_id
      AND p.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = approval_requests.project_id
      AND p.owner_id = (SELECT auth.uid())
  ));

COMMENT ON TABLE public.controlled_runs IS
  'Sandbox control-plane requests. R2 requires exact project-owner approval; R3 is permanently default-deny.';
COMMENT ON COLUMN public.controlled_runs.credential_refs IS
  'Opaque cred_* references only. Secret values are never stored in this table.';
