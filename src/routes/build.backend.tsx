import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/build/backend")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="build" viewKey="backend" />;
}
