import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkspace } from "@/components/xeomx/projects/ProjectWorkspace";
import { uuid } from "@/lib/memory/service";
export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  validateSearch: (v: Record<string, unknown>): { conversationId?: string } => ({
    conversationId: v.conversationId ? uuid(v.conversationId) : undefined,
  }),
  component: Page,
});
function Page() {
  const { projectId } = Route.useParams();
  const { conversationId } = Route.useSearch();
  return (
    <ProjectWorkspace
      key={`${projectId}:${conversationId ?? ""}`}
      projectId={projectId}
      initialConversationId={conversationId}
    />
  );
}
