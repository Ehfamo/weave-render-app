import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/events")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="academy" viewKey="events" />;
}
