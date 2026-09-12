import { createFileRoute } from "@tanstack/react-router";
import { CreativeWorkspace } from "@/components/xeomx/creative/CreativeWorkspace";

export const Route = createFileRoute("/_authenticated/creative-workspace")({
  component: CreativeWorkspace,
  ssr: false,
});
