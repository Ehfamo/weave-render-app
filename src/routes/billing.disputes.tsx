import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/billing/disputes")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="billing" viewKey="disputes" />;
}
