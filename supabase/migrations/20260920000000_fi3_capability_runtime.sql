-- FI3 MIGRATION_SOURCE_ONLY. Extend canonical controlled_runs, approval_requests and assets.
-- No production migration. Rollback: stop workers, preserve runtime rows/artifacts, then
-- remove FI3 RPC/columns/indexes only after exporting them; never drop user history blindly.
BEGIN;
ALTER TABLE public.projects ADD COLUMN creative_workspace jsonb;
ALTER TABLE public.controlled_runs ADD COLUMN runtime_data jsonb;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.controlled_runs'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%subject_type%' LOOP
 EXECUTE format('ALTER TABLE public.controlled_runs DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE public.controlled_runs ADD CONSTRAINT controlled_runs_subject_kind CHECK (
 (subject_type='agent' AND agent_version_id IS NOT NULL AND workflow_version_id IS NULL AND runtime_data IS NULL) OR
 (subject_type='workflow' AND workflow_version_id IS NOT NULL AND agent_version_id IS NULL AND runtime_data IS NULL) OR
 (subject_type='capability' AND agent_version_id IS NULL AND workflow_version_id IS NULL AND runtime_data IS NOT NULL));
ALTER TABLE public.assets ADD COLUMN controlled_run_id uuid REFERENCES public.controlled_runs(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX assets_runtime_output ON public.assets(controlled_run_id) WHERE controlled_run_id IS NOT NULL;
ALTER TABLE public.approval_requests ADD COLUMN runtime_key text;
ALTER TABLE public.approval_requests ADD COLUMN runtime_record jsonb;
ALTER TABLE public.approval_requests DROP CONSTRAINT approval_requests_run_id_key;
CREATE UNIQUE INDEX approval_requests_legacy_run ON public.approval_requests(run_id) WHERE runtime_key IS NULL;
CREATE UNIQUE INDEX approval_requests_runtime_key ON public.approval_requests(runtime_key) WHERE runtime_key IS NOT NULL;
CREATE INDEX runtime_jobs_owner_project ON public.controlled_runs(requested_by,project_id,created_at DESC) WHERE runtime_data IS NOT NULL;
-- The existing guards remain authoritative for the existing P0-P9 control plane.
DROP TRIGGER controlled_runs_guard ON public.controlled_runs;
CREATE TRIGGER controlled_runs_guard BEFORE INSERT OR UPDATE ON public.controlled_runs FOR EACH ROW WHEN (NEW.runtime_data IS NULL) EXECUTE FUNCTION private.xeomx_controlled_run_guard();
DROP TRIGGER controlled_runs_create_approval ON public.controlled_runs;
CREATE TRIGGER controlled_runs_create_approval AFTER INSERT ON public.controlled_runs FOR EACH ROW WHEN (NEW.runtime_data IS NULL) EXECUTE FUNCTION private.xeomx_create_run_approval();
DROP TRIGGER approval_requests_guard ON public.approval_requests;
CREATE TRIGGER approval_requests_guard BEFORE UPDATE ON public.approval_requests FOR EACH ROW WHEN (NEW.runtime_key IS NULL) EXECUTE FUNCTION private.xeomx_approval_guard();
DROP TRIGGER approval_requests_apply ON public.approval_requests;
CREATE TRIGGER approval_requests_apply AFTER UPDATE ON public.approval_requests FOR EACH ROW WHEN (NEW.runtime_key IS NULL) EXECUTE FUNCTION private.xeomx_apply_approval();

-- Qualify the outer table identity; unqualified project_id inside a membership
-- subquery would compare the membership column with itself.
DROP POLICY p4_events_read ON public.automation_events;
CREATE POLICY p4_events_read ON public.automation_events FOR SELECT TO authenticated USING (public.xeomx_project_role(automation_events.project_id) IS NOT NULL);
DROP POLICY p4_assignments_read ON public.project_assignments;
CREATE POLICY p4_assignments_read ON public.project_assignments FOR SELECT TO authenticated USING (public.xeomx_project_role(project_assignments.project_id) IS NOT NULL);
DROP POLICY p4_activity_read ON public.project_collaboration_activity;
CREATE POLICY p4_activity_read ON public.project_collaboration_activity FOR SELECT TO authenticated USING (public.xeomx_project_role(project_collaboration_activity.project_id) IS NOT NULL);
DROP POLICY p4_comments_read ON public.project_collaboration_comments;
CREATE POLICY p4_comments_read ON public.project_collaboration_comments FOR SELECT TO authenticated USING (public.xeomx_project_role(project_collaboration_comments.project_id) IS NOT NULL);
DROP POLICY p4_comments_insert ON public.project_collaboration_comments;
CREATE POLICY p4_comments_insert ON public.project_collaboration_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND public.xeomx_project_role(project_collaboration_comments.project_id) IS NOT NULL);

CREATE FUNCTION private.xeomx_runtime_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'RUNTIME_SERVER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='controlled_runs' AND TG_OP='UPDATE' THEN
  IF NEW.project_id<>OLD.project_id OR NEW.requested_by<>OLD.requested_by OR NEW.request_hash<>OLD.request_hash OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.runtime_data->'request' IS DISTINCT FROM OLD.runtime_data->'request' THEN RAISE EXCEPTION 'IMMUTABLE_RUNTIME_IDENTITY'; END IF;
  IF OLD.state IN ('succeeded','cancelled','denied') AND NEW.state<>OLD.state THEN RAISE EXCEPTION 'TERMINAL_RUNTIME_JOB'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER runtime_run_guard BEFORE INSERT OR UPDATE ON public.controlled_runs FOR EACH ROW WHEN (NEW.runtime_data IS NOT NULL) EXECUTE FUNCTION private.xeomx_runtime_guard();
CREATE TRIGGER runtime_approval_guard BEFORE INSERT OR UPDATE ON public.approval_requests FOR EACH ROW WHEN (NEW.runtime_key IS NOT NULL) EXECUTE FUNCTION private.xeomx_runtime_guard();
-- Restrictive policies combine with canonical membership RLS. Private checkpoints and memories
-- in jobs never become readable by another project member or conversation owner.
CREATE POLICY fi3_runtime_owner ON public.controlled_runs AS RESTRICTIVE FOR ALL TO authenticated USING(runtime_data IS NULL OR requested_by=auth.uid()) WITH CHECK(runtime_data IS NULL);
CREATE POLICY fi3_runtime_asset_owner ON public.assets AS RESTRICTIVE FOR ALL TO authenticated USING(controlled_run_id IS NULL OR owner_id=auth.uid()) WITH CHECK(controlled_run_id IS NULL);
CREATE POLICY fi3_runtime_approval_scope ON public.approval_requests AS RESTRICTIVE FOR SELECT TO authenticated USING(runtime_key IS NULL OR requested_by=auth.uid() OR EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=auth.uid()));

CREATE FUNCTION public.xeomx_runtime_command(p_actor uuid,p_action text,p_id uuid,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.controlled_runs%ROWTYPE; a public.approval_requests%ROWTYPE; role_name text;
 project uuid; artifact uuid; previous uuid; requested jsonb; cp jsonb; state_next text; content text; output jsonb; approval_key text;
BEGIN
 IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'RUNTIME_SERVER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_actor IS NULL THEN RAISE EXCEPTION 'RUNTIME_ACCESS_DENIED'; END IF;
 IF p_action='submit' THEN
  requested:=p_data->'request'; project:=(requested->'task'->>'projectId')::uuid;
  SELECT m.role INTO role_name FROM public.project_members m JOIN public.projects p ON p.id=m.project_id WHERE m.project_id=project AND m.user_id=p_actor AND p.status='active';
  IF role_name IS NULL OR role_name NOT IN ('owner','editor') OR requested->'task'->>'userId'<>p_actor::text OR requested->'task'->>'id'<>p_id::text THEN RAISE EXCEPTION 'RUNTIME_ACCESS_DENIED'; END IF;
  IF requested->'capability'->>'kind' NOT IN ('creative','business','automation') OR length(requested->'task'->>'goal') NOT BETWEEN 1 AND 20000 OR jsonb_typeof(requested)<>'object' THEN RAISE EXCEPTION 'INVALID_RUNTIME_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text || (requested->>'idempotencyKey'),0));
  SELECT * INTO r FROM public.controlled_runs WHERE requested_by=p_actor AND idempotency_key=requested->>'idempotencyKey';
  IF r.id IS NOT NULL THEN
   IF r.request_hash<>p_data->>'hash' OR r.project_id<>project THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(r);
  END IF;
  previous:=(requested->'task'->>'conversationId')::uuid;
  IF previous IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=previous AND c.project_id=project AND c.created_by=p_actor) THEN RAISE EXCEPTION 'CONVERSATION_ACCESS_DENIED'; END IF;
  INSERT INTO public.conversations(id,project_id,created_by,title) VALUES(p_id,project,p_actor,left(requested->'task'->>'goal',200));
  INSERT INTO public.messages(project_id,conversation_id,author_id,role,content) VALUES(project,p_id,p_actor,'user',requested->'task'->>'goal');
  INSERT INTO public.controlled_runs(id,project_id,requested_by,subject_type,risk_tier,action_key,input,credential_refs,state,approval_required,idempotency_key,request_hash,max_attempts,runtime_data)
  VALUES(p_id,project,p_actor,'capability','R0','project.read','{}','{}','queued',false,requested->>'idempotencyKey',p_data->>'hash',3,jsonb_build_object('request',requested,'artifactIds','[]'::jsonb)) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.controlled_runs WHERE id=p_id AND runtime_data IS NOT NULL FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RUNTIME_ACCESS_DENIED'; END IF;
  project:=r.project_id;
  SELECT m.role INTO role_name FROM public.project_members m JOIN public.projects p ON p.id=m.project_id WHERE m.project_id=project AND m.user_id=p_actor AND p.status='active';
  IF role_name IS NULL OR (p_action NOT IN ('get','decide') AND role_name NOT IN ('owner','editor')) OR (r.requested_by<>p_actor AND NOT(p_action='decide' AND role_name='owner')) THEN RAISE EXCEPTION 'RUNTIME_ACCESS_DENIED'; END IF;
  IF p_action='get' THEN RETURN to_jsonb(r); END IF;
  IF p_action='claim' THEN
   IF r.state<>'queued' THEN RETURN NULL; END IF;
   IF r.runtime_data->'request'->'capability'->>'kind'='automation' AND NOT EXISTS(SELECT 1 FROM public.workflow_definitions w WHERE w.id=(r.runtime_data->'request'->'capability'->'workflow'->>'id')::uuid AND w.project_id=project AND w.status='active') THEN RETURN NULL; END IF;
   UPDATE public.controlled_runs SET state='running',started_at=now(),runtime_data=runtime_data||jsonb_build_object('lease',p_data->>'lease') WHERE id=p_id RETURNING * INTO r;
  ELSIF p_action='checkpoint' THEN
   IF r.state<>'running' OR r.runtime_data->>'lease' IS DISTINCT FROM p_data->>'lease' THEN RAISE EXCEPTION 'RUNTIME_LEASE_LOST'; END IF;
   cp:=p_data->'checkpoint';
   IF cp->'context'->'task'->>'id'<>p_id::text OR cp->'context'->'task'->>'projectId'<>project::text OR cp->'context'->'task'->>'userId'<>p_actor::text OR octet_length(cp::text)>300000 THEN RAISE EXCEPTION 'CHECKPOINT_SCOPE_MISMATCH'; END IF;
   UPDATE public.controlled_runs SET runtime_data=runtime_data||jsonb_build_object('checkpoint',cp),updated_at=now() WHERE id=p_id RETURNING * INTO r;
  ELSIF p_action='request_approval' THEN
   IF r.state<>'running' THEN RAISE EXCEPTION 'TASK_NOT_RESUMABLE'; END IF;
   approval_key:=p_data->>'id';
   IF p_data->>'taskId'<>p_id::text OR p_data->>'executionId'<>p_id::text OR p_data->>'projectId'<>project::text OR p_data->>'requestedBy'<>p_actor::text THEN RAISE EXCEPTION 'APPROVAL_SCOPE_MISMATCH'; END IF;
   INSERT INTO public.approval_requests(run_id,project_id,requested_by,runtime_key,runtime_record,expires_at)
    VALUES(p_id,project,p_actor,approval_key,p_data,now()+interval '24 hours') ON CONFLICT(runtime_key) WHERE runtime_key IS NOT NULL DO NOTHING;
   SELECT * INTO a FROM public.approval_requests WHERE runtime_key=approval_key;
   IF a.run_id<>p_id OR a.runtime_record->>'stepId'<>p_data->>'stepId' OR a.runtime_record->>'toolId'<>p_data->>'toolId' THEN RAISE EXCEPTION 'APPROVAL_SCOPE_MISMATCH'; END IF;
   UPDATE public.controlled_runs SET runtime_data=runtime_data||jsonb_build_object('approvalId',approval_key) WHERE id=p_id;
   RETURN a.runtime_record||jsonb_build_object('status','pending','createdAt',a.created_at);
  ELSIF p_action='decide' THEN
   IF role_name<>'owner' THEN RAISE EXCEPTION 'APPROVAL_EXACT_PROJECT_OWNER_REQUIRED'; END IF;
   SELECT * INTO a FROM public.approval_requests WHERE runtime_key=p_data->>'approvalId' AND run_id=p_id FOR UPDATE;
   IF a.id IS NULL OR p_data->>'decision' NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'APPROVAL_INVALID_DECISION'; END IF;
   IF a.status<>'pending' THEN
    IF a.status=(CASE WHEN p_data->>'decision'='approved' THEN 'approved' ELSE 'denied' END) THEN RETURN to_jsonb(r); END IF;
    RAISE EXCEPTION 'APPROVAL_ALREADY_DECIDED';
   END IF;
   IF r.state<>'awaiting_approval' OR a.expires_at<=now() THEN RAISE EXCEPTION 'APPROVAL_NOT_RESUMABLE'; END IF;
   UPDATE public.approval_requests SET status=CASE WHEN p_data->>'decision'='approved' THEN 'approved' ELSE 'denied' END,decided_by=p_actor,decided_at=now(),decision_reason=left(COALESCE(p_data->>'reason','User decision'),1000) WHERE id=a.id;
   UPDATE public.controlled_runs SET state=CASE WHEN p_data->>'decision'='approved' THEN 'queued' ELSE 'cancelled' END,runtime_data=runtime_data||jsonb_build_object('resumeApprovalId',a.runtime_key),updated_at=now() WHERE id=p_id RETURNING * INTO r;
   INSERT INTO public.project_collaboration_activity(project_id,actor_id,kind,subject_id,summary) VALUES(project,p_actor,'approval',p_id::text,p_data->>'decision');
  ELSIF p_action='consume' THEN
   IF r.state<>'running' THEN RAISE EXCEPTION 'TASK_NOT_RESUMABLE'; END IF;
   SELECT * INTO a FROM public.approval_requests WHERE runtime_key=p_data->>'approvalId' AND run_id=p_id FOR UPDATE;
   IF a.id IS NULL OR a.status<>'approved' OR a.consumed_at IS NOT NULL OR a.expires_at<=now() OR a.runtime_record->>'taskId'<>p_data->>'taskId' OR a.runtime_record->>'executionId'<>p_data->>'executionId' OR a.runtime_record->>'stepId'<>p_data->>'stepId' OR a.runtime_record->>'toolId'<>p_data->>'toolId' OR a.project_id::text<>p_data->>'projectId' OR NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project AND p.owner_id=a.decided_by) THEN RAISE EXCEPTION 'APPROVAL_INVALID_EXPIRED_OR_CONSUMED'; END IF;
   UPDATE public.approval_requests SET consumed_at=now() WHERE id=a.id;
   RETURN a.runtime_record||jsonb_build_object('status','approved','decidedBy',a.decided_by,'consumedAt',now());
  ELSIF p_action='cancel' THEN
   IF r.state IN ('succeeded','failed','cancelled','denied','unavailable') THEN RETURN to_jsonb(r); END IF;
   UPDATE public.approval_requests SET status='cancelled',decided_by=p_actor,decided_at=now() WHERE run_id=p_id AND status='pending';
   UPDATE public.controlled_runs SET state='cancelled',completed_at=now(),updated_at=now() WHERE id=p_id RETURNING * INTO r;
  ELSIF p_action='recover' THEN
   IF r.state<>'running' OR r.started_at>now()-interval '5 minutes' THEN RAISE EXCEPTION 'LEASE_NOT_EXPIRED'; END IF;
   UPDATE public.controlled_runs SET state='failed',failure_code=CASE WHEN (runtime_data->'checkpoint'->'inFlight'->>'consequential')::boolean IS TRUE THEN 'ACTION_OUTCOME_UNKNOWN' ELSE 'WORKER_INTERRUPTED' END,completed_at=now(),updated_at=now() WHERE id=p_id RETURNING * INTO r;
  ELSIF p_action='retry' THEN
   IF r.state NOT IN ('failed','unavailable') OR r.attempt_count>=r.max_attempts OR (r.runtime_data->'checkpoint'->'inFlight'->>'consequential')::boolean IS TRUE THEN RAISE EXCEPTION 'RETRY_NOT_SAFE'; END IF;
   UPDATE public.controlled_runs SET state='queued',attempt_count=attempt_count+1,updated_at=now(),failure_code=NULL WHERE id=p_id RETURNING * INTO r;
  ELSIF p_action='finish' THEN
   IF r.state='cancelled' THEN RETURN to_jsonb(r); END IF;
   IF r.state<>'running' OR r.runtime_data->>'lease' IS DISTINCT FROM p_data->>'lease' THEN RAISE EXCEPTION 'RUNTIME_LEASE_LOST'; END IF;
   state_next:=CASE p_data->'execution'->'trace'->>'status' WHEN 'completed' THEN 'succeeded' WHEN 'waiting_approval' THEN 'awaiting_approval' WHEN 'cancelled' THEN 'cancelled' ELSE 'failed' END;
   IF state_next='awaiting_approval' AND NOT EXISTS(SELECT 1 FROM public.approval_requests ar WHERE ar.run_id=p_id AND ar.status='pending') THEN RAISE EXCEPTION 'APPROVAL_REQUIRED'; END IF;
   IF state_next='succeeded' THEN
    content:=p_data->'execution'->'result'->>'summary';
    IF content IS NULL OR length(content) NOT BETWEEN 1 AND 200000 THEN RAISE EXCEPTION 'RUNTIME_RESULT_REQUIRED'; END IF;
    output:=p_data->'execution'->'result'->'data'->'output';
    INSERT INTO public.assets(owner_id,project_id,controlled_run_id,kind,origin,mime_type,status,metadata)
    VALUES(p_actor,project,p_id,CASE WHEN r.runtime_data->'request'->'capability'->>'kind'='creative' THEN CASE WHEN output->>'kind'='voice' THEN 'audio' ELSE output->>'kind' END ELSE 'document' END,'generation',COALESCE(output->>'mimeType','text/plain'),'ready',jsonb_build_object('title',left(r.runtime_data->'request'->'task'->>'goal',120),'text',content,'output',output,'provenance',jsonb_build_object('kind','generation','executionId',p_id),'quality',p_data->'execution'->'result'->'data'->'quality')) RETURNING id INTO artifact;
    INSERT INTO public.messages(project_id,conversation_id,role,content,metadata) VALUES(project,p_id,'assistant',content,jsonb_build_object('artifactId',artifact));
    UPDATE public.conversations SET updated_at=now() WHERE id=p_id;
   END IF;
   UPDATE public.controlled_runs SET state=state_next,result=CASE WHEN state_next='succeeded' THEN jsonb_build_object('artifactId',artifact) ELSE NULL END,
     failure_code=CASE WHEN state_next='failed' THEN CASE WHEN p_data->'execution'->'error'->>'code' IN ('NOT_CONFIGURED','PROVIDER_UNAVAILABLE','ACTION_OUTCOME_UNKNOWN','TOOL_EXECUTION_FAILED') THEN p_data->'execution'->'error'->>'code' ELSE 'RUNTIME_FAILED' END ELSE NULL END,
     runtime_data=runtime_data||jsonb_build_object('artifactIds',CASE WHEN artifact IS NOT NULL THEN jsonb_build_array(artifact) ELSE '[]'::jsonb END),updated_at=now(),completed_at=CASE WHEN state_next IN ('succeeded','failed','cancelled') THEN now() ELSE NULL END WHERE id=p_id RETURNING * INTO r;
  ELSE RAISE EXCEPTION 'INVALID_RUNTIME_COMMAND'; END IF;
 END IF;
 IF p_action IN ('submit','claim','finish','cancel','retry','recover') THEN
  INSERT INTO public.project_collaboration_activity(project_id,actor_id,kind,subject_id,summary,trace_id) VALUES(project,p_actor,'agent_result',p_id::text,r.state,artifact::text);
  UPDATE public.projects SET updated_at=now() WHERE id=project;
 END IF;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.xeomx_runtime_command(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_runtime_command(uuid,text,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION private.xeomx_runtime_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
