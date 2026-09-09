import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BillingError,
  InMemoryPaymentEventLedger,
  activateEntitlement,
  createBillingBoundary,
  eventRevokesAccess,
  transitionBillingSubscription,
  transitionCheckoutIntent,
} from "../src/lib/billing/index.ts";

const checkoutRequest = {
  userId: "11111111-1111-4111-8111-111111111111",
  productKey: "xeomx-pro",
  idempotencyKey: "checkout:test:0001",
  money: { amountMinor: 1200, currency: "USD" },
  successUrl: "https://staging.example.test/billing/success",
  cancelUrl: "https://staging.example.test/billing/cancel",
};

const confirmedEvent = {
  provider: "test-provider",
  providerEventId: "event-0001",
  eventType: "payment_confirmed",
  userId: checkoutRequest.userId,
  checkoutIntentId: "33333333-3333-4333-8333-333333333333",
  payloadDigest: "a".repeat(64),
  signatureVerified: true,
  money: checkoutRequest.money,
  occurredAt: "2026-08-14T20:30:00.000Z",
};

test("checkout fails closed when no payment provider is configured", async () => {
  const billing = createBillingBoundary();
  await assert.rejects(
    billing.createCheckoutSession(checkoutRequest),
    (error) => error instanceof BillingError && error.code === "PAYMENT_PROVIDER_NOT_CONFIGURED",
  );
  assert.equal(billing.providerId, null);
});

test("an injected generic adapter remains behind the verification boundary", async () => {
  let checkoutCalls = 0;
  let webhookCalls = 0;
  const billing = createBillingBoundary({
    id: "test-provider",
    configured: true,
    async createCheckoutSession() {
      checkoutCalls += 1;
      return {
        provider: "test-provider",
        providerSessionId: "session-0001",
        checkoutUrl: "https://payments.example.test/session-0001",
        expiresAt: null,
      };
    },
    async verifyWebhook() {
      webhookCalls += 1;
      return confirmedEvent;
    },
  });

  const session = await billing.createCheckoutSession(checkoutRequest);
  const event = await billing.verifyWebhook({ rawBody: new Uint8Array(), headers: {} });
  assert.equal(session.provider, "test-provider");
  assert.equal(event.eventType, "payment_confirmed");
  assert.equal(checkoutCalls, 1);
  assert.equal(webhookCalls, 1);
});

test("provider and webhook mismatches fail closed", async () => {
  const billing = createBillingBoundary({
    id: "configured-provider",
    configured: true,
    async createCheckoutSession() {
      return {
        provider: "unexpected-provider",
        providerSessionId: "session-0001",
        checkoutUrl: "https://payments.example.test/session-0001",
        expiresAt: null,
      };
    },
    async verifyWebhook() {
      return { ...confirmedEvent, provider: "unexpected-provider" };
    },
  });

  await assert.rejects(
    billing.createCheckoutSession(checkoutRequest),
    (error) => error instanceof BillingError && error.code === "PAYMENT_PROVIDER_MISMATCH",
  );
  await assert.rejects(
    billing.verifyWebhook({ rawBody: new Uint8Array(), headers: {} }),
    (error) => error instanceof BillingError && error.code === "PAYMENT_PROVIDER_MISMATCH",
  );
});

test("payment event identity is idempotent by provider and event id", () => {
  const ledger = new InMemoryPaymentEventLedger();
  assert.equal(ledger.record(confirmedEvent).created, true);
  assert.equal(ledger.record({ ...confirmedEvent }).created, false);
  assert.equal(ledger.size, 1);

  assert.throws(
    () => ledger.record({ ...confirmedEvent, payloadDigest: "b".repeat(64) }),
    (error) => error instanceof BillingError && error.code === "PAYMENT_EVENT_IDEMPOTENCY_CONFLICT",
  );
});

test("checkout and subscription models cover failure, cancel and refund", () => {
  assert.equal(transitionCheckoutIntent("created", "provider_pending"), "provider_pending");
  assert.equal(transitionCheckoutIntent("provider_pending", "failed"), "failed");
  assert.equal(transitionCheckoutIntent("failed", "cancelled"), "cancelled");
  assert.equal(transitionBillingSubscription("pending", "active"), "active");
  assert.equal(transitionBillingSubscription("active", "refunded"), "refunded");
  assert.equal(eventRevokesAccess("refund_confirmed"), true);
  assert.equal(eventRevokesAccess("payment_confirmed"), false);
  assert.throws(
    () => transitionBillingSubscription("refunded", "active"),
    (error) => error instanceof BillingError && error.code === "INVALID_BILLING_TRANSITION",
  );
});

test("entitlement activation requires matching confirmed payment evidence", () => {
  assert.equal(
    activateEntitlement({
      current: "pending",
      entitlementUserId: checkoutRequest.userId,
      checkoutIntentId: confirmedEvent.checkoutIntentId,
      paymentEvent: confirmedEvent,
    }),
    "active",
  );

  assert.throws(
    () =>
      activateEntitlement({
        current: "pending",
        entitlementUserId: "22222222-2222-4222-8222-222222222222",
        checkoutIntentId: confirmedEvent.checkoutIntentId,
        paymentEvent: confirmedEvent,
      }),
    (error) => error instanceof BillingError && error.code === "PAYMENT_CONFIRMATION_REQUIRED",
  );
  assert.throws(
    () =>
      activateEntitlement({
        current: "pending",
        entitlementUserId: checkoutRequest.userId,
        checkoutIntentId: confirmedEvent.checkoutIntentId,
        paymentEvent: { ...confirmedEvent, eventType: "payment_failed" },
      }),
    (error) => error instanceof BillingError && error.code === "PAYMENT_CONFIRMATION_REQUIRED",
  );
});
