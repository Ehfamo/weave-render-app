import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/tools")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="agents" viewKey="tools-hub" />;
}
