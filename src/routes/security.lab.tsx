import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/security/lab")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="cybersecurity" viewKey="lab" />;
}
