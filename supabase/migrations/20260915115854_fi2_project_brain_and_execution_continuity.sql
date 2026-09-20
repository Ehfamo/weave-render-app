-- MIGRATION_SOURCE_ONLY. Never applied to Production by FI2.
-- Reuse projects, conversations and messages. No new project/history/memory tables.
BEGIN;
CREATE FUNCTION public.xeomx_valid_brain_entries(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE e jsonb; ids text[] := '{}'; goals integer := 0;
BEGIN
  IF value IS NULL OR jsonb_typeof(value) <> 'array' OR jsonb_array_length(value)>32
    OR char_length(value::text)>7400 THEN RETURN false; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(value) LOOP
    IF jsonb_typeof(e)<>'object' OR jsonb_typeof(e->'id')<>'string'
      OR NOT COALESCE(e->>'id' ~ '^[a-zA-Z0-9_-]{1,64}$',false)
      OR e->>'id'=ANY(ids) OR NOT COALESCE(e->>'kind' IN
        ('goal','instruction','constraint','decision','entity','openItem','preference','fact'),false)
      OR jsonb_typeof(e->'text') IS DISTINCT FROM 'string'
      OR char_length(btrim(e->>'text')) NOT BETWEEN 1 AND 1500
      OR jsonb_typeof(e->'resolved') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
    ids:=array_append(ids,e->>'id');
    IF e->>'kind'='goal' THEN goals:=goals+1; END IF;
  END LOOP;
  RETURN goals<=1;
END $$;
ALTER TABLE public.projects ADD COLUMN brain_entries jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (public.xeomx_valid_brain_entries(brain_entries));
-- Transfer only an unambiguous active owner document. Conflicts stop the migration.
DO $$
DECLARE p record; docs integer; content jsonb;
BEGIN
  FOR p IN SELECT id,owner_id FROM public.projects LOOP
    SELECT count(*) INTO docs FROM public.xeomx_memories m WHERE m.project_id=p.id
      AND m.user_id=p.owner_id AND m.source->>'reference'='xeomx.project-brain.v1' AND m.status='active';
    IF docs>1 THEN RAISE EXCEPTION 'BRAIN_CONFLICT'; END IF;
    IF docs=1 THEN
      SELECT m.content::jsonb INTO content FROM public.xeomx_memories m WHERE m.project_id=p.id
        AND m.user_id=p.owner_id AND m.source->>'reference'='xeomx.project-brain.v1' AND m.status='active';
      IF content->>'format' IS DISTINCT FROM 'xeomx.project-brain.v1' THEN RAISE EXCEPTION 'INVALID_BRAIN_STATE'; END IF;
      UPDATE public.projects SET brain_entries=content->'entries' WHERE id=p.id;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.xeomx_put_project_brain(p_project_id uuid, p_entries jsonb, p_expected jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_entries jsonb;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.xeomx_project_role(p_project_id),'') NOT IN ('owner','editor')
    THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
  SELECT brain_entries INTO current_entries FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
  IF p_expected IS NULL OR NOT (current_entries @> p_expected AND p_expected @> current_entries) THEN RAISE EXCEPTION 'BRAIN_CONFLICT'; END IF;
  IF NOT public.xeomx_valid_brain_entries(p_entries) THEN RAISE EXCEPTION 'INVALID_BRAIN_STATE'; END IF;
  UPDATE public.projects SET brain_entries=p_entries,updated_at=now() WHERE id=p_project_id;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_put_project_brain(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xeomx_put_project_brain(uuid,jsonb,jsonb) TO authenticated;

ALTER TABLE public.conversations ADD COLUMN core_execution jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(core_execution)='object' AND octet_length(core_execution::text)<=32000);
CREATE UNIQUE INDEX fi2_execution_actor_key ON public.conversations(created_by,(core_execution->>'key'))
  WHERE core_execution ? 'key';

-- Core execution transcripts are actor-private even inside a shared project.
-- Legacy conversations retain their existing collaborative behavior.
CREATE POLICY fi2_conversation_actor ON public.conversations AS RESTRICTIVE FOR ALL TO authenticated
  USING (core_execution='{}'::jsonb OR created_by=(SELECT auth.uid()))
  WITH CHECK (core_execution='{}'::jsonb OR created_by=(SELECT auth.uid()));
CREATE POLICY fi2_message_conversation ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND c.project_id=messages.project_id));
CREATE FUNCTION public.xeomx_conversation_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.project_id,NEW.created_by) IS DISTINCT FROM ROW(OLD.id,OLD.project_id,OLD.created_by)
    THEN RAISE EXCEPTION 'IMMUTABLE_CONVERSATION_IDENTITY'; END IF;
  IF current_user IN ('authenticated','anon') AND
    ((TG_OP='INSERT' AND NEW.core_execution<>'{}'::jsonb) OR
     (TG_OP='UPDATE' AND NEW.core_execution IS DISTINCT FROM OLD.core_execution))
    THEN RAISE EXCEPTION 'CONTROLLED_EXECUTION_REQUIRED'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_conversation_identity() FROM PUBLIC,anon;
CREATE TRIGGER fi2_conversation_identity BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.xeomx_conversation_identity();

-- Controlled transcript writes: existing authenticated clients have SELECT only on messages.
-- Definer is necessary for the atomic insert; actor, role and conversation ownership are rechecked.
CREATE FUNCTION public.xeomx_begin_core_execution(p_project_id uuid,p_execution_id uuid,
  p_previous_conversation_id uuid,p_goal text,p_key text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.conversations%ROWTYPE; response jsonb; output text;
BEGIN
  IF actor IS NULL OR COALESCE(public.xeomx_project_role(p_project_id),'') NOT IN ('owner','editor')
    THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
  IF p_goal IS NULL OR char_length(btrim(p_goal)) NOT BETWEEN 2 AND 50000
    OR NOT COALESCE(p_key ~ '^[A-Za-z0-9:_-]{16,200}$',false)
    OR NOT COALESCE(p_hash ~ '^[a-f0-9]{64}$',false) OR p_execution_id IS NULL
    THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF p_previous_conversation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.conversations
    WHERE id=p_previous_conversation_id AND project_id=p_project_id AND created_by=actor)
    THEN RAISE EXCEPTION 'CONVERSATION_ACCESS_DENIED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key,0));
  SELECT * INTO c FROM public.conversations WHERE created_by=actor AND core_execution->>'key'=p_key;
  IF FOUND THEN
    IF c.project_id<>p_project_id OR c.core_execution->>'hash' IS DISTINCT FROM p_hash
      THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    response:=c.core_execution->'response';
    IF response IS NOT NULL THEN
      SELECT content INTO output FROM public.messages WHERE conversation_id=c.id AND role='assistant'
        ORDER BY created_at DESC LIMIT 1;
      response:=jsonb_set(response,'{data}',(response->'data')||jsonb_build_object('goal',p_goal,'conversationId',c.id)
        ||CASE WHEN output IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('output',output) END);
    END IF;
    RETURN jsonb_strip_nulls(jsonb_build_object('conversationId',c.id,'created',false,'response',response));
  END IF;
  INSERT INTO public.conversations(id,project_id,created_by,title,core_execution)
    VALUES(p_execution_id,p_project_id,actor,left(btrim(p_goal),200),
      jsonb_build_object('key',p_key,'hash',p_hash,'state','RUNNING','previousConversationId',p_previous_conversation_id));
  INSERT INTO public.messages(project_id,conversation_id,author_id,role,content)
    VALUES(p_project_id,p_execution_id,actor,'user',btrim(p_goal));
  UPDATE public.projects SET updated_at=now() WHERE id=p_project_id;
  RETURN jsonb_build_object('conversationId',p_execution_id,'created',true);
END $$;

CREATE FUNCTION public.xeomx_finish_core_execution(p_conversation_id uuid,p_response jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); c public.conversations%ROWTYPE; d jsonb:=p_response->'data'; s text:=d->>'state';
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id=p_conversation_id AND created_by=actor FOR UPDATE;
  IF actor IS NULL OR NOT FOUND OR COALESCE(public.xeomx_project_role(c.project_id),'') NOT IN ('owner','editor')
    THEN RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'; END IF;
  IF NOT (c.core_execution ? 'key') THEN RAISE EXCEPTION 'INVALID_EXECUTION'; END IF;
  IF c.core_execution ? 'response' THEN RETURN; END IF;
  IF jsonb_typeof(p_response->'ok') IS DISTINCT FROM 'boolean' OR d->>'executionId' IS DISTINCT FROM c.id::text
    OR s IS NULL OR s NOT IN ('COMPLETED','FAILED','NOT_CONFIGURED','CANCELLED','BUDGET_STOPPED','APPROVAL_REQUIRED')
    OR (p_response->>'ok')::boolean IS DISTINCT FROM (s='COMPLETED')
    OR (s='COMPLETED' AND (jsonb_typeof(d->'output') IS DISTINCT FROM 'string' OR char_length(d->>'output') NOT BETWEEN 1 AND 200000))
    THEN RAISE EXCEPTION 'INVALID_EXECUTION'; END IF;
  IF s='COMPLETED' THEN
    INSERT INTO public.messages(project_id,conversation_id,role,content,metadata)
      VALUES(c.project_id,c.id,'assistant',d->>'output',jsonb_build_object('executionId',c.id));
  END IF;
  -- Persist safe result metadata once; raw goal/output live only in canonical messages.
  UPDATE public.conversations SET core_execution=core_execution||jsonb_build_object('state',s,
      'response',jsonb_set(p_response,'{data}',d-'goal'-'output')),updated_at=now() WHERE id=c.id;
  UPDATE public.projects SET updated_at=now() WHERE id=c.project_id;
END $$;
REVOKE ALL ON FUNCTION public.xeomx_begin_core_execution(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.xeomx_finish_core_execution(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xeomx_begin_core_execution(uuid,uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_finish_core_execution(uuid,jsonb) TO authenticated;
-- Existing membership RLS remains authoritative, with stricter actor isolation for FI1 transcripts.
-- Rollback: revert application first; retain both added columns/transcripts and legacy Brain rows.
-- Do not drop durable user data as an automatic rollback.
COMMIT;
