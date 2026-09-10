import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/for-you")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="projects" viewKey="for-you" />;
}
