import { evaluateEffectivePermissions } from "@/lib/platform-contracts";
import { CapabilityStatusPanel } from "./CapabilityStatusPanel";

export function PermissionPreviewPanel({
  target,
  action,
  scopes,
  consequence,
  reversible,
}: {
  target: string;
  action: string;
  scopes: readonly string[];
  consequence: string;
  reversible: boolean;
}) {
  // The P0 preview has no authenticated policy result or granted scopes.
  // A local preview must never turn this into permission to execute an action.
  const decision = evaluateEffectivePermissions({
    target,
    action,
    requestedScopes: scopes,
    grantedScopes: [],
    credentialRequired: true,
    dataAccess: target,
    consequence,
    reversible,
    externalEffect: reversible ? "consequential" : "destructive",
    services: { credentials: false, policy: false, approvals: false, audit: false },
  });
  return (
    <section className="space-y-3 text-start" aria-label={target} data-decision={decision.decision}>
      <h3 className="font-medium">{target}</h3>
      <p className="text-sm text-muted-foreground">{consequence}</p>
      <ul className="flex flex-wrap gap-2">
        {scopes.map((scope) => (
          <li key={scope} className="break-all rounded border border-border px-2 py-1 text-xs">
            {scope}
          </li>
        ))}
      </ul>
      <CapabilityStatusPanel capability="policy-decisions" />
      <CapabilityStatusPanel capability="approvals" />
      <button
        type="button"
        disabled
        className="min-h-11 rounded border border-border px-4 opacity-60"
      >
        {action}
      </button>
    </section>
  );
}
