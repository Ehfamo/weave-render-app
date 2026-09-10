import { canonicalJson } from "../stage53-json.ts";

/** Pure provider boundary; persistence and authorization remain in Stage5.3 SQL. */
export class BillingError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "BillingError";
    this.code = code;
  }
}
type Money = { amountMinor: number; currency: string };
type CheckoutRequest = {
  userId: string;
  productKey: string;
  idempotencyKey: string;
  money: Money;
  successUrl: string;
  cancelUrl: string;
};
type CheckoutSession = {
  provider: string;
  providerSessionId: string;
  checkoutUrl: string;
  expiresAt: string | null;
};
const EVENT_TYPES = [
  "payment_pending",
  "payment_confirmed",
  "payment_failed",
  "payment_cancelled",
  "refund_pending",
  "refund_confirmed",
  "refund_failed",
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
] as const;
type PaymentEvent = {
  provider: string;
  providerEventId: string;
  eventType: (typeof EVENT_TYPES)[number];
  userId: string;
  checkoutIntentId: string;
  payloadDigest: string;
  signatureVerified: boolean;
  money?: Money;
  occurredAt: string;
};
type WebhookInput = { rawBody: Uint8Array; headers: Record<string, string> };
export interface BillingProvider {
  id: string;
  configured: boolean;
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(request: WebhookInput): Promise<PaymentEvent>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function moneyValid(money: Money) {
  return (
    money &&
    Number.isSafeInteger(money.amountMinor) &&
    money.amountMinor >= 0 &&
    /^[A-Z]{3}$/.test(money.currency)
  );
}
function httpsUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
function validateEvent(event: PaymentEvent) {
  if (
    !event ||
    event.signatureVerified !== true ||
    !UUID.test(event.userId) ||
    !UUID.test(event.checkoutIntentId) ||
    typeof event.provider !== "string" ||
    !event.provider.length ||
    event.provider.length > 80 ||
    typeof event.providerEventId !== "string" ||
    !event.providerEventId.length ||
    event.providerEventId.length > 240 ||
    !EVENT_TYPES.includes(event.eventType) ||
    !/^[a-f0-9]{64}$/.test(event.payloadDigest) ||
    !Number.isFinite(Date.parse(event.occurredAt)) ||
    (event.money !== undefined && !moneyValid(event.money))
  )
    throw new BillingError("PAYMENT_CONFIRMATION_REQUIRED");
}
export function createBillingBoundary(provider?: BillingProvider) {
  function configured(): BillingProvider {
    if (!provider?.configured || !provider.id)
      throw new BillingError("PAYMENT_PROVIDER_NOT_CONFIGURED");
    return provider;
  }
  return {
    providerId: provider?.configured ? provider.id : null,
    async createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession> {
      const adapter = configured();
      if (
        !request ||
        typeof request.productKey !== "string" ||
        typeof request.idempotencyKey !== "string" ||
        !UUID.test(request.userId) ||
        !request.productKey.trim() ||
        request.productKey.length > 160 ||
        request.idempotencyKey.length < 8 ||
        request.idempotencyKey.length > 250 ||
        !moneyValid(request.money) ||
        !httpsUrl(request.successUrl) ||
        !httpsUrl(request.cancelUrl)
      )
        throw new BillingError("INVALID_CHECKOUT_REQUEST");
      try {
        const session = await adapter.createCheckoutSession(structuredClone(request));
        if (session.provider !== adapter.id) throw new BillingError("PAYMENT_PROVIDER_MISMATCH");
        if (
          !session.providerSessionId ||
          !httpsUrl(session.checkoutUrl) ||
          (session.expiresAt !== null && !Number.isFinite(Date.parse(session.expiresAt)))
        )
          throw new BillingError("INVALID_PROVIDER_RESPONSE");
        return structuredClone(session);
      } catch (error) {
        if (error instanceof BillingError) throw error;
        throw new BillingError("PAYMENT_PROVIDER_UNAVAILABLE");
      }
    },
    async verifyWebhook(request: WebhookInput): Promise<PaymentEvent> {
      const adapter = configured();
      try {
        const event = await adapter.verifyWebhook(request);
        if (event.provider !== adapter.id) throw new BillingError("PAYMENT_PROVIDER_MISMATCH");
        validateEvent(event);
        return structuredClone(event);
      } catch (error) {
        if (error instanceof BillingError) throw error;
        throw new BillingError("WEBHOOK_VERIFICATION_FAILED");
      }
    },
  };
}
/** Test/local ledger only. Production idempotency uses SQL UNIQUE(provider, provider_event_id). */
export class InMemoryPaymentEventLedger {
  private readonly events = new Map<string, { fingerprint: string; event: PaymentEvent }>();
  get size() {
    return this.events.size;
  }
  record(event: PaymentEvent) {
    validateEvent(event);
    const fingerprint = canonicalJson(event);
    const key = JSON.stringify([event.provider, event.providerEventId]);
    const existing = this.events.get(key);
    if (existing && existing.fingerprint !== fingerprint)
      throw new BillingError("PAYMENT_EVENT_IDEMPOTENCY_CONFLICT");
    if (!existing) this.events.set(key, { fingerprint, event: structuredClone(event) });
    return { created: !existing, event: structuredClone(existing?.event ?? event) };
  }
}
const CHECKOUT = {
  created: ["provider_pending", "failed", "cancelled"],
  provider_pending: ["session_created", "failed", "cancelled"],
  session_created: ["completed", "failed", "cancelled", "expired"],
  completed: [],
  failed: ["provider_pending", "cancelled"],
  cancelled: [],
  expired: [],
} as const;
const SUBSCRIPTION = {
  pending: ["trialing", "active", "failed", "cancelled"],
  trialing: ["active", "past_due", "cancelled", "expired"],
  active: ["past_due", "cancelled", "expired", "refunded"],
  past_due: ["active", "cancelled", "expired", "refunded"],
  cancelled: ["refunded"],
  expired: [],
  refunded: [],
  failed: ["pending", "cancelled"],
} as const;
function transition<T extends string>(graph: Record<T, readonly string[]>, current: T, next: T): T {
  if (
    !Object.hasOwn(graph, current) ||
    !Object.hasOwn(graph, next) ||
    (current !== next && !graph[current].includes(next))
  )
    throw new BillingError("INVALID_BILLING_TRANSITION");
  return next;
}
export function transitionCheckoutIntent(
  current: keyof typeof CHECKOUT,
  next: keyof typeof CHECKOUT,
) {
  return transition(CHECKOUT, current, next);
}
export function transitionBillingSubscription(
  current: keyof typeof SUBSCRIPTION,
  next: keyof typeof SUBSCRIPTION,
) {
  return transition(SUBSCRIPTION, current, next);
}
export function eventRevokesAccess(type: PaymentEvent["eventType"]) {
  return type === "refund_confirmed" || type === "subscription_cancelled";
}
export function activateEntitlement(input: {
  current: "pending" | "active" | "revoked" | "expired";
  entitlementUserId: string;
  checkoutIntentId: string;
  paymentEvent: PaymentEvent;
}) {
  validateEvent(input.paymentEvent);
  if (
    !["pending", "active"].includes(input.current) ||
    input.paymentEvent.eventType !== "payment_confirmed" ||
    input.entitlementUserId !== input.paymentEvent.userId ||
    input.checkoutIntentId !== input.paymentEvent.checkoutIntentId
  )
    throw new BillingError("PAYMENT_CONFIRMATION_REQUIRED");
  return "active" as const;
}
