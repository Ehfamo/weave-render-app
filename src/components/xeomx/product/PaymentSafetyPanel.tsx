import { CapabilityStatusPanel } from "./CapabilityStatusPanel";

/** Payment availability and entitlement availability are independent requirements. */
export function PaymentSafetyPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CapabilityStatusPanel capability="payments" />
      <CapabilityStatusPanel capability="entitlements" />
    </div>
  );
}
