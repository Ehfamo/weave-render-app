-- XEOMX Stage 5.3: Dataset, eval, benchmark, experiment and evidence foundation.
-- Source-only migration. Apply only to the isolated staging project after review.
-- Provider-backed eval compute is deliberately not connected by this migration.
-- Transaction ownership belongs to Supabase apply_migration.

-- -----------------------------------------------------------------------------
-- Dataset registry, immutable versions and version-scoped items
-- -----------------------------------------------------------------------------

CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (
    name = btrim(name) AND char_length(name) BETWEEN 1 AND 120
  ),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, project_id)
);

CREATE UNIQUE INDEX datasets_project_name_active_uidx
  ON public.datasets(project_id, lower(name))
  WHERE status <> 'archived';
CREATE INDEX datasets_project_updated_idx
  ON public.datasets(project_id, updated_at DESC);
CREATE INDEX datasets_created_by_idx
  ON public.datasets(created_by, created_at DESC);

CREATE TABLE public.dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'validating', 'valid', 'invalid', 'failed')),
  schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(schema_definition) = 'object'),
  content_sha256 TEXT CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(validation_summary) = 'object'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dataset_versions_dataset_fk
    FOREIGN KEY (dataset_id, project_id)
    REFERENCES public.datasets(id, project_id) ON DELETE CASCADE,
  CONSTRAINT dataset_versions_finalization_check CHECK (
    (state IN ('draft', 'validating') AND finalized_at IS NULL)
    OR
    (state IN ('valid', 'invalid', 'failed')
      AND finalized_at IS NOT NULL
      AND content_sha256 IS NOT NULL)
  ),
  UNIQUE (dataset_id, version_number),
  UNIQUE (id, project_id),
  UNIQUE (id, dataset_id, project_id)
);

CREATE INDEX dataset_versions_project_created_idx
  ON public.dataset_versions(project_id, created_at DESC);
CREATE INDEX dataset_versions_dataset_created_idx
  ON public.dataset_versions(dataset_id, created_at DESC);
CREATE INDEX dataset_versions_created_by_idx
  ON public.dataset_versions(created_by, created_at DESC);
CREATE INDEX dataset_versions_open_idx
  ON public.dataset_versions(dataset_id, updated_at DESC)
  WHERE state IN ('draft', 'validating');

CREATE TABLE public.dataset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  external_key TEXT NOT NULL CHECK (
    external_key = btrim(external_key) AND char_length(external_key) BETWEEN 1 AND 200
  ),
  position INTEGER NOT NULL CHECK (position >= 0),
  input JSONB NOT NULL CHECK (jsonb_typeof(input) <> 'null'),
  expected_output JSONB,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  validation_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_state IN ('pending', 'valid', 'invalid')),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(validation_errors) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dataset_items_version_fk
    FOREIGN KEY (dataset_version_id, dataset_id, project_id)
    REFERENCES public.dataset_versions(id, dataset_id, project_id) ON DELETE CASCADE,
  UNIQUE (dataset_version_id, external_key),
  UNIQUE (dataset_version_id, position)
);

CREATE INDEX dataset_items_project_idx
  ON public.dataset_items(project_id, created_at DESC);
CREATE INDEX dataset_items_dataset_idx
  ON public.dataset_items(dataset_id, created_at ASC);
CREATE INDEX dataset_items_version_idx
  ON public.dataset_items(dataset_version_id, position ASC);
CREATE INDEX dataset_items_created_by_idx
  ON public.dataset_items(created_by, created_at DESC);
CREATE INDEX dataset_items_invalid_idx
  ON public.dataset_items(dataset_version_id, position ASC)
  WHERE validation_state = 'invalid';

-- -----------------------------------------------------------------------------
-- Eval definitions, experiments, benchmarks and execution state
-- -----------------------------------------------------------------------------

CREATE TABLE public.eval_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (
    name = btrim(name) AND char_length(name) BETWEEN 1 AND 120
  ),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  evaluator_kind TEXT NOT NULL CHECK (
    evaluator_kind IN ('exact_match', 'contains', 'json_schema', 'llm_judge', 'custom')
  ),
  provider_requirement TEXT NOT NULL DEFAULT 'none'
    CHECK (provider_requirement IN ('none', 'optional', 'required')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (evaluator_kind <> 'llm_judge' OR provider_requirement = 'required'),
  UNIQUE (id, project_id)
);

CREATE UNIQUE INDEX eval_definitions_project_name_active_uidx
  ON public.eval_definitions(project_id, lower(name))
  WHERE status <> 'archived';
CREATE INDEX eval_definitions_project_updated_idx
  ON public.eval_definitions(project_id, updated_at DESC);
CREATE INDEX eval_definitions_created_by_idx
  ON public.eval_definitions(created_by, created_at DESC);

CREATE TABLE public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (
    name = btrim(name) AND char_length(name) BETWEEN 1 AND 160
  ),
  hypothesis TEXT CHECK (hypothesis IS NULL OR char_length(hypothesis) <= 8000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'completed', 'failed', 'cancelled')),
  control_config JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(control_config) = 'object'),
  candidate_config JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(candidate_config) = 'object'),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary) = 'object'),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT experiments_timestamp_check CHECK (
    (status = 'draft' AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL)
  ),
  UNIQUE (id, project_id)
);

CREATE INDEX experiments_project_updated_idx
  ON public.experiments(project_id, updated_at DESC);
CREATE INDEX experiments_created_by_idx
  ON public.experiments(created_by, created_at DESC);
CREATE INDEX experiments_active_idx
  ON public.experiments(project_id, updated_at DESC)
  WHERE status IN ('draft', 'running');

CREATE TABLE public.benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  dataset_version_id UUID NOT NULL,
  eval_definition_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (
    name = btrim(name) AND char_length(name) BETWEEN 1 AND 160
  ),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  pass_threshold NUMERIC(8, 6) NOT NULL DEFAULT 0
    CHECK (pass_threshold BETWEEN 0 AND 1),
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT benchmarks_dataset_version_fk
    FOREIGN KEY (dataset_version_id, project_id)
    REFERENCES public.dataset_versions(id, project_id) ON DELETE RESTRICT,
  CONSTRAINT benchmarks_eval_definition_fk
    FOREIGN KEY (eval_definition_id, project_id)
    REFERENCES public.eval_definitions(id, project_id) ON DELETE RESTRICT,
  UNIQUE (id, project_id)
);

CREATE UNIQUE INDEX benchmarks_project_name_active_uidx
  ON public.benchmarks(project_id, lower(name))
  WHERE status <> 'archived';
CREATE INDEX benchmarks_project_updated_idx
  ON public.benchmarks(project_id, updated_at DESC);
CREATE INDEX benchmarks_dataset_version_idx
  ON public.benchmarks(dataset_version_id, project_id);
CREATE INDEX benchmarks_eval_definition_idx
  ON public.benchmarks(eval_definition_id, project_id);
CREATE INDEX benchmarks_created_by_idx
  ON public.benchmarks(created_by, created_at DESC);

CREATE TABLE public.eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  eval_definition_id UUID NOT NULL,
  dataset_version_id UUID NOT NULL,
  experiment_id UUID,
  experiment_arm TEXT CHECK (
    experiment_arm IS NULL OR char_length(experiment_arm) BETWEEN 1 AND 80
  ),
  benchmark_id UUID,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'blocked')),
  compute_mode TEXT NOT NULL DEFAULT 'local'
    CHECK (compute_mode IN ('local', 'provider')),
  provider_status TEXT NOT NULL DEFAULT 'not_required' CHECK (
    provider_status IN ('not_required', 'disconnected', 'configured', 'verified', 'failed')
  ),
  provider TEXT CHECK (provider IS NULL OR char_length(provider) BETWEEN 1 AND 100),
  model TEXT CHECK (model IS NULL OR char_length(model) BETWEEN 1 AND 200),
  idempotency_key TEXT NOT NULL
    CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  passed_items INTEGER NOT NULL DEFAULT 0 CHECK (passed_items >= 0),
  failed_items INTEGER NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
  score NUMERIC(8, 6) CHECK (score IS NULL OR score BETWEEN 0 AND 1),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary) = 'object'),
  error_code TEXT CHECK (error_code IS NULL OR char_length(error_code) <= 100),
  error_message TEXT CHECK (error_message IS NULL OR char_length(error_message) <= 500),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT eval_runs_definition_fk
    FOREIGN KEY (eval_definition_id, project_id)
    REFERENCES public.eval_definitions(id, project_id) ON DELETE RESTRICT,
  CONSTRAINT eval_runs_dataset_version_fk
    FOREIGN KEY (dataset_version_id, project_id)
    REFERENCES public.dataset_versions(id, project_id) ON DELETE RESTRICT,
  CONSTRAINT eval_runs_experiment_fk
    FOREIGN KEY (experiment_id, project_id)
    REFERENCES public.experiments(id, project_id) ON DELETE RESTRICT,
  CONSTRAINT eval_runs_benchmark_fk
    FOREIGN KEY (benchmark_id, project_id)
    REFERENCES public.benchmarks(id, project_id) ON DELETE RESTRICT,
  CONSTRAINT eval_runs_counts_check CHECK (passed_items + failed_items <= total_items),
  CONSTRAINT eval_runs_compute_check CHECK (
    (compute_mode = 'local'
      AND provider IS NULL
      AND model IS NULL
      AND provider_status = 'not_required')
    OR
    (compute_mode = 'provider'
      AND provider IS NOT NULL
      AND model IS NOT NULL
      AND provider_status IN ('disconnected', 'configured', 'verified', 'failed'))
  ),
  CONSTRAINT eval_runs_experiment_arm_presence_check CHECK (
    (experiment_id IS NULL AND experiment_arm IS NULL)
    OR (experiment_id IS NOT NULL AND experiment_arm IS NOT NULL)
  ),
  CONSTRAINT eval_runs_timestamp_check CHECK (
    (status = 'queued' AND started_at IS NULL AND completed_at IS NULL)
    OR (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed', 'cancelled', 'blocked') AND completed_at IS NOT NULL)
  ),
  UNIQUE (project_id, idempotency_key),
  UNIQUE (id, project_id)
);

CREATE INDEX eval_runs_project_created_idx
  ON public.eval_runs(project_id, created_at DESC);
CREATE INDEX eval_runs_definition_idx
  ON public.eval_runs(eval_definition_id, project_id, created_at DESC);
CREATE INDEX eval_runs_dataset_version_idx
  ON public.eval_runs(dataset_version_id, project_id, created_at DESC);
CREATE INDEX eval_runs_experiment_idx
  ON public.eval_runs(experiment_id, project_id, created_at DESC)
  WHERE experiment_id IS NOT NULL;
CREATE INDEX eval_runs_benchmark_idx
  ON public.eval_runs(benchmark_id, project_id, created_at DESC)
  WHERE benchmark_id IS NOT NULL;
CREATE INDEX eval_runs_created_by_idx
  ON public.eval_runs(created_by, created_at DESC);
CREATE INDEX eval_runs_active_idx
  ON public.eval_runs(project_id, created_at ASC)
  WHERE status IN ('queued', 'running');

CREATE TABLE public.benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  benchmark_id UUID NOT NULL,
  eval_run_id UUID NOT NULL,
  score NUMERIC(8, 6) NOT NULL CHECK (score BETWEEN 0 AND 1),
  passed BOOLEAN NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT benchmark_results_benchmark_fk
    FOREIGN KEY (benchmark_id, project_id)
    REFERENCES public.benchmarks(id, project_id) ON DELETE CASCADE,
  CONSTRAINT benchmark_results_eval_run_fk
    FOREIGN KEY (eval_run_id, project_id)
    REFERENCES public.eval_runs(id, project_id) ON DELETE RESTRICT,
  UNIQUE (benchmark_id, eval_run_id),
  UNIQUE (id, project_id)
);

CREATE INDEX benchmark_results_project_recorded_idx
  ON public.benchmark_results(project_id, recorded_at DESC);
CREATE INDEX benchmark_results_benchmark_idx
  ON public.benchmark_results(benchmark_id, project_id, recorded_at DESC);
CREATE INDEX benchmark_results_eval_run_idx
  ON public.benchmark_results(eval_run_id, project_id);
CREATE INDEX benchmark_results_created_by_idx
  ON public.benchmark_results(created_by, recorded_at DESC);

-- -----------------------------------------------------------------------------
-- Evidence records, subject links and append-only provenance
-- -----------------------------------------------------------------------------

CREATE TABLE public.evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (
    kind IN ('dataset_validation', 'eval_run', 'benchmark', 'experiment',
      'security', 'quality', 'manual')
  ),
  subject_type TEXT NOT NULL CHECK (
    subject_type IN ('dataset', 'dataset_version', 'eval_definition', 'eval_run',
      'experiment', 'benchmark', 'benchmark_result', 'project', 'external')
  ),
  subject_id UUID,
  title TEXT NOT NULL CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 1 AND 200
  ),
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 8000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'verified', 'rejected')),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'draft' AND finalized_at IS NULL)
    OR (status IN ('verified', 'rejected') AND finalized_at IS NOT NULL)
  ),
  UNIQUE (id, project_id)
);

CREATE INDEX evidence_records_project_created_idx
  ON public.evidence_records(project_id, created_at DESC);
CREATE INDEX evidence_records_subject_idx
  ON public.evidence_records(project_id, subject_type, subject_id, created_at DESC);
CREATE INDEX evidence_records_created_by_idx
  ON public.evidence_records(created_by, created_at DESC);
CREATE INDEX evidence_records_draft_idx
  ON public.evidence_records(project_id, updated_at DESC)
  WHERE status = 'draft';

CREATE TABLE public.evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evidence_record_id UUID NOT NULL,
  relationship TEXT NOT NULL CHECK (
    relationship IN ('supports', 'derived_from', 'supersedes', 'validates', 'references')
  ),
  target_type TEXT NOT NULL CHECK (
    target_type IN ('dataset', 'dataset_version', 'eval_definition', 'eval_run',
      'experiment', 'benchmark', 'benchmark_result', 'evidence_record',
      'project', 'external')
  ),
  target_id UUID,
  target_locator TEXT CHECK (
    target_locator IS NULL OR char_length(target_locator) BETWEEN 1 AND 2000
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evidence_links_record_fk
    FOREIGN KEY (evidence_record_id, project_id)
    REFERENCES public.evidence_records(id, project_id) ON DELETE CASCADE,
  CHECK (target_id IS NOT NULL OR target_locator IS NOT NULL),
  UNIQUE (evidence_record_id, relationship, target_type, target_id, target_locator)
);

CREATE INDEX evidence_links_project_created_idx
  ON public.evidence_links(project_id, created_at DESC);
CREATE INDEX evidence_links_record_idx
  ON public.evidence_links(evidence_record_id, project_id, created_at ASC);
CREATE INDEX evidence_links_target_idx
  ON public.evidence_links(project_id, target_type, target_id)
  WHERE target_id IS NOT NULL;
CREATE INDEX evidence_links_created_by_idx
  ON public.evidence_links(created_by, created_at DESC);

CREATE TABLE public.evidence_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evidence_record_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('dataset', 'eval_run', 'benchmark', 'experiment',
      'provider', 'file', 'url', 'manual', 'system')
  ),
  source_locator TEXT NOT NULL
    CHECK (char_length(source_locator) BETWEEN 1 AND 2000),
  source_sha256 TEXT CHECK (
    source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'
  ),
  collector TEXT NOT NULL CHECK (char_length(collector) BETWEEN 1 AND 200),
  captured_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evidence_provenance_record_fk
    FOREIGN KEY (evidence_record_id, project_id)
    REFERENCES public.evidence_records(id, project_id) ON DELETE CASCADE
);

CREATE INDEX evidence_provenance_project_created_idx
  ON public.evidence_provenance(project_id, created_at DESC);
CREATE INDEX evidence_provenance_record_idx
  ON public.evidence_provenance(evidence_record_id, project_id, captured_at ASC);
CREATE INDEX evidence_provenance_created_by_idx
  ON public.evidence_provenance(created_by, created_at DESC);
CREATE INDEX evidence_provenance_source_hash_idx
  ON public.evidence_provenance(source_sha256)
  WHERE source_sha256 IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Trigger-only helpers. None is browser-callable; direct EXECUTE is revoked.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.xeomx_evidence_json_has_secret_key(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH RECURSIVE walk(value) AS (
    SELECT p_value
    UNION ALL
    SELECT child.value
    FROM walk
    CROSS JOIN LATERAL (
      SELECT element.value
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END
      ) AS element(value)
      UNION ALL
      SELECT member.value
      FROM jsonb_each(
        CASE WHEN jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END
      ) AS member(key, value)
    ) AS child
  )
  SELECT EXISTS (
    SELECT 1
    FROM walk
    CROSS JOIN LATERAL jsonb_object_keys(
      CASE WHEN jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END
    ) AS object_key(key)
    WHERE lower(regexp_replace(object_key.key, '[^a-z0-9]+', '', 'g')) = ANY (ARRAY[
      'password', 'passwd', 'pwd', 'secret', 'clientsecret', 'oauthsecret',
      'token', 'accesstoken', 'refreshtoken', 'authtoken', 'bearertoken',
      'apikey', 'providerapikey', 'servicerole', 'servicerolekey',
      'privatekey', 'signingkey', 'credential', 'credentials',
      'authorization', 'cookie', 'rawpayload', 'webhooksignature'
    ])
      OR lower(regexp_replace(object_key.key, '[^a-z0-9]+', '', 'g')) ~
        '(secret|password|apikey|servicerole|privatekey|signingkey|credential|authorization|cookie|rawpayload|webhooksignature|token$)'
  )
$$;

REVOKE ALL ON FUNCTION public.xeomx_evidence_json_has_secret_key(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_json_has_secret_key(JSONB)
  TO authenticated, service_role;

ALTER TABLE public.datasets
  ADD CONSTRAINT datasets_metadata_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(metadata));
ALTER TABLE public.dataset_versions
  ADD CONSTRAINT dataset_versions_schema_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(schema_definition)),
  ADD CONSTRAINT dataset_versions_validation_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(validation_summary)),
  ADD CONSTRAINT dataset_versions_metadata_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(metadata));
ALTER TABLE public.dataset_items
  ADD CONSTRAINT dataset_items_input_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(input)),
  ADD CONSTRAINT dataset_items_expected_no_secrets
    CHECK (expected_output IS NULL OR NOT public.xeomx_evidence_json_has_secret_key(expected_output)),
  ADD CONSTRAINT dataset_items_validation_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(validation_errors)),
  ADD CONSTRAINT dataset_items_metadata_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(metadata));
ALTER TABLE public.eval_definitions
  ADD CONSTRAINT eval_definitions_config_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(config));
ALTER TABLE public.experiments
  ADD CONSTRAINT experiments_control_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(control_config)),
  ADD CONSTRAINT experiments_candidate_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(candidate_config)),
  ADD CONSTRAINT experiments_summary_no_secrets
    CHECK (NOT public.xeomx_evidence_json_has_secret_key(summary));
ALTER TABLE public.benchmarks
  ADD CONSTRAINT benchmarks_config_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(config));
ALTER TABLE public.eval_runs
  ADD CONSTRAINT eval_runs_summary_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(summary));
ALTER TABLE public.benchmark_results
  ADD CONSTRAINT benchmark_results_metrics_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(metrics));
ALTER TABLE public.evidence_records
  ADD CONSTRAINT evidence_records_payload_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(payload));
ALTER TABLE public.evidence_links
  ADD CONSTRAINT evidence_links_metadata_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(metadata));
ALTER TABLE public.evidence_provenance
  ADD CONSTRAINT evidence_provenance_metadata_no_secrets
  CHECK (NOT public.xeomx_evidence_json_has_secret_key(metadata));

CREATE OR REPLACE FUNCTION public.xeomx_evidence_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_guard_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVIDENCE_IMMUTABLE_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_guard_dataset_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item_count INTEGER;
  v_invalid_count INTEGER;
BEGIN
  IF NEW.dataset_id IS DISTINCT FROM OLD.dataset_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_VERSION_IDENTITY_IMMUTABLE';
  END IF;
  IF OLD.state IN ('valid', 'invalid', 'failed') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_VERSION_IMMUTABLE';
  END IF;
  IF NOT (
    (OLD.state = 'draft' AND NEW.state IN ('draft', 'validating', 'invalid', 'failed'))
    OR (OLD.state = 'validating' AND NEW.state IN ('validating', 'valid', 'invalid', 'failed'))
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_VERSION_STATE_INVALID';
  END IF;

  IF NEW.state IN ('valid', 'invalid', 'failed') THEN
    SELECT count(*)::INTEGER,
           count(*) FILTER (WHERE di.validation_state = 'invalid')::INTEGER
      INTO v_item_count, v_invalid_count
    FROM public.dataset_items AS di
    WHERE di.dataset_version_id = OLD.id;
    NEW.item_count := v_item_count;
    IF NEW.state = 'valid' AND v_invalid_count > 0 THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_VERSION_HAS_INVALID_ITEMS';
    END IF;
    IF NEW.content_sha256 IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_VERSION_HASH_REQUIRED';
    END IF;
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
  ELSE
    NEW.finalized_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_guard_dataset_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version_id UUID := COALESCE(NEW.dataset_version_id, OLD.dataset_version_id);
  v_state TEXT;
BEGIN
  SELECT dv.state INTO v_state
  FROM public.dataset_versions AS dv
  WHERE dv.id = v_version_id
  FOR SHARE;
  IF v_state IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_VERSION_IMMUTABLE';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.dataset_version_id IS DISTINCT FROM OLD.dataset_version_id
    OR NEW.dataset_id IS DISTINCT FROM OLD.dataset_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_DATASET_ITEM_IDENTITY_IMMUTABLE';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_guard_eval_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.eval_definition_id IS DISTINCT FROM OLD.eval_definition_id
     OR NEW.dataset_version_id IS DISTINCT FROM OLD.dataset_version_id
     OR NEW.experiment_id IS DISTINCT FROM OLD.experiment_id
     OR NEW.benchmark_id IS DISTINCT FROM OLD.benchmark_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.compute_mode IS DISTINCT FROM OLD.compute_mode
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.model IS DISTINCT FROM OLD.model THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVAL_RUN_IDENTITY_IMMUTABLE';
  END IF;
  IF OLD.status IN ('succeeded', 'failed', 'cancelled', 'blocked') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVAL_RUN_IMMUTABLE';
  END IF;
  IF NOT (
    (OLD.status = 'queued' AND NEW.status IN ('queued', 'running', 'failed', 'cancelled', 'blocked'))
    OR (OLD.status = 'running' AND NEW.status IN ('running', 'succeeded', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVAL_RUN_STATE_INVALID';
  END IF;
  IF NEW.status = 'running' THEN
    IF NEW.compute_mode = 'provider' AND NEW.provider_status <> 'verified' THEN
      RAISE EXCEPTION USING MESSAGE = 'XEOMX_PROVIDER_COMPUTE_DISCONNECTED';
    END IF;
    NEW.started_at := COALESCE(OLD.started_at, NEW.started_at, now());
    NEW.completed_at := NULL;
  ELSIF NEW.status IN ('succeeded', 'failed', 'cancelled', 'blocked') THEN
    NEW.started_at := COALESCE(OLD.started_at, NEW.started_at);
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  IF NEW.status = 'succeeded' AND (
    NEW.score IS NULL OR NEW.passed_items + NEW.failed_items <> NEW.total_items
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVAL_RUN_RESULT_INVALID';
  END IF;
  IF NEW.status IN ('failed', 'blocked') AND NEW.error_code IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVAL_RUN_ERROR_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_guard_experiment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EXPERIMENT_IMMUTABLE';
  END IF;
  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('draft', 'running', 'failed', 'cancelled'))
    OR (OLD.status = 'running' AND NEW.status IN ('running', 'completed', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EXPERIMENT_STATE_INVALID';
  END IF;
  IF NEW.status = 'running' THEN
    NEW.started_at := COALESCE(OLD.started_at, NEW.started_at, now());
    NEW.completed_at := NULL;
  ELSIF NEW.status IN ('completed', 'failed', 'cancelled') THEN
    NEW.started_at := COALESCE(OLD.started_at, NEW.started_at);
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_guard_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
     OR NEW.subject_id IS DISTINCT FROM OLD.subject_id THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVIDENCE_SUBJECT_IMMUTABLE';
  END IF;
  IF OLD.status IN ('verified', 'rejected') THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVIDENCE_RECORD_IMMUTABLE';
  END IF;
  IF NOT (OLD.status = 'draft' AND NEW.status IN ('draft', 'verified', 'rejected')) THEN
    RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVIDENCE_STATE_INVALID';
  END IF;
  IF NEW.status IN ('verified', 'rejected') THEN
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
  ELSE
    NEW.finalized_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_reject_append_only_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'XEOMX_EVIDENCE_APPEND_ONLY';
END;
$$;

CREATE OR REPLACE FUNCTION public.xeomx_evidence_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_actor UUID := (SELECT auth.uid());
  v_project_id UUID;
  v_target_id UUID;
BEGIN
  v_project_id := NULLIF(v_row->>'project_id', '')::UUID;
  v_target_id := NULLIF(v_row->>'id', '')::UUID;
  IF v_actor IS NULL THEN
    v_actor := NULLIF(v_row->>'created_by', '')::UUID;
  END IF;
  INSERT INTO public.audit_events (
    actor_id,
    project_id,
    event_type,
    target_type,
    target_id,
    result,
    policy_context,
    metadata
  ) VALUES (
    v_actor,
    v_project_id,
    'evidence.' || TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    v_target_id,
    'succeeded',
    jsonb_build_object(
      'authorization', CASE WHEN (SELECT auth.uid()) IS NULL
        THEN 'trusted-service' ELSE 'project-writer-rls' END
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'operation', lower(TG_OP),
      'state', COALESCE(v_row->>'state', v_row->>'status'),
      'version_number', v_row->>'version_number'
    ))
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_evidence_set_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_guard_identity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_guard_dataset_version()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_guard_dataset_item()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_guard_eval_run()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_guard_experiment()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_guard_record()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_reject_append_only_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xeomx_evidence_audit_change()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.xeomx_evidence_set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_guard_identity() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_guard_dataset_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_guard_dataset_item() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_guard_eval_run() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_guard_experiment() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_guard_record() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_reject_append_only_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_evidence_audit_change() TO service_role;

-- Timestamp and immutable-identity triggers.
CREATE TRIGGER a_datasets_set_updated_at BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_datasets_guard_identity BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER a_dataset_versions_set_updated_at BEFORE UPDATE ON public.dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_dataset_versions_guard_identity BEFORE UPDATE ON public.dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER c_dataset_versions_guard_state BEFORE UPDATE ON public.dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_dataset_version();
CREATE TRIGGER a_dataset_items_set_updated_at BEFORE UPDATE ON public.dataset_items
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_dataset_items_guard_draft
  BEFORE INSERT OR UPDATE OR DELETE ON public.dataset_items
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_dataset_item();
CREATE TRIGGER a_eval_definitions_set_updated_at BEFORE UPDATE ON public.eval_definitions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_eval_definitions_guard_identity BEFORE UPDATE ON public.eval_definitions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER a_experiments_set_updated_at BEFORE UPDATE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_experiments_guard_identity BEFORE UPDATE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER c_experiments_guard_state BEFORE UPDATE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_experiment();
CREATE TRIGGER a_benchmarks_set_updated_at BEFORE UPDATE ON public.benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_benchmarks_guard_identity BEFORE UPDATE ON public.benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER a_eval_runs_set_updated_at BEFORE UPDATE ON public.eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_eval_runs_guard_identity BEFORE UPDATE ON public.eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER c_eval_runs_guard_state BEFORE UPDATE ON public.eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_eval_run();
CREATE TRIGGER a_evidence_records_set_updated_at BEFORE UPDATE ON public.evidence_records
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_set_updated_at();
CREATE TRIGGER b_evidence_records_guard_identity BEFORE UPDATE ON public.evidence_records
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_identity();
CREATE TRIGGER c_evidence_records_guard_state BEFORE UPDATE ON public.evidence_records
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_guard_record();

CREATE TRIGGER benchmark_results_append_only
  BEFORE UPDATE OR DELETE ON public.benchmark_results
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_reject_append_only_change();
CREATE TRIGGER evidence_links_append_only
  BEFORE UPDATE OR DELETE ON public.evidence_links
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_reject_append_only_change();
CREATE TRIGGER evidence_provenance_append_only
  BEFORE UPDATE OR DELETE ON public.evidence_provenance
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_reject_append_only_change();

-- Object-level audit. Dataset item history is represented by the immutable
-- version hash/count instead of producing one audit event per imported item.
CREATE TRIGGER datasets_audit AFTER INSERT OR UPDATE OR DELETE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER dataset_versions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER eval_definitions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.eval_definitions
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER experiments_audit AFTER INSERT OR UPDATE OR DELETE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER benchmarks_audit AFTER INSERT OR UPDATE OR DELETE ON public.benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER eval_runs_audit AFTER INSERT OR UPDATE OR DELETE ON public.eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER benchmark_results_audit AFTER INSERT ON public.benchmark_results
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER evidence_records_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.evidence_records
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER evidence_links_audit AFTER INSERT ON public.evidence_links
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();
CREATE TRIGGER evidence_provenance_audit AFTER INSERT ON public.evidence_provenance
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_evidence_audit_change();

-- -----------------------------------------------------------------------------
-- RLS: project members read; owner/editor write; compute/result writes trusted.
-- -----------------------------------------------------------------------------

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view datasets" ON public.datasets
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = datasets.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create datasets" ON public.datasets
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = datasets.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );
CREATE POLICY "Project writers can update datasets" ON public.datasets
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = datasets.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = datasets.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Project members can view dataset versions" ON public.dataset_versions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = dataset_versions.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create dataset versions" ON public.dataset_versions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND state = 'draft' AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = dataset_versions.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Project members can view dataset items" ON public.dataset_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = dataset_items.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create draft dataset items" ON public.dataset_items
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = dataset_items.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    ) AND EXISTS (
      SELECT 1 FROM public.dataset_versions AS dv
      WHERE dv.id = dataset_items.dataset_version_id AND dv.state = 'draft'
    )
  );
CREATE POLICY "Project writers can update draft dataset items" ON public.dataset_items
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = dataset_items.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ) AND EXISTS (
    SELECT 1 FROM public.dataset_versions AS dv
    WHERE dv.id = dataset_items.dataset_version_id AND dv.state = 'draft'
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = dataset_items.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ) AND EXISTS (
    SELECT 1 FROM public.dataset_versions AS dv
    WHERE dv.id = dataset_items.dataset_version_id AND dv.state = 'draft'
  ));
CREATE POLICY "Project writers can delete draft dataset items" ON public.dataset_items
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = dataset_items.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ) AND EXISTS (
    SELECT 1 FROM public.dataset_versions AS dv
    WHERE dv.id = dataset_items.dataset_version_id AND dv.state = 'draft'
  ));

CREATE POLICY "Project members can view eval definitions" ON public.eval_definitions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = eval_definitions.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create eval definitions" ON public.eval_definitions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = eval_definitions.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );
CREATE POLICY "Project writers can update eval definitions" ON public.eval_definitions
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = eval_definitions.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = eval_definitions.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Project members can view experiments" ON public.experiments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = experiments.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create experiments" ON public.experiments
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND status = 'draft' AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = experiments.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );
CREATE POLICY "Project writers can update experiments" ON public.experiments
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = experiments.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = experiments.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Project members can view benchmarks" ON public.benchmarks
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = benchmarks.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create benchmarks" ON public.benchmarks
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND status = 'draft' AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = benchmarks.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );
CREATE POLICY "Project writers can update benchmarks" ON public.benchmarks
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = benchmarks.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = benchmarks.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Project members can view eval runs" ON public.eval_runs
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = eval_runs.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can queue eval runs" ON public.eval_runs
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid())
    AND status = 'queued'
    AND total_items = 0 AND passed_items = 0 AND failed_items = 0 AND score IS NULL
    AND summary = '{}'::jsonb AND error_code IS NULL AND error_message IS NULL
    -- Provider verification is a trusted-service transition. A browser client
    -- may describe a disconnected provider request, but it cannot self-attest
    -- configured/verified provider status at insert time.
    AND (
      compute_mode = 'local'
      OR (compute_mode = 'provider' AND provider_status = 'disconnected')
    )
    AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = eval_runs.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Project members can view benchmark results" ON public.benchmark_results
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = benchmark_results.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Project members can view evidence records" ON public.evidence_records
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = evidence_records.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create evidence records" ON public.evidence_records
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND status = 'draft' AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = evidence_records.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );
CREATE POLICY "Project writers can update draft evidence records" ON public.evidence_records
  FOR UPDATE TO authenticated USING (
    status = 'draft' AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = evidence_records.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  ) WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = evidence_records.project_id
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Project members can view evidence links" ON public.evidence_links
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = evidence_links.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create evidence links" ON public.evidence_links
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = evidence_links.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Project members can view evidence provenance" ON public.evidence_provenance
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.project_members AS pm
    WHERE pm.project_id = evidence_provenance.project_id
      AND pm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Project writers can create evidence provenance" ON public.evidence_provenance
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.project_members AS pm
      WHERE pm.project_id = evidence_provenance.project_id
        AND pm.user_id = (SELECT auth.uid())
        AND pm.role IN ('owner', 'editor')
    )
  );

-- Explicit Data API privileges. Anonymous users receive no access.
REVOKE ALL ON public.datasets, public.dataset_versions, public.dataset_items,
  public.eval_definitions, public.experiments, public.benchmarks, public.eval_runs,
  public.benchmark_results, public.evidence_records, public.evidence_links,
  public.evidence_provenance FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.datasets, public.dataset_versions, public.dataset_items,
  public.eval_definitions, public.experiments, public.benchmarks, public.eval_runs,
  public.benchmark_results, public.evidence_records, public.evidence_links,
  public.evidence_provenance TO authenticated;

GRANT INSERT (project_id, created_by, name, description, status, metadata)
  ON public.datasets TO authenticated;
GRANT UPDATE (name, description, status, metadata)
  ON public.datasets TO authenticated;
GRANT INSERT (
  dataset_id, project_id, created_by, version_number, state,
  schema_definition, content_sha256, metadata
) ON public.dataset_versions TO authenticated;
GRANT INSERT (
  dataset_version_id, dataset_id, project_id, created_by, external_key, position,
  input, expected_output, content_sha256, validation_state, validation_errors, metadata
) ON public.dataset_items TO authenticated;
GRANT UPDATE (
  external_key, position, input, expected_output, content_sha256,
  validation_state, validation_errors, metadata
) ON public.dataset_items TO authenticated;
GRANT DELETE ON public.dataset_items TO authenticated;
GRANT INSERT (
  project_id, created_by, name, description, status,
  evaluator_kind, provider_requirement, config
) ON public.eval_definitions TO authenticated;
GRANT UPDATE (
  name, description, status, evaluator_kind, provider_requirement, config
) ON public.eval_definitions TO authenticated;
GRANT INSERT (
  project_id, created_by, name, hypothesis, status,
  control_config, candidate_config, summary
) ON public.experiments TO authenticated;
GRANT UPDATE (
  name, hypothesis, status, control_config, candidate_config, summary
) ON public.experiments TO authenticated;
GRANT INSERT (
  project_id, created_by, dataset_version_id, eval_definition_id,
  name, description, status, pass_threshold, config
) ON public.benchmarks TO authenticated;
GRANT UPDATE (
  dataset_version_id, eval_definition_id, name, description,
  status, pass_threshold, config
) ON public.benchmarks TO authenticated;
GRANT INSERT (
  project_id, created_by, eval_definition_id, dataset_version_id,
  experiment_id, experiment_arm, benchmark_id, status, compute_mode,
  provider_status, provider, model, idempotency_key
) ON public.eval_runs TO authenticated;
GRANT INSERT (
  project_id, created_by, kind, subject_type, subject_id, title,
  summary, status, content_sha256, payload
) ON public.evidence_records TO authenticated;
GRANT UPDATE (title, summary, status, content_sha256, payload)
  ON public.evidence_records TO authenticated;
GRANT INSERT (
  project_id, created_by, evidence_record_id, relationship,
  target_type, target_id, target_locator, metadata
) ON public.evidence_links TO authenticated;
GRANT INSERT (
  project_id, created_by, evidence_record_id, source_type,
  source_locator, source_sha256, collector, captured_at, metadata
) ON public.evidence_provenance TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets, public.dataset_versions,
  public.dataset_items, public.eval_definitions, public.experiments,
  public.benchmarks, public.eval_runs, public.benchmark_results,
  public.evidence_records, public.evidence_links, public.evidence_provenance
  TO service_role;

COMMENT ON TABLE public.dataset_versions IS
  'Versioned dataset manifest. Terminal versions are immutable; items are editable only while draft.';
COMMENT ON TABLE public.eval_runs IS
  'Eval execution ledger. Provider compute remains blocked until provider_status is verified.';
COMMENT ON TABLE public.evidence_provenance IS
  'Append-only evidence provenance; supersession is represented by a new evidence link.';
