import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/data")({ component: Page });
function Page() {
  const leaf = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  if (leaf !== Route.id) return <Outlet />;
  return <ProductEnvironmentPage environmentId="evidence" viewKey="datasets" />;
}
