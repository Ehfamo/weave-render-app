-- FI6 Group 2. MIGRATION_SOURCE_ONLY. No hosted migration or provider calls.
-- Reuse the canonical usage ledger. All policy limits are explicitly USD minor units;
-- token estimates remain estimates; actual cost stays NULL until provider reconciliation exists.
ALTER TABLE public.usage_events ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE public.usage_events ADD COLUMN governance_request_key text;
ALTER TABLE public.usage_events ADD COLUMN governance_run_id uuid;
ALTER TABLE public.usage_events ADD COLUMN governance_state text CHECK(governance_state IN ('RESERVED','RECORDED','UNKNOWN'));
ALTER TABLE public.usage_events ADD COLUMN governance_outcome text;
ALTER TABLE public.usage_events ADD COLUMN latency_ms integer CHECK(latency_ms BETWEEN 0 AND 600000);
ALTER TABLE public.usage_events ADD CONSTRAINT usage_origin_required CHECK(job_id IS NOT NULL OR (governance_request_key IS NOT NULL AND governance_run_id IS NOT NULL AND governance_state IS NOT NULL));
CREATE UNIQUE INDEX usage_governance_request ON public.usage_events(user_id,project_id,governance_request_key) WHERE governance_request_key IS NOT NULL;
CREATE INDEX usage_governance_run ON public.usage_events(project_id,governance_run_id);

CREATE FUNCTION private.fi6_limit(p_workspace jsonb,p_project jsonb,p_key text) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT LEAST((p_workspace->'limits'->>p_key)::bigint,(p_project->'limits'->>p_key)::bigint)
$$;
REVOKE ALL ON FUNCTION private.fi6_limit(jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.xeomx_governance_meter(p_actor uuid,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.projects%ROWTYPE; w public.workspaces%ROWTYPE; existing public.usage_events%ROWTYPE;
 pid uuid:=(p_data->>'projectId')::uuid; run uuid:=(p_data->>'runId')::uuid; estimate bigint:=(p_data->>'estimatedMicrounits')::bigint;
 scope_policy jsonb; scope_workspace boolean; cap bigint; used numeric; unknown_count bigint; active_count bigint;
 period_start timestamptz; k text; warning boolean:=false; warning_at bigint; key text:=p_data->>'requestKey';
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'SERVER_REQUIRED'; END IF;
 IF p_actor IS NULL OR pid IS NULL OR run IS NULL OR key IS NULL OR length(key) NOT BETWEEN 1 AND 200 OR estimate<0 THEN RAISE EXCEPTION 'INVALID_METER'; END IF;
 SELECT * INTO p FROM public.projects WHERE id=pid AND status='active';
 IF p.id IS NULL THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 SELECT * INTO w FROM public.workspaces WHERE id=p.workspace_id;
 -- Serialize all project/workspace reservations; conservative outstanding holds survive failures/restarts.
 PERFORM pg_advisory_xact_lock(hashtextextended(COALESCE(p.workspace_id,p.id)::text,6006));
 SELECT * INTO existing FROM public.usage_events WHERE user_id=p_actor AND project_id=pid AND governance_request_key=key FOR UPDATE;
 IF p_action='record' THEN
  IF existing.id IS NULL OR existing.governance_run_id<>run OR existing.provider IS DISTINCT FROM p_data->>'provider' OR existing.model IS DISTINCT FROM p_data->>'model' THEN RAISE EXCEPTION 'METER_SCOPE_MISMATCH'; END IF;
  IF p_data->>'outcome' NOT IN ('SUCCESS','TIMEOUT','AUTH_ERROR','RATE_LIMIT','PROVIDER_UNAVAILABLE','INVALID_REQUEST','CONTENT_REJECTED','UNKNOWN_PROVIDER_ERROR','GOVERNANCE_BLOCKED','BUDGET_STOPPED') THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
  IF existing.governance_state<>'RESERVED' THEN
   IF existing.governance_outcome IS DISTINCT FROM p_data->>'outcome' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('state',existing.governance_state,'actualUsage','NOT_VERIFIED');
  END IF;
  UPDATE public.usage_events SET governance_state=CASE WHEN p_data->>'outcome'='TIMEOUT' THEN 'UNKNOWN' ELSE 'RECORDED' END,
   governance_outcome=p_data->>'outcome', input_units=(p_data->>'inputUnits')::bigint,output_units=(p_data->>'outputUnits')::bigint,
   latency_ms=(p_data->>'latencyMs')::integer,usage_unavailable=true WHERE id=existing.id;
  RETURN jsonb_build_object('actualUsage','NOT_VERIFIED');
 END IF;
 IF p_action<>'reserve' THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 IF COALESCE(private.fi6_project_role(p_actor,pid),'') NOT IN ('owner','editor','admin') THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 IF NOT private.fi6_allowed(p_actor,pid,'providers',p_data->>'provider') OR NOT private.fi6_allowed(p_actor,pid,'models',(p_data->>'provider')||'/'||(p_data->>'model')) OR NOT private.fi6_allowed(p_actor,pid,'network',p_data->>'destination') THEN RAISE EXCEPTION 'GOVERNANCE_BLOCKED'; END IF;
 IF existing.id IS NOT NULL THEN RAISE EXCEPTION 'REQUEST_ALREADY_RECORDED'; END IF;
 IF estimate IS NULL AND (COALESCE((w.policy->>'blockUnknownCost')::boolean,false) OR COALESCE((p.governance_policy->>'blockUnknownCost')::boolean,false)) THEN RAISE EXCEPTION 'COST_UNKNOWN'; END IF;
 FOREACH scope_workspace IN ARRAY ARRAY[true,false] LOOP
  IF scope_workspace AND p.workspace_id IS NULL THEN CONTINUE; END IF;
  scope_policy:=CASE WHEN scope_workspace THEN w.policy ELSE p.governance_policy END;
  warning_at:=COALESCE((scope_policy->'limits'->>'warningPercent')::bigint,80);
  FOREACH k IN ARRAY ARRAY['runMinor','dailyMinor','monthlyMinor'] LOOP
   cap:=(scope_policy->'limits'->>k)::bigint;
   IF cap IS NULL THEN CONTINUE; END IF;
   IF estimate IS NULL THEN RAISE EXCEPTION 'COST_UNKNOWN'; END IF;
   period_start:=CASE k WHEN 'dailyMinor' THEN date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' WHEN 'monthlyMinor' THEN date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' ELSE '-infinity'::timestamptz END;
   SELECT COALESCE(sum(COALESCE(u.actual_cost_microunits,u.estimated_cost_microunits)),0),
    count(*) FILTER(WHERE COALESCE(u.actual_cost_microunits,u.estimated_cost_microunits) IS NULL OR u.currency<>'USD')
   INTO used,unknown_count FROM public.usage_events u JOIN public.projects q ON q.id=u.project_id
   WHERE (CASE WHEN scope_workspace THEN q.workspace_id=p.workspace_id ELSE q.id=pid END)
    AND u.created_at>=period_start AND (k<>'runMinor' OR u.governance_run_id=run);
   IF unknown_count>0 THEN RAISE EXCEPTION 'COST_UNKNOWN'; END IF;
   IF used+estimate>cap*10000 THEN RAISE EXCEPTION 'BUDGET_STOPPED'; END IF;
   warning:=warning OR (used+estimate)*100>=cap*10000*warning_at;
  END LOOP;
  cap:=(scope_policy->'limits'->>'concurrency')::bigint;
  IF cap IS NOT NULL THEN
   SELECT count(*) INTO active_count FROM public.usage_events u JOIN public.projects q ON q.id=u.project_id
    WHERE u.governance_state IN ('RESERVED','UNKNOWN') AND (CASE WHEN scope_workspace THEN q.workspace_id=p.workspace_id ELSE q.id=pid END);
   IF active_count>=cap THEN RAISE EXCEPTION 'CONCURRENCY_LIMIT'; END IF;
  END IF;
 END LOOP;
 INSERT INTO public.usage_events(user_id,project_id,provider,model,governance_run_id,governance_request_key,governance_state,estimated_cost_microunits,usage_unavailable)
 VALUES(p_actor,pid,p_data->>'provider',p_data->>'model',run,key,'RESERVED',estimate,true);
 INSERT INTO public.audit_events(actor_id,project_id,event_type,target_type,result,metadata)
 VALUES(p_actor,pid,'governance.budget_reservation','usage','allowed',jsonb_build_object('runId',run,'warning',warning,'currency','USD','costStatus',CASE WHEN estimate IS NULL THEN 'UNKNOWN' ELSE 'ESTIMATED' END));
 RETURN jsonb_build_object('warning',warning,'costStatus',CASE WHEN estimate IS NULL THEN 'UNKNOWN' ELSE 'ESTIMATED' END,'actualUsage','NOT_VERIFIED');
END $$;
REVOKE ALL ON FUNCTION public.xeomx_governance_meter(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_governance_meter(uuid,text,jsonb) TO service_role;

-- Govern the existing FI3 service-role boundary as well as its authenticated RLS reads.
ALTER FUNCTION public.xeomx_runtime_command(uuid,text,uuid,jsonb) SET SCHEMA private;
ALTER FUNCTION private.xeomx_runtime_command(uuid,text,uuid,jsonb) RENAME TO fi3_runtime_command;
REVOKE ALL ON FUNCTION private.fi3_runtime_command(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.xeomx_runtime_command(p_actor uuid,p_action text,p_id uuid,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pid uuid; p public.projects%ROWTYPE; wp jsonb; cap bigint; count_running bigint; agent text;
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'SERVER_REQUIRED'; END IF;
 IF p_action='submit' THEN pid:=(p_data->'request'->'task'->>'projectId')::uuid;
 ELSE SELECT project_id INTO pid FROM public.controlled_runs WHERE id=p_id; END IF;
 IF private.fi6_project_role(p_actor,pid) IS NULL THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 SELECT * INTO p FROM public.projects WHERE id=pid;
 SELECT policy INTO wp FROM public.workspaces WHERE id=p.workspace_id;
 IF p_action IN ('submit','claim','checkpoint','consume') THEN
  IF p_action='submit' THEN agent:=p_data->'request'->'task'->>'requestedAgent';
  ELSE SELECT runtime_data->'request'->'task'->>'requestedAgent' INTO agent FROM public.controlled_runs WHERE id=p_id; END IF;
  IF NOT private.fi6_allowed(p_actor,pid,'agents',COALESCE(agent,'research')) THEN RAISE EXCEPTION 'GOVERNANCE_BLOCKED'; END IF;
 END IF;
 IF p_action='claim' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(COALESCE(p.workspace_id,p.id)::text,6006));
  cap:=(p.governance_policy->'limits'->>'concurrency')::bigint;
  SELECT count(*) INTO count_running FROM public.controlled_runs WHERE project_id=pid AND state='running' AND id<>p_id;
  IF cap IS NOT NULL AND count_running>=cap THEN RAISE EXCEPTION 'CONCURRENCY_LIMIT'; END IF;
  cap:=(wp->'limits'->>'concurrency')::bigint;
  SELECT count(*) INTO count_running FROM public.controlled_runs r JOIN public.projects q ON q.id=r.project_id WHERE q.workspace_id=p.workspace_id AND r.state='running' AND r.id<>p_id;
  IF cap IS NOT NULL AND count_running>=cap THEN RAISE EXCEPTION 'CONCURRENCY_LIMIT'; END IF;
 END IF;
 RETURN private.fi3_runtime_command(p_actor,p_action,p_id,p_data);
END $$;
REVOKE ALL ON FUNCTION public.xeomx_runtime_command(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_runtime_command(uuid,text,uuid,jsonb) TO service_role;
-- Rollback: stop runtimes, reconcile open usage holds, then restore the FI3 RPC and remove only
-- FI6 columns/functions. Retain canonical usage/audit rows; never erase billing evidence.
