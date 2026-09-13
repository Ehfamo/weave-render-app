import { createFileRoute } from "@tanstack/react-router";
import { BusinessAgentsWorkspace } from "@/components/xeomx/business/BusinessAgentsWorkspace";
export const Route = createFileRoute("/_authenticated/business-agents")({
  component: BusinessAgentsWorkspace,
  ssr: false,
});
