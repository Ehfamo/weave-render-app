-- FI6 MIGRATION_SOURCE_ONLY. Never applied to hosted Production.
-- Governance overlays canonical projects, membership, audit, approvals and usage.
-- Rollback requires stopping governed execution and preserving policy/audit/usage; do not drop history blindly.
BEGIN;
CREATE TABLE public.workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 120),
 policy jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.workspace_members (
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('owner','admin','editor','viewer')), active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,user_id)
);
ALTER TABLE public.projects ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
ALTER TABLE public.projects ADD COLUMN governance_policy jsonb NOT NULL DEFAULT '{}';
CREATE INDEX fi6_projects_workspace ON public.projects(workspace_id,id) WHERE workspace_id IS NOT NULL;
CREATE INDEX fi6_workspace_member_actor ON public.workspace_members(user_id,workspace_id) WHERE active;
CREATE FUNCTION private.fi6_workspace_role(actor uuid,wid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.workspace_members WHERE workspace_id=wid AND user_id=actor AND active
$$;
CREATE FUNCTION private.fi6_project_role(actor uuid,pid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT pm.role FROM public.project_members pm JOIN public.projects p ON p.id=pm.project_id
 WHERE p.id=pid AND pm.user_id=actor AND p.status='active'
 AND (p.workspace_id IS NULL OR private.fi6_workspace_role(actor,p.workspace_id) IS NOT NULL)
$$;
CREATE OR REPLACE FUNCTION public.xeomx_project_role(p_project_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.fi6_project_role(auth.uid(),p_project_id)
$$;
CREATE FUNCTION public.xeomx_workspace_role(p_workspace uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.fi6_workspace_role(auth.uid(),p_workspace)
$$;
REVOKE ALL ON FUNCTION private.fi6_workspace_role(uuid,uuid),private.fi6_project_role(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.xeomx_workspace_role(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xeomx_workspace_role(uuid) TO authenticated;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces,public.workspace_members FROM anon,authenticated;
GRANT SELECT ON public.workspaces,public.workspace_members TO authenticated;
GRANT ALL ON public.workspaces,public.workspace_members TO service_role;
CREATE POLICY fi6_workspace_read ON public.workspaces FOR SELECT TO authenticated USING(public.xeomx_workspace_role(id) IS NOT NULL);
CREATE POLICY fi6_members_read ON public.workspace_members FOR SELECT TO authenticated USING(public.xeomx_workspace_role(workspace_id) IS NOT NULL);
CREATE POLICY fi6_projects_scope ON public.projects AS RESTRICTIVE FOR ALL TO authenticated
 USING(workspace_id IS NULL OR public.xeomx_workspace_role(workspace_id) IS NOT NULL)
 WITH CHECK(workspace_id IS NULL OR public.xeomx_workspace_role(workspace_id) IS NOT NULL);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['conversations','messages','assets','generation_jobs','usage_events','audit_events','controlled_runs','approval_requests','project_members','xeomx_memories','project_collaboration_comments','project_collaboration_activity','automation_events'] LOOP
 EXECUTE format('CREATE POLICY fi6_project_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(project_id IS NULL OR public.xeomx_project_role(project_id) IS NOT NULL) WITH CHECK(project_id IS NULL OR public.xeomx_project_role(project_id) IS NOT NULL)',t);
 END LOOP;
END $$;
CREATE FUNCTION private.fi6_valid_policy(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; v jsonb; d text; a jsonb; x jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>12000 THEN RETURN false; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p) LOOP
  IF k IN ('allow','deny') THEN
   IF jsonb_typeof(v)<>'object' THEN RETURN false; END IF;
   FOR d,a IN SELECT * FROM jsonb_each(v) LOOP
    IF d NOT IN ('models','providers','agents','tools','mcp','marketplace','network','files','memory','export','actions') OR jsonb_typeof(a)<>'array' OR jsonb_array_length(a)>100 THEN RETURN false; END IF;
    FOR x IN SELECT * FROM jsonb_array_elements(a) LOOP
     IF jsonb_typeof(x)<>'string' OR char_length(x#>>'{}') NOT BETWEEN 1 AND 200 THEN RETURN false; END IF;
    END LOOP;
   END LOOP;
  ELSIF k='limits' THEN
   IF jsonb_typeof(v)<>'object' THEN RETURN false; END IF;
   FOR d,a IN SELECT * FROM jsonb_each(v) LOOP
    IF d NOT IN ('dailyMinor','monthlyMinor','runMinor','concurrency','contextChars','retentionDays','warningPercent') OR jsonb_typeof(a)<>'number' OR a::text !~ '^[0-9]+$' OR a::numeric>1000000000 OR (d='warningPercent' AND a::numeric>100) THEN RETURN false; END IF;
   END LOOP;
  ELSIF k IN ('requireApproval','blockUnknownCost') THEN IF jsonb_typeof(v)<>'boolean' THEN RETURN false; END IF;
  ELSE RETURN false;
  END IF;
 END LOOP;
 RETURN true;
END $$;
ALTER TABLE public.workspaces ADD CHECK(private.fi6_valid_policy(policy));
ALTER TABLE public.projects ADD CHECK(private.fi6_valid_policy(governance_policy));
CREATE FUNCTION private.fi6_policy_allows(p jsonb,domain text,value text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT NOT coalesce((p->'deny'->domain) ? value,false) AND NOT coalesce((p->'deny'->domain) ? '*',false)
 AND (p->'allow'->domain IS NULL OR (p->'allow'->domain) ? value)
$$;
CREATE FUNCTION private.fi6_allowed(actor uuid,pid uuid,domain text,value text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.fi6_project_role(actor,pid) IS NOT NULL
 AND private.fi6_policy_allows(p.governance_policy,domain,value)
 AND private.fi6_policy_allows(coalesce(w.policy,'{}'),domain,value)
 FROM public.projects p LEFT JOIN public.workspaces w ON w.id=p.workspace_id WHERE p.id=pid
$$;
CREATE FUNCTION private.fi6_governance_columns() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND ((TG_OP='INSERT' AND (NEW.workspace_id IS NOT NULL OR NEW.governance_policy<>'{}'::jsonb)) OR (TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.governance_policy IS DISTINCT FROM OLD.governance_policy))) THEN RAISE EXCEPTION 'GOVERNANCE_SERVER_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fi6_project_governance_columns BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION private.fi6_governance_columns();
CREATE FUNCTION public.xeomx_governance(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); wid uuid:=(p_data->>'workspaceId')::uuid; pid uuid:=(p_data->>'projectId')::uuid;
 target uuid:=(p_data->>'userId')::uuid; actor_role text; desired text:=p_data->>'role'; w public.workspaces; p public.projects; result jsonb; old jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>16000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF p_action='list' THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT ws.id,ws.name,m.role FROM public.workspaces ws JOIN public.workspace_members m ON m.workspace_id=ws.id WHERE m.user_id=actor AND m.active ORDER BY ws.id LIMIT 100) x),'[]');
 ELSIF p_action='create' THEN
  INSERT INTO public.workspaces(owner_id,name) VALUES(actor,p_data->>'name') RETURNING * INTO w;
  INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(w.id,actor,'owner'); wid:=w.id;result:=to_jsonb(w);
 ELSE
  IF pid IS NOT NULL THEN
   SELECT * INTO p FROM public.projects WHERE id=pid;
   IF NOT FOUND OR private.fi6_project_role(actor,pid) IS NULL THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
   IF wid IS NOT NULL AND p_action<>'attach' AND wid IS DISTINCT FROM p.workspace_id THEN RAISE EXCEPTION 'WORKSPACE_ACCESS_DENIED'; END IF;
   IF p_action<>'attach' THEN wid:=p.workspace_id; END IF;
  END IF;
  IF wid IS NOT NULL THEN SELECT * INTO w FROM public.workspaces WHERE id=wid;actor_role:=private.fi6_workspace_role(actor,wid);IF actor_role IS NULL THEN RAISE EXCEPTION 'WORKSPACE_ACCESS_DENIED'; END IF; END IF;
  IF p_action='snapshot' THEN
   IF pid IS NULL AND wid IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   RETURN jsonb_build_object('workspaceId',wid,'role',actor_role,'platform','{}'::jsonb,'workspacePolicy',coalesce(w.policy,'{}'),'projectPolicy',coalesce(p.governance_policy,'{}'),
    'people',CASE WHEN actor_role IN ('owner','admin') THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT user_id,role,active FROM public.workspace_members WHERE workspace_id=wid ORDER BY user_id LIMIT 100) x),'[]') ELSE '[]'::jsonb END,
    'projects',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,name FROM public.projects WHERE workspace_id=wid AND private.fi6_project_role(actor,id) IS NOT NULL ORDER BY id LIMIT 100) x),'[]'));
  ELSIF p_action='member' THEN
   IF coalesce(actor_role,'') NOT IN ('owner','admin') OR target IS NULL OR target=w.owner_id OR desired NOT IN ('admin','editor','viewer') THEN RAISE EXCEPTION 'MEMBERSHIP_DENIED'; END IF;
   IF actor_role='admin' AND (desired='admin' OR EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=wid AND user_id=target AND role='admin')) THEN RAISE EXCEPTION 'ROLE_ESCALATION_DENIED'; END IF;
   SELECT to_jsonb(m) INTO old FROM public.workspace_members m WHERE workspace_id=wid AND user_id=target;
   INSERT INTO public.workspace_members(workspace_id,user_id,role,active) VALUES(wid,target,desired,coalesce((p_data->>'active')::boolean,true)) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active,updated_at=now();result:=jsonb_build_object('state','COMPLETED');
  ELSIF p_action='attach' THEN
   IF pid IS NULL OR actor_role IS DISTINCT FROM 'owner' OR p.owner_id IS DISTINCT FROM actor OR p.workspace_id IS NOT NULL THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
   UPDATE public.projects SET workspace_id=wid WHERE id=pid;result:=jsonb_build_object('projectId',pid,'workspaceId',wid);
  ELSIF p_action='policy' THEN
   IF NOT private.fi6_valid_policy(p_data->'policy') THEN RAISE EXCEPTION 'INVALID_POLICY'; END IF;
   IF wid IS NOT NULL AND actor_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
   IF pid IS NOT NULL THEN
    IF p.owner_id<>actor THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
    old:=p.governance_policy;UPDATE public.projects SET governance_policy=p_data->'policy' WHERE id=pid;
   ELSIF wid IS NOT NULL THEN old:=w.policy;UPDATE public.workspaces SET policy=p_data->'policy',updated_at=now() WHERE id=wid;
   ELSE RAISE EXCEPTION 'INVALID_INPUT'; END IF;
   result:=jsonb_build_object('state','COMPLETED');
  ELSE RAISE EXCEPTION 'INVALID_ACTION';
  END IF;
 END IF;
 INSERT INTO public.audit_events(actor_id,project_id,event_type,target_type,target_id,result,metadata) VALUES(actor,pid,'governance.'||p_action,'governance',coalesce(pid,wid),'succeeded',jsonb_strip_nulls(jsonb_build_object('workspaceId',wid,'memberId',target,'beforeRole',old->>'role','afterRole',desired,'policyChanged',p_action='policy')));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_governance(text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.xeomx_governance(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION private.fi6_allowed(uuid,uuid,text,text),private.fi6_policy_allows(jsonb,text,text),private.fi6_valid_policy(jsonb),private.fi6_governance_columns() FROM PUBLIC,anon,authenticated;
-- Constraints require policy validation but it grants no data access.
GRANT EXECUTE ON FUNCTION private.fi6_valid_policy(jsonb) TO authenticated,service_role;
COMMIT;
