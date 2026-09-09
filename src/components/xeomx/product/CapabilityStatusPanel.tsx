import { getBackendCapability, type BackendCapabilityId } from "@/lib/platform-contracts";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";

/** Read-only inspection of the canonical backend contract; no service execution. */
export function CapabilityStatusPanel({ capability }: { capability: BackendCapabilityId }) {
  const contract = getBackendCapability(capability);
  return (
    <section className="rounded-xl border border-border p-4 text-start" aria-label={contract.label}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{contract.label}</h3>
        <FeatureStatusBadge status={contract.releaseState} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{contract.availableNow}</p>
      {contract.missingDependency ? (
        <p className="mt-2 break-words text-sm text-muted-foreground">
          {contract.missingDependency}
        </p>
      ) : null}
    </section>
  );
}
