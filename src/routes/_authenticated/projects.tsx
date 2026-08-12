import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkspace } from "@/components/xeomx/product/ProjectWorkspace";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: (search: Record<string, unknown>): { project?: string } =>
    typeof search.project === "string" && UUID_PATTERN.test(search.project)
      ? { project: search.project }
      : {},
  component: ProjectsRoute,
  ssr: false,
  head: () => ({
    meta: [{ title: "Projects — XEOMX" }, { name: "robots", content: "noindex" }],
  }),
});

function ProjectsRoute() {
  const { project } = Route.useSearch();
  const navigate = Route.useNavigate();
  const onProjectChange = useCallback(
    (projectId: string) => {
      void navigate({ search: { project: projectId }, replace: true });
    },
    [navigate],
  );

  return <ProjectWorkspace initialProjectId={project} onProjectChange={onProjectChange} />;
}
