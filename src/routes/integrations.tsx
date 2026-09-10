import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/integrations")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="enterprise" viewKey="integrations" />;
}
