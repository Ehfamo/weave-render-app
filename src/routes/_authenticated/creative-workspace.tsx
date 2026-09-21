import { createFileRoute } from "@tanstack/react-router";
import { CreativeWorkspace } from "@/components/xeomx/creative/CreativeWorkspace";

export const Route = createFileRoute("/_authenticated/creative-workspace")({
  component: CreativeWorkspace,
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
});
