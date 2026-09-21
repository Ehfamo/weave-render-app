import { createFileRoute } from "@tanstack/react-router";
import { ProjectOperations } from "@/components/xeomx/team/ProjectOperations";
export const Route = createFileRoute("/_authenticated/project-operations")({
  component: ProjectOperations,
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
});
