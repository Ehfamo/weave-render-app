import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/xeomx-ai")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="ai" viewKey="chat" />;
}
