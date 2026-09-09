BEGIN;

-- XEOMX Request 7: authenticated project -> generation -> persisted output.
-- This migration is additive. It does not delete or rewrite existing product data.

-- -----------------------------------------------------------------------------
-- Core project data
-- -----------------------------------------------------------------------------

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  default_routing_mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (default_routing_mode IN ('auto', 'manual')),
  default_model TEXT CHECK (default_model IS NULL OR char_length(default_model) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX projects_owner_updated_idx
  ON public.projects(owner_id, updated_at DESC);
CREATE INDEX projects_owner_status_idx
  ON public.projects(owner_id, status);

CREATE TABLE public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE UNIQUE INDEX project_members_single_owner_idx
  ON public.project_members(project_id)
  WHERE role = 'owner';
CREATE INDEX project_members_user_idx
  ON public.project_members(user_id, created_at DESC);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  routing_mode TEXT NOT NULL DEFAULT 'auto' CHECK (routing_mode IN ('auto', 'manual')),
  selected_provider TEXT CHECK (selected_provider IS NULL OR char_length(selected_provider) <= 100),
  selected_model TEXT CHECK (selected_model IS NULL OR char_length(selected_model) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversations_project_updated_idx
  ON public.conversations(project_id, updated_at DESC);
CREATE INDEX conversations_creator_idx
  ON public.conversations(created_by, created_at DESC);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 200000),
  provider TEXT CHECK (provider IS NULL OR char_length(provider) <= 100),
  model TEXT CHECK (model IS NULL OR char_length(model) <= 200),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (role = 'user' AND author_id IS NOT NULL)
    OR role IN ('assistant', 'system', 'tool')
  )
);

CREATE INDEX messages_conversation_created_idx
  ON public.messages(conversation_id, created_at ASC);
CREATE INDEX messages_project_created_idx
  ON public.messages(project_id, created_at DESC);
CREATE INDEX messages_author_idx
  ON public.messages(author_id, created_at DESC)
  WHERE author_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Persisted generation jobs, provider attempts and outputs
-- -----------------------------------------------------------------------------

CREATE TABLE public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  input_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  capability TEXT NOT NULL DEFAULT 'text-generation'
    CHECK (capability IN ('text-generation')),
  routing_mode TEXT NOT NULL CHECK (routing_mode IN ('auto', 'manual')),
  requested_provider TEXT CHECK (
    requested_provider IS NULL OR char_length(requested_provider) BETWEEN 1 AND 100
  ),
  requested_model TEXT CHECK (
    requested_model IS NULL OR char_length(requested_model) BETWEEN 1 AND 200
  ),
  selected_provider TEXT CHECK (
    selected_provider IS NULL OR char_length(selected_provider) BETWEEN 1 AND 100
  ),
  selected_model TEXT CHECK (
    selected_model IS NULL OR char_length(selected_model) BETWEEN 1 AND 200
  ),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  request_hash TEXT NOT NULL CHECK (char_length(request_hash) = 64),
  reserved_credit_units BIGINT NOT NULL DEFAULT 0 CHECK (reserved_credit_units >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 20),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 20),
  error_category TEXT CHECK (
    error_category IS NULL OR error_category IN (
      'PROVIDER_UNAVAILABLE',
      'MODEL_UNAVAILABLE',
      'PROVIDER_TIMEOUT',
      'GENERATION_FAILED',
      'STORAGE_FAILED',
      'DATABASE_FAILED',
      'CANCELLED'
    )
  ),
  error_message TEXT CHECK (error_message IS NULL OR char_length(error_message) <= 500),
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX generation_jobs_project_created_idx
  ON public.generation_jobs(project_id, created_at DESC);
CREATE INDEX generation_jobs_user_status_idx
  ON public.generation_jobs(user_id, status, created_at DESC);
CREATE INDEX generation_jobs_conversation_idx
  ON public.generation_jobs(conversation_id, created_at ASC);
CREATE INDEX generation_jobs_active_idx
  ON public.generation_jobs(project_id, created_at DESC)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.messages
  ADD COLUMN generation_job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL;
CREATE INDEX messages_generation_job_idx
  ON public.messages(generation_job_id)
  WHERE generation_job_id IS NOT NULL;

CREATE TABLE public.provider_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 100),
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
  provider_request_id TEXT CHECK (
    provider_request_id IS NULL OR char_length(provider_request_id) <= 300
  ),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 20),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'unavailable')),
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_category TEXT CHECK (error_category IS NULL OR char_length(error_category) <= 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, attempt)
);

CREATE INDEX provider_requests_user_created_idx
  ON public.provider_requests(user_id, created_at DESC);
CREATE INDEX provider_requests_provider_status_idx
  ON public.provider_requests(provider, status, created_at DESC);

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generation_job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'video', 'audio', 'document', 'code', 'file')),
  origin TEXT NOT NULL CHECK (origin IN ('upload', 'generation', 'import', 'marketplace')),
  mime_type TEXT NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'deleted')),
  storage_bucket TEXT CHECK (storage_bucket IS NULL OR char_length(storage_bucket) <= 100),
  storage_path TEXT CHECK (storage_path IS NULL OR char_length(storage_path) <= 1000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  parent_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (storage_bucket IS NULL AND storage_path IS NULL)
    OR (storage_bucket IS NOT NULL AND storage_path IS NOT NULL)
  )
);

CREATE INDEX assets_project_created_idx
  ON public.assets(project_id, created_at DESC);
CREATE INDEX assets_owner_created_idx
  ON public.assets(owner_id, created_at DESC);
CREATE INDEX assets_generation_job_idx
  ON public.assets(generation_job_id)
  WHERE generation_job_id IS NOT NULL;
CREATE INDEX assets_parent_idx
  ON public.assets(parent_asset_id)
  WHERE parent_asset_id IS NOT NULL;

CREATE TABLE public.generation_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  message_id UUID NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE RESTRICT,
  output_text TEXT NOT NULL CHECK (char_length(output_text) BETWEEN 1 AND 200000),
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 100),
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
  finish_reason TEXT CHECK (finish_reason IS NULL OR char_length(finish_reason) <= 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX generation_outputs_project_created_idx
  ON public.generation_outputs(project_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Append-only usage, credit and audit ledgers
-- -----------------------------------------------------------------------------

CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id UUID NOT NULL UNIQUE REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  provider_request_id UUID REFERENCES public.provider_requests(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 100),
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
  input_units BIGINT CHECK (input_units IS NULL OR input_units >= 0),
  output_units BIGINT CHECK (output_units IS NULL OR output_units >= 0),
  estimated_cost_microunits BIGINT CHECK (
    estimated_cost_microunits IS NULL OR estimated_cost_microunits >= 0
  ),
  actual_cost_microunits BIGINT CHECK (
    actual_cost_microunits IS NULL OR actual_cost_microunits >= 0
  ),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  usage_unavailable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_user_created_idx
  ON public.usage_events(user_id, created_at DESC);
CREATE INDEX usage_events_project_created_idx
  ON public.usage_events(project_id, created_at DESC);
CREATE INDEX usage_events_provider_created_idx
  ON public.usage_events(provider, created_at DESC);

CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  usage_event_id UUID REFERENCES public.usage_events(id) ON DELETE SET NULL,
  delta BIGINT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('grant', 'reservation', 'consume', 'release', 'refund', 'adjustment')
  ),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 8 AND 250),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX credit_ledger_user_created_idx
  ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX credit_ledger_job_idx
  ON public.credit_ledger(job_id, created_at ASC)
  WHERE job_id IS NOT NULL;
CREATE INDEX credit_ledger_usage_event_idx
  ON public.credit_ledger(usage_event_id)
  WHERE usage_event_id IS NOT NULL;

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 3 AND 120),
  target_type TEXT NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 80),
  target_id UUID,
  result TEXT NOT NULL CHECK (result IN ('submitted', 'allowed', 'succeeded', 'failed', 'cancelled')),
  error_category TEXT CHECK (error_category IS NULL OR char_length(error_category) <= 100),
  policy_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_actor_created_idx
  ON public.audit_events(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;
CREATE INDEX audit_events_project_created_idx
  ON public.audit_events(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX audit_events_job_created_idx
  ON public.audit_events(job_id, created_at ASC)
  WHERE job_id IS NOT NULL;
CREATE INDEX audit_events_type_created_idx
  ON public.audit_events(event_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- Timestamp triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER generation_jobs_set_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Project authorization helpers. The functions return only the caller's own
-- membership decision and never accept a user_id from the browser.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.xeomx_project_role(p_project_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pm.role
  FROM public.project_members AS pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.xeomx_project_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_project_role(UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS and explicit Data API grants
-- -----------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, DELETE ON public.projects TO authenticated;
GRANT UPDATE (name, description, status, default_routing_mode, default_model)
  ON public.projects TO authenticated;
GRANT SELECT ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.generation_jobs TO authenticated;
GRANT SELECT ON public.provider_requests TO authenticated;
GRANT SELECT ON public.assets TO authenticated;
GRANT SELECT ON public.generation_outputs TO authenticated;
GRANT SELECT ON public.usage_events TO authenticated;
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.project_members TO service_role;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.generation_jobs TO service_role;
GRANT ALL ON public.provider_requests TO service_role;
GRANT ALL ON public.assets TO service_role;
GRANT ALL ON public.generation_outputs TO service_role;
GRANT ALL ON public.usage_events TO service_role;
GRANT ALL ON public.credit_ledger TO service_role;
GRANT ALL ON public.audit_events TO service_role;

CREATE POLICY "Project members can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.xeomx_project_role(id) IS NOT NULL
  );
CREATE POLICY "Project writers can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.xeomx_project_role(id) IN ('owner', 'editor'))
  WITH CHECK (public.xeomx_project_role(id) IN ('owner', 'editor'));
CREATE POLICY "Project owners can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND public.xeomx_project_role(id) = 'owner');

CREATE POLICY "Members can view their membership"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.projects AS p
      WHERE p.id = project_id
        AND p.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Project members can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY "Project writers can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.xeomx_project_role(project_id) IN ('owner', 'editor')
  );
CREATE POLICY "Project writers can update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.xeomx_project_role(project_id) IN ('owner', 'editor'))
  WITH CHECK (public.xeomx_project_role(project_id) IN ('owner', 'editor'));

CREATE POLICY "Project members can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY "Project members can view jobs"
  ON public.generation_jobs FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY "Users can view their provider requests"
  ON public.provider_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Project members can view assets"
  ON public.assets FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY "Project members can view generation outputs"
  ON public.generation_outputs FOR SELECT TO authenticated
  USING (public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY "Users can view their usage events"
  ON public.usage_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can view their credit ledger"
  ON public.credit_ledger FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Project members can view audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (
    actor_id = (SELECT auth.uid())
    OR (project_id IS NOT NULL AND public.xeomx_project_role(project_id) IS NOT NULL)
  );

-- -----------------------------------------------------------------------------
-- Private storage bucket. Text results are stored in Postgres in this slice;
-- future binary assets use <owner>/<project>/<asset>/<filename> paths.
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'xeomx-assets',
  'xeomx-assets',
  false,
  104857600,
  ARRAY[
    'text/plain',
    'text/markdown',
    'application/json',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/webm'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "xeomx_assets_owner_select" ON storage.objects;
CREATE POLICY "xeomx_assets_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'xeomx-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
DROP POLICY IF EXISTS "xeomx_assets_owner_insert" ON storage.objects;
CREATE POLICY "xeomx_assets_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'xeomx-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
DROP POLICY IF EXISTS "xeomx_assets_owner_update" ON storage.objects;
CREATE POLICY "xeomx_assets_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'xeomx-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'xeomx-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
DROP POLICY IF EXISTS "xeomx_assets_owner_delete" ON storage.objects;
CREATE POLICY "xeomx_assets_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'xeomx-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- Transactional RPCs. Browser-callable functions derive identity from auth.uid.
-- Service-only functions accept actor IDs only from authenticated server code.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.xeomx_create_project(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  status TEXT,
  default_routing_mode TEXT,
  default_model TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_project public.projects%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;
  p_name := btrim(p_name);
  p_description := NULLIF(btrim(p_description), '');
  IF char_length(p_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_PROJECT_NAME';
  END IF;

  INSERT INTO public.projects (owner_id, name, description)
  VALUES (v_actor, p_name, p_description)
  RETURNING * INTO v_project;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (v_project.id, v_actor, 'owner');

  INSERT INTO public.audit_events (
    actor_id, project_id, event_type, target_type, target_id, result, policy_context
  ) VALUES (
    v_actor,
    v_project.id,
    'project.created',
    'project',
    v_project.id,
    'succeeded',
    jsonb_build_object('authorization', 'authenticated-owner')
  );

  RETURN QUERY SELECT
    v_project.id,
    v_project.name,
    v_project.description,
    v_project.status,
    v_project.default_routing_mode,
    v_project.default_model,
    v_project.created_at,
    v_project.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_create_project(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_create_project(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.xeomx_credit_balance()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(sum(entry.delta), 0)::bigint
  FROM public.credit_ledger AS entry
  WHERE entry.user_id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION public.xeomx_credit_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_credit_balance() TO authenticated;

CREATE OR REPLACE FUNCTION public.xeomx_create_generation_job(
  p_actor_id UUID,
  p_project_id UUID,
  p_conversation_id UUID,
  p_prompt TEXT,
  p_routing_mode TEXT,
  p_requested_provider TEXT,
  p_requested_model TEXT,
  p_selected_provider TEXT,
  p_selected_model TEXT,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_reserved_credit_units BIGINT
)
RETURNS TABLE (job_id UUID, conversation_id UUID, created BOOLEAN, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_balance BIGINT;
  v_conversation_id UUID;
  v_message_id UUID;
  v_job public.generation_jobs%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;
  IF p_routing_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ROUTING_MODE';
  END IF;
  IF char_length(btrim(p_prompt)) NOT BETWEEN 1 AND 50000 THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_PROMPT';
  END IF;
  IF char_length(p_idempotency_key) NOT BETWEEN 16 AND 200
     OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_reserved_credit_units < 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_REQUEST';
  END IF;

  SELECT pm.role INTO v_role
  FROM public.project_members AS pm
  WHERE pm.project_id = p_project_id AND pm.user_id = p_actor_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROJECT_NOT_FOUND';
  END IF;
  IF v_role NOT IN ('owner', 'editor') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_actor_id::text || ':' || p_idempotency_key, 0)
  );

  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.user_id = p_actor_id AND gj.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_job.request_hash <> p_request_hash THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.conversation_id, false, v_job.status;
    RETURN;
  END IF;

  -- Serialize all balance reservations for one user, even when concurrent
  -- requests use different idempotency keys.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('credits:' || p_actor_id::text, 0)
  );

  SELECT COALESCE(sum(entry.delta), 0)::bigint INTO v_balance
  FROM public.credit_ledger AS entry
  WHERE entry.user_id = p_actor_id;
  IF p_reserved_credit_units > v_balance THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_INSUFFICIENT_CREDITS';
  END IF;

  IF p_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      project_id, created_by, title, routing_mode, selected_provider, selected_model
    ) VALUES (
      p_project_id,
      p_actor_id,
      left(regexp_replace(btrim(p_prompt), '\s+', ' ', 'g'), 120),
      p_routing_mode,
      p_selected_provider,
      p_selected_model
    ) RETURNING id INTO v_conversation_id;
  ELSE
    SELECT c.id INTO v_conversation_id
    FROM public.conversations AS c
    WHERE c.id = p_conversation_id AND c.project_id = p_project_id;
    IF v_conversation_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_CONVERSATION_NOT_FOUND';
    END IF;
  END IF;

  INSERT INTO public.messages (project_id, conversation_id, author_id, role, content)
  VALUES (p_project_id, v_conversation_id, p_actor_id, 'user', btrim(p_prompt))
  RETURNING id INTO v_message_id;

  INSERT INTO public.generation_jobs (
    user_id,
    project_id,
    conversation_id,
    input_message_id,
    routing_mode,
    requested_provider,
    requested_model,
    selected_provider,
    selected_model,
    status,
    idempotency_key,
    request_hash,
    reserved_credit_units,
    request_metadata
  ) VALUES (
    p_actor_id,
    p_project_id,
    v_conversation_id,
    v_message_id,
    p_routing_mode,
    p_requested_provider,
    p_requested_model,
    p_selected_provider,
    p_selected_model,
    'queued',
    p_idempotency_key,
    p_request_hash,
    p_reserved_credit_units,
    jsonb_build_object('capability', 'text-generation')
  ) RETURNING * INTO v_job;

  INSERT INTO public.provider_requests (
    job_id, user_id, provider, model, status, request_metadata
  ) VALUES (
    v_job.id,
    p_actor_id,
    p_selected_provider,
    p_selected_model,
    'pending',
    jsonb_build_object('capability', 'text-generation', 'routing_mode', p_routing_mode)
  );

  IF p_reserved_credit_units > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, project_id, job_id, delta, reason, idempotency_key
    ) VALUES (
      p_actor_id,
      p_project_id,
      v_job.id,
      -p_reserved_credit_units,
      'reservation',
      'generation-reserve:' || v_job.id::text
    );
  END IF;

  INSERT INTO public.audit_events (
    actor_id, project_id, job_id, event_type, target_type, target_id, result, policy_context
  ) VALUES (
    p_actor_id,
    p_project_id,
    v_job.id,
    'generation.submitted',
    'generation_job',
    v_job.id,
    'submitted',
    jsonb_build_object('authorization', 'project-writer', 'routing_mode', p_routing_mode)
  );

  RETURN QUERY SELECT v_job.id, v_conversation_id, true, v_job.status;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_create_generation_job(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_create_generation_job(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT
) TO service_role;

CREATE OR REPLACE FUNCTION public.xeomx_record_unavailable_generation(
  p_actor_id UUID,
  p_project_id UUID,
  p_conversation_id UUID,
  p_prompt TEXT,
  p_routing_mode TEXT,
  p_requested_provider TEXT,
  p_requested_model TEXT,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_error_category TEXT
)
RETURNS TABLE (job_id UUID, conversation_id UUID, created BOOLEAN, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_conversation_id UUID;
  v_message_id UUID;
  v_job public.generation_jobs%ROWTYPE;
  v_provider TEXT := COALESCE(NULLIF(p_requested_provider, ''), 'unavailable');
  v_model TEXT := COALESCE(NULLIF(p_requested_model, ''), 'unavailable');
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;
  IF p_error_category NOT IN ('PROVIDER_UNAVAILABLE', 'MODEL_UNAVAILABLE') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ERROR_CATEGORY';
  END IF;
  IF p_routing_mode NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ROUTING_MODE';
  END IF;
  IF char_length(btrim(p_prompt)) NOT BETWEEN 1 AND 50000
     OR char_length(p_idempotency_key) NOT BETWEEN 16 AND 200
     OR p_request_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_REQUEST';
  END IF;

  SELECT pm.role INTO v_role
  FROM public.project_members AS pm
  WHERE pm.project_id = p_project_id AND pm.user_id = p_actor_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROJECT_NOT_FOUND';
  END IF;
  IF v_role NOT IN ('owner', 'editor') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_actor_id::text || ':' || p_idempotency_key, 0)
  );
  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.user_id = p_actor_id AND gj.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_job.request_hash <> p_request_hash THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.conversation_id, false, v_job.status;
    RETURN;
  END IF;

  IF p_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      project_id, created_by, title, routing_mode, selected_provider, selected_model
    ) VALUES (
      p_project_id,
      p_actor_id,
      left(regexp_replace(btrim(p_prompt), '\s+', ' ', 'g'), 120),
      p_routing_mode,
      NULL,
      NULL
    ) RETURNING id INTO v_conversation_id;
  ELSE
    SELECT c.id INTO v_conversation_id
    FROM public.conversations AS c
    WHERE c.id = p_conversation_id AND c.project_id = p_project_id;
    IF v_conversation_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_CONVERSATION_NOT_FOUND';
    END IF;
  END IF;

  INSERT INTO public.messages (project_id, conversation_id, author_id, role, content)
  VALUES (p_project_id, v_conversation_id, p_actor_id, 'user', btrim(p_prompt))
  RETURNING id INTO v_message_id;

  INSERT INTO public.generation_jobs (
    user_id,
    project_id,
    conversation_id,
    input_message_id,
    routing_mode,
    requested_provider,
    requested_model,
    status,
    idempotency_key,
    request_hash,
    error_category,
    error_message,
    completed_at,
    request_metadata
  ) VALUES (
    p_actor_id,
    p_project_id,
    v_conversation_id,
    v_message_id,
    p_routing_mode,
    p_requested_provider,
    p_requested_model,
    'failed',
    p_idempotency_key,
    p_request_hash,
    p_error_category,
    'The requested provider or model is not configured.',
    now(),
    jsonb_build_object('capability', 'text-generation')
  ) RETURNING * INTO v_job;

  INSERT INTO public.provider_requests (
    job_id, user_id, provider, model, status, error_category, completed_at
  ) VALUES (
    v_job.id, p_actor_id, v_provider, v_model, 'unavailable', p_error_category, now()
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
    policy_context
  ) VALUES (
    p_actor_id,
    p_project_id,
    v_job.id,
    'generation.failed',
    'generation_job',
    v_job.id,
    'failed',
    p_error_category,
    jsonb_build_object('authorization', 'project-writer', 'charged', false)
  );

  RETURN QUERY SELECT v_job.id, v_conversation_id, true, v_job.status;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_record_unavailable_generation(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_record_unavailable_generation(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.xeomx_start_generation_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_JOB_NOT_FOUND';
  END IF;
  IF v_job.status = 'running' THEN
    RETURN true;
  END IF;
  IF v_job.status <> 'queued' THEN
    RETURN false;
  END IF;

  UPDATE public.generation_jobs
  SET status = 'running', started_at = COALESCE(started_at, now())
  WHERE id = p_job_id;
  UPDATE public.provider_requests
  SET status = 'running', started_at = COALESCE(started_at, now())
  WHERE job_id = p_job_id AND attempt = v_job.attempt_count;
  INSERT INTO public.audit_events (
    actor_id, project_id, job_id, event_type, target_type, target_id, result
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    'provider.requested',
    'provider_request',
    (SELECT pr.id FROM public.provider_requests AS pr
      WHERE pr.job_id = p_job_id AND pr.attempt = v_job.attempt_count),
    'submitted'
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_start_generation_job(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_start_generation_job(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.xeomx_complete_generation_job(
  p_job_id UUID,
  p_output_text TEXT,
  p_provider_request_identifier TEXT,
  p_input_units BIGINT,
  p_output_units BIGINT,
  p_estimated_cost_microunits BIGINT,
  p_actual_cost_microunits BIGINT,
  p_actual_credit_units BIGINT,
  p_usage_unavailable BOOLEAN,
  p_finish_reason TEXT
)
RETURNS TABLE (output_id UUID, asset_id UUID, message_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
  v_provider_request_id UUID;
  v_message_id UUID;
  v_asset_id UUID;
  v_output_id UUID;
  v_usage_id UUID;
  v_ledger_id UUID;
  v_release BIGINT;
BEGIN
  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_JOB_NOT_FOUND';
  END IF;
  IF v_job.status = 'succeeded' THEN
    RETURN QUERY
      SELECT go.id, go.asset_id, go.message_id
      FROM public.generation_outputs AS go
      WHERE go.job_id = p_job_id;
    RETURN;
  END IF;
  IF v_job.status NOT IN ('queued', 'running') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_INVALID_JOB_STATE';
  END IF;
  IF char_length(btrim(p_output_text)) NOT BETWEEN 1 AND 200000 THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_OUTPUT';
  END IF;
  IF p_actual_credit_units IS NULL
     OR p_usage_unavailable IS NULL
     OR p_actual_credit_units < 0
     OR p_actual_credit_units > v_job.reserved_credit_units THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_CREDIT_RECONCILIATION_REQUIRED';
  END IF;

  SELECT pr.id INTO v_provider_request_id
  FROM public.provider_requests AS pr
  WHERE pr.job_id = p_job_id AND pr.attempt = v_job.attempt_count;

  INSERT INTO public.messages (
    project_id,
    conversation_id,
    author_id,
    role,
    content,
    provider,
    model,
    generation_job_id
  ) VALUES (
    v_job.project_id,
    v_job.conversation_id,
    NULL,
    'assistant',
    btrim(p_output_text),
    v_job.selected_provider,
    v_job.selected_model,
    v_job.id
  ) RETURNING id INTO v_message_id;

  INSERT INTO public.assets (
    owner_id,
    project_id,
    generation_job_id,
    kind,
    origin,
    mime_type,
    status,
    metadata
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    'document',
    'generation',
    'text/plain',
    'ready',
    jsonb_build_object(
      'provider', v_job.selected_provider,
      'model', v_job.selected_model,
      'conversation_id', v_job.conversation_id
    )
  ) RETURNING id INTO v_asset_id;

  INSERT INTO public.generation_outputs (
    job_id,
    project_id,
    message_id,
    asset_id,
    output_text,
    provider,
    model,
    finish_reason
  ) VALUES (
    v_job.id,
    v_job.project_id,
    v_message_id,
    v_asset_id,
    btrim(p_output_text),
    v_job.selected_provider,
    v_job.selected_model,
    p_finish_reason
  ) RETURNING id INTO v_output_id;

  INSERT INTO public.usage_events (
    user_id,
    project_id,
    job_id,
    provider_request_id,
    provider,
    model,
    input_units,
    output_units,
    estimated_cost_microunits,
    actual_cost_microunits,
    usage_unavailable
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    v_provider_request_id,
    v_job.selected_provider,
    v_job.selected_model,
    p_input_units,
    p_output_units,
    p_estimated_cost_microunits,
    p_actual_cost_microunits,
    p_usage_unavailable
  ) RETURNING id INTO v_usage_id;

  INSERT INTO public.credit_ledger (
    user_id,
    project_id,
    job_id,
    usage_event_id,
    delta,
    reason,
    idempotency_key,
    metadata
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    v_usage_id,
    0,
    'consume',
    'generation-consume:' || v_job.id::text,
    jsonb_build_object('credit_units', p_actual_credit_units)
  ) RETURNING id INTO v_ledger_id;

  v_release := v_job.reserved_credit_units - p_actual_credit_units;
  IF v_release > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, project_id, job_id, usage_event_id, delta, reason, idempotency_key
    ) VALUES (
      v_job.user_id,
      v_job.project_id,
      v_job.id,
      v_usage_id,
      v_release,
      'release',
      'generation-release:' || v_job.id::text
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  UPDATE public.provider_requests
  SET
    status = 'succeeded',
    provider_request_id = NULLIF(p_provider_request_identifier, ''),
    response_metadata = jsonb_build_object('usage_available', NOT p_usage_unavailable),
    completed_at = now()
  WHERE id = v_provider_request_id;

  UPDATE public.generation_jobs
  SET
    status = 'succeeded',
    error_category = NULL,
    error_message = NULL,
    completed_at = now()
  WHERE id = v_job.id;

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
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    'generation.succeeded',
    'generation_output',
    v_output_id,
    'succeeded',
    jsonb_build_object('authorization', 'project-writer'),
    jsonb_build_object('usage_event_id', v_usage_id, 'asset_id', v_asset_id)
  );
  INSERT INTO public.audit_events (
    actor_id,
    project_id,
    job_id,
    event_type,
    target_type,
    target_id,
    result,
    metadata
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    'credit.changed',
    'credit_ledger',
    v_ledger_id,
    'succeeded',
    jsonb_build_object('charged_credit_units', p_actual_credit_units)
  );

  RETURN QUERY SELECT v_output_id, v_asset_id, v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_complete_generation_job(
  UUID, TEXT, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_complete_generation_job(
  UUID, TEXT, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BOOLEAN, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.xeomx_cancel_generation_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_job public.generation_jobs%ROWTYPE;
  v_role TEXT;
  v_release_ledger_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_JOB_NOT_FOUND';
  END IF;

  SELECT pm.role INTO v_role
  FROM public.project_members AS pm
  WHERE pm.project_id = v_job.project_id AND pm.user_id = v_actor;
  IF v_role IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_JOB_NOT_FOUND';
  END IF;
  IF v_job.user_id <> v_actor AND v_role <> 'owner' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_FORBIDDEN';
  END IF;
  IF v_job.status = 'cancelled' THEN
    RETURN true;
  END IF;
  IF v_job.status NOT IN ('queued', 'running') THEN
    RETURN false;
  END IF;

  UPDATE public.provider_requests
  SET status = 'cancelled', error_category = 'CANCELLED', completed_at = now()
  WHERE job_id = v_job.id AND attempt = v_job.attempt_count;

  UPDATE public.generation_jobs
  SET
    status = 'cancelled',
    error_category = 'CANCELLED',
    error_message = 'Generation was cancelled.',
    completed_at = now()
  WHERE id = v_job.id;

  IF v_job.reserved_credit_units > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, project_id, job_id, delta, reason, idempotency_key
    ) VALUES (
      v_job.user_id,
      v_job.project_id,
      v_job.id,
      v_job.reserved_credit_units,
      'release',
      'generation-cancel-release:' || v_job.id::text
    ) RETURNING id INTO v_release_ledger_id;

    INSERT INTO public.audit_events (
      actor_id, project_id, job_id, event_type, target_type, target_id, result, metadata
    ) VALUES (
      v_actor,
      v_job.project_id,
      v_job.id,
      'credit.changed',
      'credit_ledger',
      v_release_ledger_id,
      'succeeded',
      jsonb_build_object('released_credit_units', v_job.reserved_credit_units)
    );
  END IF;

  INSERT INTO public.audit_events (
    actor_id,
    project_id,
    job_id,
    event_type,
    target_type,
    target_id,
    result,
    error_category,
    policy_context
  ) VALUES (
    v_actor,
    v_job.project_id,
    v_job.id,
    'generation.cancelled',
    'generation_job',
    v_job.id,
    'cancelled',
    'CANCELLED',
    jsonb_build_object('authorization', v_role, 'charged', false)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_cancel_generation_job(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_cancel_generation_job(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.xeomx_fail_generation_job(
  p_job_id UUID,
  p_error_category TEXT,
  p_safe_error_message TEXT,
  p_provider_request_identifier TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.generation_jobs%ROWTYPE;
  v_release_key TEXT;
  v_release_ledger_id UUID;
BEGIN
  SELECT * INTO v_job
  FROM public.generation_jobs AS gj
  WHERE gj.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_JOB_NOT_FOUND';
  END IF;
  IF v_job.status = 'succeeded' THEN
    RETURN false;
  END IF;
  IF v_job.status = 'failed' THEN
    RETURN true;
  END IF;
  IF v_job.status = 'cancelled' THEN
    RETURN true;
  END IF;
  IF p_error_category NOT IN (
    'PROVIDER_UNAVAILABLE',
    'MODEL_UNAVAILABLE',
    'PROVIDER_TIMEOUT',
    'GENERATION_FAILED',
    'STORAGE_FAILED',
    'DATABASE_FAILED',
    'CANCELLED'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_VALIDATION_ERROR_CATEGORY';
  END IF;

  UPDATE public.provider_requests
  SET
    status = CASE WHEN p_error_category = 'CANCELLED' THEN 'cancelled' ELSE 'failed' END,
    provider_request_id = COALESCE(
      NULLIF(p_provider_request_identifier, ''),
      provider_request_id
    ),
    error_category = p_error_category,
    completed_at = now()
  WHERE job_id = v_job.id AND attempt = v_job.attempt_count;

  UPDATE public.generation_jobs
  SET
    status = CASE WHEN p_error_category = 'CANCELLED' THEN 'cancelled' ELSE 'failed' END,
    error_category = p_error_category,
    error_message = left(COALESCE(NULLIF(p_safe_error_message, ''), 'Generation failed.'), 500),
    completed_at = now()
  WHERE id = v_job.id;

  IF v_job.reserved_credit_units > 0 THEN
    v_release_key := 'generation-failure-release:' || v_job.id::text;
    INSERT INTO public.credit_ledger (
      user_id, project_id, job_id, delta, reason, idempotency_key
    ) VALUES (
      v_job.user_id,
      v_job.project_id,
      v_job.id,
      v_job.reserved_credit_units,
      'release',
      v_release_key
    ) RETURNING id INTO v_release_ledger_id;

    INSERT INTO public.audit_events (
      actor_id, project_id, job_id, event_type, target_type, target_id, result, metadata
    ) VALUES (
      v_job.user_id,
      v_job.project_id,
      v_job.id,
      'credit.changed',
      'credit_ledger',
      v_release_ledger_id,
      'succeeded',
      jsonb_build_object('released_credit_units', v_job.reserved_credit_units)
    );
  END IF;

  INSERT INTO public.audit_events (
    actor_id,
    project_id,
    job_id,
    event_type,
    target_type,
    target_id,
    result,
    error_category,
    policy_context
  ) VALUES (
    v_job.user_id,
    v_job.project_id,
    v_job.id,
    CASE WHEN p_error_category = 'CANCELLED'
      THEN 'generation.cancelled'
      ELSE 'generation.failed'
    END,
    'generation_job',
    v_job.id,
    CASE WHEN p_error_category = 'CANCELLED' THEN 'cancelled' ELSE 'failed' END,
    p_error_category,
    jsonb_build_object('authorization', 'project-writer', 'charged', false)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_fail_generation_job(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_fail_generation_job(UUID, TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;
