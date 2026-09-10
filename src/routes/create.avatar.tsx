import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/create/avatar")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="create" viewKey="avatar" />;
}
