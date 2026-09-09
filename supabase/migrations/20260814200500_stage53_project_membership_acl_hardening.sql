-- XEOMX Stage 5.3: membership management is not an authenticated client
-- surface. Keep read access under RLS and remove unused mutation privileges.

REVOKE INSERT, UPDATE, DELETE ON public.project_members
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.project_members TO authenticated;

