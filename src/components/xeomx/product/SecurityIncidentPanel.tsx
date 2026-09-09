import { CapabilityStatusPanel } from "./CapabilityStatusPanel";

/** Do not render a clean incident feed when neither the feed nor audit service is connected. */
export function SecurityIncidentPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CapabilityStatusPanel capability="cybersecurity-events" />
      <CapabilityStatusPanel capability="audit-events" />
    </div>
  );
}
