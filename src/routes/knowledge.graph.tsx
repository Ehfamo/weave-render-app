import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/knowledge/graph")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="knowledge" viewKey="graph" />;
}
