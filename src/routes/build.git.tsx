import { createFileRoute } from "@tanstack/react-router";
import { ProductEnvironmentPage } from "@/components/xeomx/product/ProductEnvironmentPage";
export const Route = createFileRoute("/build/git")({ component: Page });
function Page() {
  return <ProductEnvironmentPage environmentId="build" viewKey="git-devops" />;
}
