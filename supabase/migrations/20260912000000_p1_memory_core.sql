BEGIN;
-- Additive private memory. Existing projects/conversations remain canonical.
CREATE TABLE public.xeomx_memory_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  disabled_types text[] NOT NULL DEFAULT '{}',
  CHECK (disabled_types <@ ARRAY['UserMemory','ProjectMemory','ConversationMemory','CharacterMemory','VoiceMemory','BrandMemory','PreferenceMemory','InstructionMemory']::text[])
);
CREATE TABLE public.xeomx_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('UserMemory','ProjectMemory','ConversationMemory','CharacterMemory','VoiceMemory','BrandMemory','PreferenceMemory','InstructionMemory')),
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 8000),
  importance double precision NOT NULL CHECK (importance >= 0 AND importance <= 1),
  source jsonb NOT NULL CHECK (jsonb_typeof(source) = 'object' AND source ? 'kind' AND jsonb_typeof(source->'kind') = 'string' AND source->>'kind' IN ('user','conversation','import') AND octet_length(source::text) <= 4000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (conversation_id IS NULL OR project_id IS NOT NULL),
  CHECK (type <> 'ProjectMemory' OR (project_id IS NOT NULL AND conversation_id IS NULL)),
  CHECK (type <> 'ConversationMemory' OR conversation_id IS NOT NULL)
);
CREATE INDEX xeomx_memory_owner_scope_idx ON public.xeomx_memories(user_id, project_id, conversation_id, updated_at DESC, id);
CREATE INDEX xeomx_memory_conversation_idx ON public.xeomx_memories(conversation_id);
CREATE INDEX xeomx_memory_project_idx ON public.xeomx_memories(project_id);
CREATE INDEX xeomx_memory_owner_type_idx ON public.xeomx_memories(user_id, type, status);

CREATE FUNCTION public.xeomx_memory_scope_allowed(p uuid, c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT (p IS NULL AND c IS NULL) OR
 (p IS NOT NULL AND public.xeomx_project_role(p) IS NOT NULL AND
 (c IS NULL OR EXISTS(SELECT 1 FROM public.conversations v WHERE v.id=c AND v.project_id=p)));
$$;
REVOKE ALL ON FUNCTION public.xeomx_memory_scope_allowed(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_memory_scope_allowed(uuid,uuid) TO authenticated;
ALTER TABLE public.xeomx_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xeomx_memory_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xeomx_memories, public.xeomx_memory_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xeomx_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.xeomx_memory_settings TO authenticated;
CREATE POLICY memory_settings_owner ON public.xeomx_memory_settings TO authenticated
 USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY memory_read ON public.xeomx_memories FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND public.xeomx_memory_scope_allowed(project_id,conversation_id));
CREATE POLICY memory_insert ON public.xeomx_memories FOR INSERT TO authenticated
 WITH CHECK (user_id=(SELECT auth.uid()) AND public.xeomx_memory_scope_allowed(project_id,conversation_id)
 AND EXISTS(SELECT 1 FROM public.xeomx_memory_settings s WHERE s.user_id=(SELECT auth.uid()) AND s.enabled AND NOT(type=ANY(s.disabled_types))));
CREATE POLICY memory_update ON public.xeomx_memories FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND public.xeomx_memory_scope_allowed(project_id,conversation_id))
 WITH CHECK (user_id=(SELECT auth.uid()) AND public.xeomx_memory_scope_allowed(project_id,conversation_id));
CREATE POLICY memory_delete ON public.xeomx_memories FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE FUNCTION public.xeomx_memory_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF ROW(NEW.id,NEW.user_id,NEW.project_id,NEW.conversation_id,NEW.type,NEW.source,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.id,OLD.user_id,OLD.project_id,OLD.conversation_id,OLD.type,OLD.source,OLD.created_at)
 THEN RAISE EXCEPTION 'immutable memory identity/provenance'; END IF;
 NEW.updated_at := now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_memory_immutable() FROM PUBLIC, anon;
CREATE TRIGGER memory_immutable BEFORE UPDATE ON public.xeomx_memories FOR EACH ROW EXECUTE FUNCTION public.xeomx_memory_immutable();

-- SECURITY INVOKER: every operation retains authenticated RLS and never accepts an owner override.
CREATE FUNCTION public.xeomx_memory(operation text, payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.xeomx_memories; s public.xeomx_memory_settings; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF operation='settings' THEN
   SELECT * INTO s FROM public.xeomx_memory_settings WHERE user_id=auth.uid();
   RETURN jsonb_build_object('enabled',coalesce(s.enabled,false),'disabledTypes',coalesce(to_jsonb(s.disabled_types),'[]'::jsonb));
 ELSIF operation='setSettings' THEN
   INSERT INTO public.xeomx_memory_settings(user_id,enabled,disabled_types)
   VALUES(auth.uid(),(payload->>'enabled')::boolean,ARRAY(SELECT jsonb_array_elements_text(payload->'disabledTypes')))
   ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,disabled_types=EXCLUDED.disabled_types;
   RETURN public.xeomx_memory('settings','{}');
 ELSIF operation='create' THEN
   INSERT INTO public.xeomx_memories(user_id,project_id,conversation_id,type,content,importance,source)
   VALUES(auth.uid(),(payload->'scope'->>'projectId')::uuid,(payload->'scope'->>'conversationId')::uuid,
    payload->>'type',payload->>'content',(payload->>'importance')::double precision,payload->'source') RETURNING * INTO r;
 ELSIF operation='get' THEN
   SELECT * INTO r FROM public.xeomx_memories WHERE id=(payload->>'id')::uuid;
 ELSIF operation='update' THEN
   UPDATE public.xeomx_memories SET content=coalesce(payload->>'content',content),importance=coalesce((payload->>'importance')::double precision,importance),status=coalesce(payload->>'status',status)
   WHERE id=(payload->>'id')::uuid RETURNING * INTO r;
 ELSIF operation='delete' THEN
   DELETE FROM public.xeomx_memories WHERE id=(payload->>'id')::uuid; RETURN 'null';
 ELSIF operation='list' THEN
   IF payload->'scope'->>'kind' NOT IN ('user','project','conversation') THEN RAISE EXCEPTION 'invalid scope'; END IF;
   SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') INTO result FROM (
     SELECT * FROM public.xeomx_memories WHERE
       project_id IS NOT DISTINCT FROM (payload->'scope'->>'projectId')::uuid AND
       conversation_id IS NOT DISTINCT FROM (payload->'scope'->>'conversationId')::uuid AND
       (NOT(payload ? 'types') OR type IN (SELECT jsonb_array_elements_text(payload->'types'))) AND
       (NOT(payload ? 'updatedSince') OR updated_at >= (payload->>'updatedSince')::timestamptz) AND
       importance >= coalesce((payload->>'minimumImportance')::double precision,0) AND
       (NOT(payload ? 'query') OR position(lower(payload->>'query') in lower(content))>0)
     ORDER BY updated_at DESC,id LIMIT least(100,greatest(1,coalesce((payload->>'limit')::integer,20)))
   ) m; RETURN result;
 ELSE RAISE EXCEPTION 'unsupported memory operation'; END IF;
 RETURN CASE WHEN r.id IS NULL THEN 'null'::jsonb ELSE to_jsonb(r) END;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_memory(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xeomx_memory(text,jsonb) TO authenticated;
COMMIT;
