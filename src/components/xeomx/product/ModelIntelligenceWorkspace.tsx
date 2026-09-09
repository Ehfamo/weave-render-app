import type { ProductEnvironment, ProductSubpage } from "@/lib/product-architecture";
import type { ProductComplexityMode } from "@/hooks/use-product-complexity-mode";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";
import { CapabilityStatusPanel } from "./CapabilityStatusPanel";

/** Display the registered P0 model views without inventing benchmark scores or live models. */
export function ModelIntelligenceWorkspace({
  environment,
  subpage,
  mode,
}: {
  environment: ProductEnvironment;
  subpage: ProductSubpage;
  mode: ProductComplexityMode;
}) {
  return (
    <section
      className="space-y-4 p-4 text-start sm:p-6"
      aria-label={`${environment.title}: ${subpage.label}`}
    >
      <h2 className="text-xl font-semibold">{subpage.label}</h2>
      <CapabilityStatusPanel capability={subpage.adapter} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {subpage.features.map((feature) => (
          <li key={feature.key} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3>{feature.label}</h3>
              <FeatureStatusBadge status={feature.state} />
            </div>
            {mode === "advanced" ? (
              <p className="mt-3 break-words text-sm text-muted-foreground">{feature.dependency}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
