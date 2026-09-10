import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/ecosystem")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="marketplace" viewKey="home" />;
}
