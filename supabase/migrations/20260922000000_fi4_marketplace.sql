-- FI4 MIGRATION_SOURCE_ONLY. Not applied to hosted/Production databases.
-- Existing project_members is the authoritative team boundary; no parallel org role model.
BEGIN;
CREATE TABLE public.marketplace_packages (
 id text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES auth.users(id),
 visibility text NOT NULL CHECK(visibility IN ('public','private','project')),
 scope_project_id uuid REFERENCES public.projects(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((visibility='project')=(scope_project_id IS NOT NULL))
);
CREATE TABLE public.marketplace_versions (
 id uuid PRIMARY KEY, package_id text NOT NULL REFERENCES public.marketplace_packages(id),
 version text NOT NULL CHECK(version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), entry jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(package_id,version)
);
CREATE TABLE public.marketplace_listings (
 id uuid PRIMARY KEY REFERENCES public.marketplace_versions(id),
 state text NOT NULL DEFAULT 'published' CHECK(state IN ('published','suspended','deprecated')),
 public_data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_trials (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), version_id uuid NOT NULL REFERENCES public.marketplace_versions(id),
 project_id uuid REFERENCES public.projects(id), request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('RUNNING','COMPLETED','FAILED','NOT_CONFIGURED','UNAVAILABLE')),
 record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_permission_grants (
 user_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES public.projects(id),
 package_id text NOT NULL REFERENCES public.marketplace_packages(id), version_id uuid NOT NULL REFERENCES public.marketplace_versions(id),
 digest text NOT NULL, record jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,project_id,package_id)
);
CREATE TABLE public.marketplace_reviews (
 user_id uuid NOT NULL REFERENCES auth.users(id), version_id uuid NOT NULL REFERENCES public.marketplace_versions(id),
 dimensions jsonb NOT NULL, body text NOT NULL CHECK(length(body) BETWEEN 2 AND 2000),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','reported','removed')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,version_id)
);
CREATE INDEX marketplace_trials_actor_version ON public.marketplace_trials(user_id,version_id,state);
CREATE INDEX marketplace_packages_scope ON public.marketplace_packages(scope_project_id);
ALTER TABLE public.marketplace_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.xeomx_marketplace_visible(p_version uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.marketplace_versions v JOIN public.marketplace_packages p ON p.id=v.package_id
 JOIN public.marketplace_listings l ON l.id=v.id WHERE v.id=p_version AND l.state='published' AND
 (p.visibility='public' OR p.owner_id=auth.uid() OR p.visibility='project' AND public.xeomx_project_role(p.scope_project_id) IS NOT NULL))
$$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_visible(uuid) TO anon,authenticated,service_role;
CREATE POLICY fi4_package_owner ON public.marketplace_packages FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY fi4_version_owner ON public.marketplace_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.marketplace_packages p WHERE p.id=marketplace_versions.package_id AND p.owner_id=auth.uid()));
CREATE POLICY fi4_safe_catalog ON public.marketplace_listings FOR SELECT TO anon,authenticated USING(public.xeomx_marketplace_visible(id));
CREATE POLICY fi4_trial_owner ON public.marketplace_trials FOR SELECT TO authenticated USING(user_id=auth.uid() AND (project_id IS NULL OR public.xeomx_project_role(project_id) IS NOT NULL));
CREATE POLICY fi4_grant_owner ON public.marketplace_permission_grants FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.xeomx_project_role(project_id) IS NOT NULL);
CREATE POLICY fi4_review_read ON public.marketplace_reviews FOR SELECT TO anon,authenticated USING(status='active' AND public.xeomx_marketplace_visible(version_id));
REVOKE ALL ON public.marketplace_packages,public.marketplace_versions,public.marketplace_listings,public.marketplace_trials,public.marketplace_permission_grants,public.marketplace_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.marketplace_listings,public.marketplace_reviews TO anon,authenticated;
GRANT SELECT ON public.marketplace_packages,public.marketplace_versions,public.marketplace_trials,public.marketplace_permission_grants TO authenticated;
GRANT ALL ON public.marketplace_packages,public.marketplace_versions,public.marketplace_listings,public.marketplace_trials,public.marketplace_permission_grants,public.marketplace_reviews TO service_role;
CREATE FUNCTION public.xeomx_marketplace_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PUBLISHED_VERSION_IMMUTABLE'; END $$;
CREATE TRIGGER marketplace_version_immutable BEFORE UPDATE OR DELETE ON public.marketplace_versions FOR EACH ROW EXECUTE FUNCTION public.xeomx_marketplace_immutable();
-- Only the authenticated server boundary can submit a validated SHA256 manifest.
CREATE FUNCTION public.xeomx_marketplace_publish(p_actor uuid,p_entry jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m jsonb:=p_entry->'manifest'; package public.marketplace_packages; scoped uuid:=nullif(p_entry->>'scopeProjectId','')::uuid;
BEGIN
 IF p_actor IS NULL OR (m->>'creatorId')::uuid IS DISTINCT FROM p_actor OR m#>>'{integrity,algorithm}' IS DISTINCT FROM 'sha256' OR (m#>>'{integrity,digest}') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_PUBLICATION'; END IF;
 IF p_entry->>'visibility'='project' AND NOT EXISTS(SELECT 1 FROM public.project_members pm JOIN public.projects p ON p.id=pm.project_id WHERE pm.project_id=scoped AND pm.user_id=p_actor AND pm.role IN ('owner','editor') AND p.status='active') THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 INSERT INTO public.marketplace_packages(id,owner_id,visibility,scope_project_id) VALUES(m->>'packageId',p_actor,p_entry->>'visibility',scoped) ON CONFLICT DO NOTHING;
 SELECT * INTO package FROM public.marketplace_packages WHERE id=m->>'packageId' FOR UPDATE;
 IF package.owner_id IS DISTINCT FROM p_actor OR package.visibility IS DISTINCT FROM p_entry->>'visibility' OR package.scope_project_id IS DISTINCT FROM scoped THEN RAISE EXCEPTION 'OWNER_OR_SCOPE_MISMATCH'; END IF;
 p_entry:=jsonb_set(p_entry,'{createdAt}',to_jsonb(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
 INSERT INTO public.marketplace_versions(id,package_id,version,digest,entry) VALUES((p_entry->>'id')::uuid,m->>'packageId',m->>'version',m#>>'{integrity,digest}',p_entry);
 INSERT INTO public.marketplace_listings(id,public_data) VALUES((p_entry->>'id')::uuid,jsonb_build_object('title',m->>'title','summary',m->>'summary','type',m->>'objectType','version',m->>'version','category',p_entry->>'category'));
 RETURN p_entry;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_publish(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_publish(uuid,jsonb) TO service_role;
CREATE FUNCTION public.xeomx_marketplace_trial(p_actor uuid,p_action text,p_record jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.marketplace_trials; v public.marketplace_versions; p public.marketplace_packages; tid uuid:=(p_record->>'id')::uuid; vid uuid:=(p_record->>'versionId')::uuid; pid uuid:=nullif(p_record->>'projectId','')::uuid; inserted uuid;
BEGIN
 IF p_actor IS NULL OR (p_record->>'userId')::uuid IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'ACTOR_REQUIRED'; END IF;
 SELECT * INTO v FROM public.marketplace_versions WHERE id=vid;
 SELECT * INTO p FROM public.marketplace_packages WHERE id=v.package_id;
 IF v.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.marketplace_listings WHERE id=vid AND state='published') OR NOT (p.visibility='public' OR p.owner_id=p_actor OR p.visibility='project' AND EXISTS(SELECT 1 FROM public.project_members pm JOIN public.projects pr ON pr.id=pm.project_id WHERE pm.project_id=p.scope_project_id AND pm.user_id=p_actor AND pr.status='active')) THEN RAISE EXCEPTION 'CAPABILITY_UNAVAILABLE'; END IF;
 IF pid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_members pm JOIN public.projects pr ON pr.id=pm.project_id WHERE pm.project_id=pid AND pm.user_id=p_actor AND pr.status='active') THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 IF p_action='claim' THEN
   IF p_record->>'state' IS DISTINCT FROM 'RUNNING' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
   INSERT INTO public.marketplace_trials(id,user_id,version_id,project_id,request_hash,state,record) VALUES(tid,p_actor,vid,pid,p_record->>'requestHash','RUNNING',p_record) ON CONFLICT DO NOTHING RETURNING id INTO inserted;
   SELECT * INTO old FROM public.marketplace_trials WHERE id=tid;
   IF old.user_id IS DISTINCT FROM p_actor OR old.request_hash IS DISTINCT FROM p_record->>'requestHash' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN jsonb_build_object('claimed',inserted IS NOT NULL,'record',old.record);
 ELSIF p_action='finish' THEN
   SELECT * INTO old FROM public.marketplace_trials WHERE id=tid FOR UPDATE;
   IF old.id IS NULL OR old.user_id IS DISTINCT FROM p_actor OR old.version_id IS DISTINCT FROM vid OR old.project_id IS DISTINCT FROM pid OR old.request_hash IS DISTINCT FROM p_record->>'requestHash' THEN RAISE EXCEPTION 'TRIAL_ACCESS_DENIED'; END IF;
   IF old.state <> 'RUNNING' THEN RETURN old.record; END IF;
   IF p_record->>'state' NOT IN ('COMPLETED','FAILED','NOT_CONFIGURED','UNAVAILABLE') OR (p_record->>'state'='COMPLETED' AND coalesce(length(p_record->>'output'),0)=0) OR coalesce(length(p_record->>'output'),0)>8000 THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
   UPDATE public.marketplace_trials SET record=p_record,state=p_record->>'state',updated_at=now() WHERE id=tid; RETURN p_record;
 END IF;
 RAISE EXCEPTION 'INVALID_ACTION';
END $$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_trial(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_trial(uuid,text,jsonb) TO service_role;
CREATE FUNCTION public.xeomx_marketplace_grant(p_version uuid,p_project uuid,p_digest text,p_permissions jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.marketplace_versions;
BEGIN
 IF auth.uid() IS NULL OR public.xeomx_project_role(p_project) NOT IN ('owner','editor') OR public.xeomx_project_role(p_project) IS NULL OR NOT public.xeomx_marketplace_visible(p_version) THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
 SELECT * INTO v FROM public.marketplace_versions WHERE id=p_version;
 IF v.digest IS DISTINCT FROM p_digest OR v.entry#>'{manifest,permissions}' IS DISTINCT FROM p_permissions THEN RAISE EXCEPTION 'REAPPROVAL_REQUIRED'; END IF;
 INSERT INTO public.marketplace_permission_grants(user_id,project_id,package_id,version_id,digest,record)
 VALUES(auth.uid(),p_project,v.package_id,p_version,v.digest,jsonb_build_object('packageId',v.package_id,'version',v.version,'digest',v.digest,'permissions',p_permissions))
 ON CONFLICT(user_id,project_id,package_id) DO UPDATE SET version_id=excluded.version_id,digest=excluded.digest,record=excluded.record,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_grant(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_grant(uuid,uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.xeomx_marketplace_review(p_version uuid,p_dimensions jsonb,p_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.marketplace_versions;
BEGIN
 SELECT * INTO v FROM public.marketplace_versions WHERE id=p_version;
 IF auth.uid() IS NULL OR NOT public.xeomx_marketplace_visible(p_version) OR (v.entry#>>'{manifest,creatorId}')::uuid=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.marketplace_trials t WHERE t.user_id=auth.uid() AND t.version_id=p_version AND t.state='COMPLETED' AND (t.project_id IS NULL OR public.xeomx_project_role(t.project_id) IS NOT NULL)) THEN RAISE EXCEPTION 'REVIEW_NOT_ELIGIBLE'; END IF;
 IF jsonb_typeof(p_dimensions) <> 'object' OR p_dimensions='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_each(p_dimensions) e WHERE e.key NOT IN ('usefulness','reliability','setup','documentation','value','support') OR e.value::text !~ '^[1-5]$') THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
 INSERT INTO public.marketplace_reviews(user_id,version_id,dimensions,body) VALUES(auth.uid(),p_version,p_dimensions,p_text)
 ON CONFLICT(user_id,version_id) DO UPDATE SET dimensions=excluded.dimensions,body=excluded.body,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.xeomx_marketplace_review(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xeomx_marketplace_review(uuid,jsonb,text) TO authenticated;
COMMIT;
-- Rollback: disable new Marketplace endpoints, export trial/review records, then remove the
-- FI4 functions/tables in reverse dependency order. No existing FI1-FI3 tables are altered.
