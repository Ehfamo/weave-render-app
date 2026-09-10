import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/research/monitoring")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="research" viewKey="monitoring" />;
}
