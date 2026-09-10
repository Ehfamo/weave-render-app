import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/models/registry")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="model-intelligence" viewKey="registry" />;
}
