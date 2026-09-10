import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/models/deployments")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="models" viewKey="deployments" />;
}
