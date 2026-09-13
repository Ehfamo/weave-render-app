import { createFileRoute } from "@tanstack/react-router";
import { MarketplaceWorkspace } from "@/components/xeomx/marketplace/MarketplaceWorkspace";
export const Route = createFileRoute("/_authenticated/marketplace")({
  component: MarketplaceWorkspace,
  ssr: false,
});
