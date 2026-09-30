import { COMMERCE_ACTIONS, safeCommerceInput } from "./commerce.ts";
import type { CommerceAction } from "./commerce.ts";
import type { MarketplaceService } from "./service.ts";
const SAFE_ERRORS = new Set([
  "NOT_CONFIGURED", "AUTH_REQUIRED", "REAPPROVAL_REQUIRED", "APPROVAL_REQUIRED", "APPROVAL_EXPIRED", "ALREADY_DECIDED", "APPROVER_REQUIRED",
  "OWNER_REQUIRED", "PROJECT_OWNER_REQUIRED", "PROJECT_ACCESS_DENIED", "TRANSACTION_ACCESS_DENIED", "ADJUSTMENT_ACCESS_DENIED", "PAYOUT_ACCESS_DENIED", "PUBLISHER_OWNER_REQUIRED",
  "PUBLISHED_VERSION_IMMUTABLE", "COMMERCE_SNAPSHOT_IMMUTABLE", "INVALID_PRICE", "INVALID_POLICY", "INVALID_TRANSITION", "INVALID_INPUT", "INVALID_ACTION", "UNSAFE_COMMERCE_INPUT", "SERVER_FACT_REQUIRED",
  "PUBLISHER_INELIGIBLE", "PUBLISHER_POLICY_REQUIRED", "CAPABILITY_UNAVAILABLE", "PRICE_EXPIRED", "IDEMPOTENCY_CONFLICT", "INTEGRITY_MISMATCH",
  "ENTERPRISE_PRICE_POLICY", "ENTERPRISE_PUBLISHER_POLICY", "ENTERPRISE_PERMISSION_POLICY", "ENTERPRISE_TYPE_POLICY", "ENTERPRISE_NETWORK_POLICY", "VERSION_PIN_REQUIRED", "LICENSE_POLICY", "SECURITY_NOT_VERIFIED",
  "REFUND_CEILING", "CURRENCY_MISMATCH", "NO_AVAILABLE_EARNINGS", "HELD_EARNINGS", "PAYOUT_INELIGIBLE", "PAYOUT_RECONCILIATION_REQUIRED", "COUNTERPARTY_DECISION_REQUIRED", "REFUND_RECONCILIATION_REQUIRED", "ENTITLEMENT_NOT_EXECUTABLE",
]);
/** One allow-listed browser boundary; verified provider events remain server-adapter only. */
export async function dispatchCommerce(service: Pick<MarketplaceService, "commerce">, value: unknown) {
  try {
    const request = safeCommerceInput(value);
    if (typeof request.action !== "string" || !(COMMERCE_ACTIONS as readonly string[]).includes(request.action)) throw Error("INVALID_ACTION");
    const data = await service.commerce(request.action as CommerceAction, request.input ?? {});
    return { ok: true as const, data };
  } catch (e) {
    const code = e instanceof Error ? e.message : "UNAVAILABLE";
    return { ok: false as const, error: SAFE_ERRORS.has(code) ? code : "UNAVAILABLE" };
  }
}
