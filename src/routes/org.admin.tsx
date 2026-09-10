import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/org/admin")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="enterprise" viewKey="admin" />;
}
