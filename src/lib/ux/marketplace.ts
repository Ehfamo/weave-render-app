import type { MarketplacePermissionDeclaration } from "../marketplace/contracts.ts";
export type PermissionChange = {
  id: string;
  kind: "added" | "removed" | "risk_changed";
  from?: string;
  to?: string;
  requiresReview: boolean;
};
export function permissionDiff(
  previous: readonly MarketplacePermissionDeclaration[],
  next: readonly MarketplacePermissionDeclaration[],
): PermissionChange[] {
  const before = new Map(previous.map((x) => [x.id, x])),
    after = new Map(next.map((x) => [x.id, x])),
    result: PermissionChange[] = [];
  for (const item of next) {
    const old = before.get(item.id);
    if (!old)
      result.push({
        id: item.id,
        kind: "added",
        to: item.risk,
        requiresReview: item.risk !== "safe_read",
      });
    else if (old.risk !== item.risk)
      result.push({
        id: item.id,
        kind: "risk_changed",
        from: old.risk,
        to: item.risk,
        requiresReview: item.risk !== "safe_read",
      });
  }
  for (const item of previous)
    if (!after.has(item.id))
      result.push({ id: item.id, kind: "removed", from: item.risk, requiresReview: false });
  return result.sort((a, b) => a.id.localeCompare(b.id, "en"));
}
export const MARKETPLACE_STATUS_LABELS = {
  draft: "Draft",
  validating: "Validating",
  invalid: "Needs fixes",
  review_required: "Under review",
  approved: "Approved",
  published: "Published",
  suspended: "Suspended",
  deprecated: "Deprecated",
} as const;
export type SurfaceState =
  | "loading"
  | "empty"
  | "success"
  | "partial"
  | "permission_denied"
  | "unavailable"
  | "recoverable_failure"
  | "terminal_failure";
export const SURFACE_NEXT_ACTION: Record<SurfaceState, string> = {
  loading: "wait",
  empty: "start",
  success: "continue",
  partial: "review",
  permission_denied: "return",
  unavailable: "retry_later",
  recoverable_failure: "retry",
  terminal_failure: "return",
};
