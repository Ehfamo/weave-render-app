-- P4 source-only additive persistence. Reuses workflow_definitions/versions,
-- controlled_runs, approval_requests, projects, project_members and audit_events.
CREATE TABLE public.automation_run_steps (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_id UUID NOT NULL REFERENCES public.controlled_runs(id) ON DELETE CASCADE,
 step_key TEXT NOT NULL CHECK(char_length(step_key) BETWEEN 1 AND 120), action_key TEXT NOT NULL CHECK(char_length(action_key) BETWEEN 3 AND 120),
 ordinal SMALLINT NOT NULL CHECK(ordinal BETWEEN 0 AND 19), state TEXT NOT NULL CHECK(state IN('queued','running','waiting_approval','completed','failed','cancelled')),
 retry_count SMALLINT NOT NULL DEFAULT 0 CHECK(retry_count BETWEEN 0 AND 2), approval_id UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL,
 result JSONB, error_code TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(run_id,step_key)
);
CREATE TABLE public.automation_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE, actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL CHECK(char_length(event_key) BETWEEN 1 AND 200), correlation_id TEXT NOT NULL CHECK(char_length(correlation_id) BETWEEN 1 AND 200),
 event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workflow_id,event_key)
);
CREATE TABLE public.project_assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, assignee_type TEXT NOT NULL CHECK(assignee_type IN('human','agent')),
 assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, assignee_agent_key TEXT,
 description TEXT NOT NULL CHECK(char_length(description) BETWEEN 1 AND 4000), priority TEXT NOT NULL CHECK(priority IN('low','normal','high')),
 status TEXT NOT NULL CHECK(status IN('queued','planning','waiting_approval','running','completed','failed','cancelled')),
 result_reference TEXT, due_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((assignee_type='human' AND assignee_user_id IS NOT NULL AND assignee_agent_key IS NULL) OR (assignee_type='agent' AND assignee_user_id IS NULL AND assignee_agent_key IS NOT NULL))
);
CREATE TABLE public.project_collaboration_activity (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, kind TEXT NOT NULL CHECK(kind IN('assignment','comment','approval','agent_result','workflow')),
 subject_id TEXT NOT NULL, summary TEXT NOT NULL CHECK(char_length(summary) BETWEEN 1 AND 500), trace_id TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.project_collaboration_comments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, subject_id TEXT NOT NULL,
 body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX automation_run_steps_run_idx ON public.automation_run_steps(run_id,ordinal);
CREATE INDEX automation_events_project_idx ON public.automation_events(project_id,created_at DESC);
CREATE INDEX project_assignments_project_idx ON public.project_assignments(project_id,updated_at DESC);
CREATE INDEX project_assignments_human_idx ON public.project_assignments(assignee_user_id,updated_at DESC) WHERE assignee_user_id IS NOT NULL;
CREATE INDEX collaboration_activity_project_idx ON public.project_collaboration_activity(project_id,created_at DESC);
CREATE INDEX collaboration_comments_project_idx ON public.project_collaboration_comments(project_id,created_at DESC);
ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY; ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.project_collaboration_activity ENABLE ROW LEVEL SECURITY; ALTER TABLE public.project_collaboration_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY p4_steps_read ON public.automation_run_steps FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.controlled_runs r JOIN public.project_members m ON m.project_id=r.project_id WHERE r.id=run_id AND m.user_id=auth.uid()));
CREATE POLICY p4_events_read ON public.automation_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=project_id AND m.user_id=auth.uid()));
CREATE POLICY p4_assignments_read ON public.project_assignments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=project_id AND m.user_id=auth.uid()));
CREATE POLICY p4_activity_read ON public.project_collaboration_activity FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=project_id AND m.user_id=auth.uid()));
CREATE POLICY p4_comments_read ON public.project_collaboration_comments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=project_id AND m.user_id=auth.uid()));
CREATE POLICY p4_comments_insert ON public.project_collaboration_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=project_id AND m.user_id=auth.uid()));
GRANT SELECT ON public.automation_run_steps,public.automation_events,public.project_assignments,public.project_collaboration_activity,public.project_collaboration_comments TO authenticated;
GRANT INSERT ON public.project_collaboration_comments TO authenticated;
GRANT ALL ON public.automation_run_steps,public.automation_events,public.project_assignments,public.project_collaboration_activity,public.project_collaboration_comments TO service_role;
