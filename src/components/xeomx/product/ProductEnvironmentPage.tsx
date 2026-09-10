import { notFound } from "@tanstack/react-router";
import { Header } from "@/components/xeomx/Header";
import { ProductWorkspacePreview } from "./ProductWorkspacePreview";
import { CapabilityBoundary } from "@/components/xeomx/status/CapabilityBoundary";
import { ProjectContextSummary } from "@/components/xeomx/os/ProjectContextSummary";
import { useProjectContext } from "@/components/xeomx/os/ProjectContextProvider";
import { useEffect, useRef } from "react";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";
import { getProductEnvironment, getProductSubpage } from "@/lib/product-architecture";

/** Read-only entry to existing canonical previews; does not enable provider actions. */
export function ProductEnvironmentPage({
  environmentId,
  viewKey,
}: {
  environmentId: string;
  viewKey: string;
}) {
  const { rememberHandoff } = useProjectContext();
  const viewHeadingRef = useRef<HTMLHeadingElement>(null);
  const environment = getProductEnvironment(environmentId);
  const subpage = environment && getProductSubpage(environment, viewKey);
  useEffect(() => {
    if (!environment || !subpage) return;
    rememberHandoff({
      environment: environment.id,
      view: subpage.key,
      at: new Date().toISOString(),
    });
    viewHeadingRef.current?.focus();
  }, [environment, subpage, rememberHandoff]);
  if (!environment || !subpage) throw notFound();
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-10 text-start">
        <header className="space-y-3">
          <p className="text-sm text-muted-foreground">{environment.title}</p>
          <h1 ref={viewHeadingRef} tabIndex={-1} className="break-words text-3xl font-semibold">
            {subpage.label}
          </h1>
          <p className="text-muted-foreground">{environment.description}</p>
          <FeatureStatusBadge status={subpage.state} />
        </header>
        <ProjectContextSummary />
        <CapabilityBoundary capability={subpage.adapter}>
          <ProductWorkspacePreview environment={environment} subpage={subpage} mode="simple" />
        </CapabilityBoundary>
      </main>
    </div>
  );
}
