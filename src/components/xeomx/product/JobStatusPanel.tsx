import type { BackendCapabilityId, JobSnapshot } from "@/lib/platform-contracts";
import { CapabilityStatusPanel } from "./CapabilityStatusPanel";

/** With no verified job, render availability rather than an invented job/progress bar. */
export function JobStatusPanel({
  capability,
  job,
}: {
  capability: BackendCapabilityId;
  job?: JobSnapshot;
}) {
  return (
    <div className="space-y-3">
      <CapabilityStatusPanel capability={capability} />
      {job ? (
        <ol aria-live="polite" className="space-y-2 text-sm">
          {job.history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <time>{entry.at}</time>
              {" · "}
              {entry.state}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
