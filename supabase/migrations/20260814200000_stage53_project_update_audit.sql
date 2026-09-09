-- Stage 5.3: make project profile updates auditable without adding a new
-- browser-callable SECURITY DEFINER function. Existing RLS and column grants
-- remain the authorization boundary for project updates.

CREATE OR REPLACE FUNCTION public.xeomx_audit_project_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    v_changed_fields := array_append(v_changed_fields, 'name');
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    v_changed_fields := array_append(v_changed_fields, 'description');
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_changed_fields := array_append(v_changed_fields, 'status');
  END IF;
  IF OLD.default_routing_mode IS DISTINCT FROM NEW.default_routing_mode THEN
    v_changed_fields := array_append(v_changed_fields, 'default_routing_mode');
  END IF;
  IF OLD.default_model IS DISTINCT FROM NEW.default_model THEN
    v_changed_fields := array_append(v_changed_fields, 'default_model');
  END IF;

  IF cardinality(v_changed_fields) > 0 THEN
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
      (SELECT auth.uid()),
      NEW.id,
      'project.updated',
      'project',
      NEW.id,
      'succeeded',
      jsonb_build_object('authorization', 'project-writer-rls'),
      jsonb_build_object('changed_fields', to_jsonb(v_changed_fields))
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.xeomx_audit_project_update()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xeomx_audit_project_update() TO service_role;

DROP TRIGGER IF EXISTS projects_audit_material_update ON public.projects;
CREATE TRIGGER projects_audit_material_update
  AFTER UPDATE OF name, description, status, default_routing_mode, default_model
  ON public.projects
  FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT FROM NEW.name
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.default_routing_mode IS DISTINCT FROM NEW.default_routing_mode
    OR OLD.default_model IS DISTINCT FROM NEW.default_model
  )
  EXECUTE FUNCTION public.xeomx_audit_project_update();

COMMENT ON FUNCTION public.xeomx_audit_project_update() IS
  'Trigger-only project update audit helper. Not executable through the Data API.';
