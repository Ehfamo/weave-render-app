import { createFileRoute } from "@tanstack/react-router";
import { MarketplaceWorkspace } from "@/components/xeomx/marketplace/MarketplaceWorkspace";
import { uuid } from "@/lib/memory/service";
export const Route = createFileRoute("/marketplace")({
  validateSearch: (
    v: Record<string, unknown>,
  ): { reference?: string; kind?: "job" | "conversation" } => ({
    reference: v.reference ? uuid(v.reference) : undefined,
    kind: v.kind === "job" ? "job" : "conversation",
  }),
  component: Page,
  ssr: false,
});
function Page() {
  const { reference, kind } = Route.useSearch();
  return <MarketplaceWorkspace reference={reference} kind={kind} />;
}
