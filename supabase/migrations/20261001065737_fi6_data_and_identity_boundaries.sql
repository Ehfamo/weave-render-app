-- FI6 Group 3. MIGRATION_SOURCE_ONLY. Identity providers and credential resolution remain external.
ALTER TABLE public.workspaces ADD COLUMN identity_configuration jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.project_connectors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), provider text NOT NULL CHECK(provider ~ '^[a-z0-9.-]{1,60}$'),
 credential_ref text CHECK(credential_ref ~ '^cred_[A-Za-z0-9_-]{8,120}$'),
 scopes jsonb NOT NULL CHECK(jsonb_typeof(scopes)='array' AND jsonb_array_length(scopes)<=30),
 hosts jsonb NOT NULL CHECK(jsonb_typeof(hosts)='array' AND jsonb_array_length(hosts)<=30),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),
 health text NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK(health IN ('NOT_CONFIGURED','UNKNOWN','UNAVAILABLE','AVAILABLE')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_connectors_scope ON public.project_connectors(project_id,id);
ALTER TABLE public.project_connectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_connectors FROM PUBLIC,anon,authenticated;
-- Column grants intentionally exclude the server credential reference.
GRANT SELECT(id,project_id,name,provider,scopes,hosts,status,health,created_at,updated_at) ON public.project_connectors TO authenticated;
GRANT ALL ON public.project_connectors TO service_role;
CREATE POLICY connector_member ON public.project_connectors FOR SELECT TO authenticated USING(public.xeomx_project_role(project_id) IS NOT NULL);

-- FI5 remains canonical; governance tightens its authority and acquisition policy.
CREATE OR REPLACE FUNCTION private.fi5_member(p_actor uuid,p_project uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$ SELECT COALESCE(private.fi6_project_role(p_actor,p_project) IN (CASE WHEN p_write THEN 'owner' ELSE 'viewer' END,'owner','editor'),false) $$;
ALTER FUNCTION private.fi5_acquisition_policy(uuid,uuid,jsonb) RENAME TO fi5_acquisition_policy_base;
REVOKE ALL ON FUNCTION private.fi5_acquisition_policy_base(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.fi5_acquisition_policy(p_version uuid,p_project uuid,p_price jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE pp jsonb; wp jsonb; package text; base_approval boolean;
BEGIN
 SELECT governance_policy,w.policy INTO pp,wp FROM public.projects p LEFT JOIN public.workspaces w ON w.id=p.workspace_id WHERE p.id=p_project;
 SELECT package_id INTO package FROM public.marketplace_versions WHERE id=p_version;
 IF NOT private.fi6_policy_allows(COALESCE(wp,'{}'),'marketplace',package) OR NOT private.fi6_policy_allows(COALESCE(pp,'{}'),'marketplace',package) THEN RAISE EXCEPTION 'GOVERNANCE_BLOCKED'; END IF;
 base_approval:=private.fi5_acquisition_policy_base(p_version,p_project,p_price);
 RETURN base_approval OR COALESCE((wp->>'requireApproval')::boolean,false) OR COALESCE((pp->>'requireApproval')::boolean,false);
END $$;
REVOKE ALL ON FUNCTION private.fi5_acquisition_policy(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- Memory inspection is unaffected; automatic retrieval/write asks this authenticated boundary.
CREATE FUNCTION public.xeomx_memory_governance(p_project uuid,p_operation text,p_type text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR private.fi6_project_role(auth.uid(),p_project) IS NULL THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 IF p_operation NOT IN ('read','write') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 RETURN private.fi6_allowed(auth.uid(),p_project,'memory',p_operation) AND private.fi6_allowed(auth.uid(),p_project,'memory',p_type);
END $$;
REVOKE ALL ON FUNCTION public.xeomx_memory_governance(uuid,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_memory_governance(uuid,text,text) TO authenticated;
CREATE FUNCTION private.fi6_memory_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.project_id IS NOT NULL AND (NOT private.fi6_allowed(NEW.user_id,NEW.project_id,'memory','write') OR NOT private.fi6_allowed(NEW.user_id,NEW.project_id,'memory',NEW.type)) THEN RAISE EXCEPTION 'MEMORY_DISABLED_BY_POLICY'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.fi6_memory_write_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fi6_memory_write BEFORE INSERT ON public.xeomx_memories FOR EACH ROW EXECUTE FUNCTION private.fi6_memory_write_guard();

-- One canonical governance RPC; retain accepted Group-1 authority logic unchanged.
ALTER FUNCTION public.xeomx_governance(text,jsonb) SET SCHEMA private;
ALTER FUNCTION private.xeomx_governance(text,jsonb) RENAME TO fi6_authority_command;
REVOKE ALL ON FUNCTION private.fi6_authority_command(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.xeomx_governance(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); pid uuid:=(p_data->>'projectId')::uuid; wid uuid:=(p_data->>'workspaceId')::uuid;
 project_role text; workspace_role text; p public.projects%ROWTYPE; c public.project_connectors%ROWTYPE;
 k text:=p_data->>'kind'; rows jsonb; result jsonb; n int:=COALESCE((p_data->>'limit')::int,50); skip int:=COALESCE((p_data->>'offset')::int,0);
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>16000 OR n NOT BETWEEN 1 AND 100 OR skip NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF p_action IN ('list','create','snapshot','member','attach','policy') THEN RETURN private.fi6_authority_command(p_action,p_data); END IF;
 IF pid IS NOT NULL THEN
  project_role:=private.fi6_project_role(actor,pid);IF project_role IS NULL THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
  SELECT * INTO p FROM public.projects WHERE id=pid;
  IF wid IS NOT NULL AND wid IS DISTINCT FROM p.workspace_id THEN RAISE EXCEPTION 'WORKSPACE_ACCESS_DENIED'; END IF;
  wid:=p.workspace_id;
 END IF;
 IF wid IS NOT NULL THEN workspace_role:=private.fi6_workspace_role(actor,wid);IF workspace_role IS NULL THEN RAISE EXCEPTION 'WORKSPACE_ACCESS_DENIED'; END IF; END IF;
 IF p_action='identity' THEN
  IF wid IS NULL THEN RAISE EXCEPTION 'WORKSPACE_REQUIRED'; END IF;
  RETURN jsonb_build_object('OIDC','NOT_CONFIGURED','SAML','NOT_CONFIGURED','SCIM','NOT_CONFIGURED','domainVerification','NOT_VERIFIED','sessionGovernance','NOT_CONFIGURED','enforcement','DEFERRED_EXTERNAL');
 ELSIF p_action='identity_configure' THEN
  IF workspace_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
  IF p_data->>'protocol' NOT IN ('OIDC','SAML','SCIM') OR p_data->>'domain' !~ '^[a-z0-9][a-z0-9.-]{1,250}\.[a-z]{2,63}$' THEN RAISE EXCEPTION 'INVALID_IDENTITY_CONFIG'; END IF;
  UPDATE public.workspaces SET identity_configuration=jsonb_build_object('protocol',p_data->>'protocol','domain',p_data->>'domain','state','NOT_CONFIGURED'),updated_at=now() WHERE id=wid;
  result:=jsonb_build_object('state','NOT_CONFIGURED','verification','NOT_VERIFIED');
 ELSIF p_action='data_controls' THEN
  IF pid IS NULL THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
  RETURN jsonb_build_object('retentionEnforcement','NOT_CONFIGURED','deletionGuarantee','UNKNOWN','training','UNKNOWN','region','UNKNOWN','externalDestinations','UNKNOWN','exportability','POLICY_CONTROLLED','credentialExport','BLOCKED');
 ELSIF p_action IN ('connectors','connector','connector_revoke','connector_check') THEN
  IF pid IS NULL THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
  IF p_action='connectors' THEN
   RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,name,provider,scopes,hosts,status,health,created_at,updated_at FROM public.project_connectors WHERE project_id=pid ORDER BY id LIMIT n OFFSET skip) x),'[]');
  ELSIF p_action='connector' THEN
   IF project_role<>'owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
   IF NOT private.xeomx_valid_opaque_refs(ARRAY[p_data->>'credentialRef']) OR p_data->>'credentialRef' IS NULL
     OR jsonb_typeof(p_data->'scopes') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'hosts') IS DISTINCT FROM 'array'
     OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'scopes') v WHERE v !~ '^[a-zA-Z0-9_.:-]{1,100}$')
     OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'hosts') h WHERE h !~ '^[a-z0-9][a-z0-9.-]{1,250}\.[a-z]{2,63}$' OR NOT private.fi6_allowed(actor,pid,'network',h)) THEN RAISE EXCEPTION 'INVALID_CONNECTOR_SCOPE'; END IF;
   INSERT INTO public.project_connectors(project_id,name,provider,credential_ref,scopes,hosts) VALUES(pid,p_data->>'name',p_data->>'provider',p_data->>'credentialRef',p_data->'scopes',p_data->'hosts') RETURNING * INTO c;
   result:=jsonb_build_object('id',c.id,'state','NOT_CONFIGURED');
  ELSE
   SELECT * INTO c FROM public.project_connectors WHERE id=(p_data->>'connectorId')::uuid AND project_id=pid FOR UPDATE;
   IF c.id IS NULL THEN RAISE EXCEPTION 'CONNECTOR_ACCESS_DENIED'; END IF;
   IF p_action='connector_revoke' THEN
    IF project_role<>'owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
    UPDATE public.project_connectors SET status='REVOKED',updated_at=now() WHERE id=c.id;result:=jsonb_build_object('state','COMPLETED');
   ELSE
    IF project_role NOT IN ('owner','editor') OR c.status<>'ACTIVE' OR NOT(c.scopes ? (p_data->>'scope')) OR NOT(c.hosts ? (p_data->>'host')) OR NOT private.fi6_allowed(actor,pid,'network',p_data->>'host') OR NOT private.fi6_allowed(actor,pid,'tools',c.provider) OR NOT private.fi6_allowed(actor,pid,'actions',c.provider) THEN RAISE EXCEPTION 'CONNECTOR_SCOPE_DENIED'; END IF;
    -- No secret/ref is returned. Server adapter must independently resolve its configured reference.
    result:=jsonb_build_object('allowed',true,'health',c.health,'provider',c.provider,'approvalRequired',true);
   END IF;
  END IF;
 ELSIF p_action IN ('export','audit','usage') THEN
  IF pid IS NULL THEN RAISE EXCEPTION 'PROJECT_REQUIRED'; END IF;
  IF p_action='audit' THEN k:='audit'; END IF;
  IF p_action='usage' THEN k:='usage'; END IF;
  IF p_action='export' AND NOT private.fi6_allowed(actor,pid,'export',k) THEN RAISE EXCEPTION 'EXPORT_BLOCKED'; END IF;
  IF k='project' THEN rows:=jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'brain',p.brain_entries,'updatedAt',p.updated_at));
  ELSIF k='conversations' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT m.id,m.conversation_id,m.role,m.content,m.created_at FROM public.messages m JOIN public.conversations conv ON conv.id=m.conversation_id AND conv.project_id=m.project_id WHERE m.project_id=pid AND conv.created_by=actor AND m.role IN ('user','assistant') ORDER BY m.created_at,m.id LIMIT n OFFSET skip) x;
  ELSIF k IN ('artifacts','files') THEN
   IF NOT private.fi6_allowed(actor,pid,'files','read') THEN RAISE EXCEPTION 'EXPORT_BLOCKED'; END IF;
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT a.id,a.kind,a.origin,a.mime_type,a.status,a.version,a.controlled_run_id,a.created_at FROM public.assets a WHERE a.project_id=pid AND a.owner_id=actor AND (k='artifacts' OR a.origin='upload') ORDER BY a.id LIMIT n OFFSET skip) x;
  ELSIF k='memory' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT m.id,m.type,m.content,m.status,m.created_at,m.updated_at FROM public.xeomx_memories m WHERE m.project_id=pid AND m.user_id=actor AND private.fi6_allowed(actor,pid,'memory',m.type) ORDER BY m.id LIMIT n OFFSET skip) x;
  ELSIF k='agents' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT r.id,r.state,r.created_at,r.updated_at FROM public.controlled_runs r WHERE r.project_id=pid AND r.requested_by=actor ORDER BY r.id LIMIT n OFFSET skip) x;
  ELSIF k='marketplace' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT a.id,a.version_id,a.price,a.license,a.phase,a.created_at FROM public.marketplace_acquisitions a WHERE a.project_id=pid AND a.buyer_id=actor ORDER BY a.id LIMIT n OFFSET skip) x;
  ELSIF k='usage' THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT u.id,u.provider,u.model,u.input_units,u.output_units,u.estimated_cost_microunits,u.actual_cost_microunits,u.currency,
     CASE WHEN u.estimated_cost_microunits IS NULL THEN 'UNKNOWN' ELSE 'ESTIMATED' END AS cost_status,CASE WHEN u.actual_cost_microunits IS NULL THEN 'NOT_VERIFIED' ELSE 'VERIFIED' END AS actual_status,u.governance_state,u.latency_ms,u.created_at
    FROM public.usage_events u WHERE u.project_id=pid AND u.user_id=actor ORDER BY u.id LIMIT n OFFSET skip) x;
  ELSIF k='audit' THEN
   IF project_role<>'owner' THEN RAISE EXCEPTION 'AUDIT_ACCESS_DENIED'; END IF;
   SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT a.id,a.actor_id,a.event_type,a.target_type,a.target_id,a.result,a.created_at FROM public.audit_events a WHERE a.project_id=pid ORDER BY a.id LIMIT n OFFSET skip) x;
  ELSE RAISE EXCEPTION 'INVALID_EXPORT_KIND'; END IF;
  result:=jsonb_build_object('kind',k,'rows',rows,'offset',skip,'nextOffset',CASE WHEN jsonb_array_length(rows)=n THEN skip+n ELSE NULL END);
 ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 INSERT INTO public.audit_events(actor_id,project_id,event_type,target_type,target_id,result,metadata)
 VALUES(actor,pid,'governance.'||p_action,'governance',COALESCE(c.id,pid,wid),'succeeded',jsonb_strip_nulls(jsonb_build_object('workspaceId',wid,'kind',k,'rowCount',jsonb_array_length(rows))));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_governance(text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_governance(text,jsonb) TO authenticated;
-- Rollback preserves all audit/usage rows and connector revocations. Disable the new RPC before
-- restoring authority-only RPC; do not drop marketplace/license/Memory history.
