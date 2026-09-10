import type { CapabilityReleaseState } from "./platform-contracts";

/** Presentation hint only. Client release metadata never authorizes execution. */
export function getClientPolicyHint(state: CapabilityReleaseState) {
  return { releaseState: state, canNavigate: true, executionAuthorized: false as const };
}

export const RECENT_ACTION_KEY = "xeomx:p0:recent-navigation:v1";
export const NAVIGATION_TARGETS = [
  "/inbox",
  "/context",
  "/models/registry",
  "/data",
  "/evals",
  "/legal",
] as const;
export function recentNavigation(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === "string" && (NAVIGATION_TARGETS as readonly string[]).includes(entry),
      ),
    ),
  ].slice(0, 6);
}
