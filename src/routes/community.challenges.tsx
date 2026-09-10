import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/community/challenges")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="community" viewKey="challenges" />;
}
