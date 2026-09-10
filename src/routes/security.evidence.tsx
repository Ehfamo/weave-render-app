import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/security/evidence")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="cybersecurity" viewKey="evidence-compliance" />;
}
