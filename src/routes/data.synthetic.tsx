import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/data/synthetic")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="evidence" viewKey="synthetic-data" />;
}
