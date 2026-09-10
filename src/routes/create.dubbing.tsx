import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/create/dubbing")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="create" viewKey="dubbing" />;
}
