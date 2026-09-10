import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/publish")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="create" viewKey="publishing" />;
}
