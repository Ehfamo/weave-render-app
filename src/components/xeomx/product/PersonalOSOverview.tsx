import type { ProductComplexityMode } from "@/hooks/use-product-complexity-mode";
import { PRODUCT_ENVIRONMENTS } from "@/lib/product-architecture";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";

/** Read-only settings catalog, distinct from persisted identity/account data. */
export function PersonalOSOverview({ mode }: { mode: ProductComplexityMode }) {
  const settings = PRODUCT_ENVIRONMENTS.find((environment) => environment.id === "settings")!;
  return (
    <section className="space-y-4 p-4 text-start sm:p-6" aria-label={settings.title}>
      <h2 className="text-xl font-semibold">{settings.title}</h2>
      <p className="text-sm text-muted-foreground">{settings.description}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {settings.subpages.map((view) => (
          <li key={view.key} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3>{view.label}</h3>
              <FeatureStatusBadge status={view.state} />
            </div>
            {mode === "advanced" ? (
              <p className="mt-3 text-sm text-muted-foreground">{view.dependency}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
