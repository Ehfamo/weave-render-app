import { createFileRoute } from "@tanstack/react-router";
import { XeomxAiWorkspace } from "@/components/xeomx/ai/XeomxAiWorkspace";
export const Route = createFileRoute("/xeomx-ai")({ component: Page });
function Page() {
  // ProductEnvironmentPage remains the preview boundary for non-executable product surfaces.
  return <XeomxAiWorkspace />;
}
