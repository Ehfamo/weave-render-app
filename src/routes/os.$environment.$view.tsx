import { createFileRoute, notFound } from "@tanstack/react-router";
import { getProductEnvironment, getProductSubpage } from "@/lib/product-architecture";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/os/$environment/$view")({
  beforeLoad: ({ params }) => {
    const environment = getProductEnvironment(params.environment);
    if (!environment || !getProductSubpage(environment, params.view)) throw notFound();
  },
  component: Page,
});
function Page() {
  const params = Route.useParams();
  return <ProductEnvironmentPage environmentId={params.environment} viewKey={params.view} />;
}
