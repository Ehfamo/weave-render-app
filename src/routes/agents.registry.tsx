import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/agents/registry")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="agents" viewKey="registry" />;
}
