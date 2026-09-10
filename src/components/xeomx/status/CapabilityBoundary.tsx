import type { ReactNode } from "react";
import type { BackendCapabilityId } from "@/lib/platform-contracts";
import { CapabilityStatusPanel } from "@/components/xeomx/product/CapabilityStatusPanel";
import { m } from "@/paraglide/messages.js";

/** The children are existing local previews, not an authorized execution surface. */
export function CapabilityBoundary({
  capability,
  children,
}: {
  capability: BackendCapabilityId;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4" data-execution-authorized="false">
      <p role="status" className="rounded-lg border p-3 text-sm">
        {m.p0_preview_only()}
      </p>
      <CapabilityStatusPanel capability={capability} />
      {children}
    </section>
  );
}
