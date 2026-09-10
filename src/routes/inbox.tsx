import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/inbox")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="projects" viewKey="inbox" />;
}
