import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/components/xeomx/projects/ProjectsPage";
export const Route = createFileRoute("/_authenticated/projects/")({ component: ProjectsPage });
