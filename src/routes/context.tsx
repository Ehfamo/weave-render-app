import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/context")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="settings" viewKey="context" />;
}
