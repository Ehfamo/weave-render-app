import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/observability")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="evidence" viewKey="observability" />;
}
