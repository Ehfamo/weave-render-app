import { createFileRoute } from "@tanstack/react-router";
import { ProjectOperations } from "@/components/xeomx/team/ProjectOperations";
export const Route = createFileRoute("/_authenticated/project-operations")({
  component: ProjectOperations,
  ssr: false,
});
