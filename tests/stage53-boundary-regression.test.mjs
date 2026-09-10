import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson, hasSensitiveJson } from "../src/lib/stage53-json.ts";
import {
  validateIdempotencyEnvelope,
  validateOpaqueCredentialReferences,
  transitionControlledRun,
} from "../src/lib/agents/control-plane.ts";
import {
  buildEvalResult,
  safeEvidenceError,
  validateDatasetItem,
} from "../src/lib/evidence/evidence.ts";
import { InMemoryPaymentEventLedger, activateEntitlement } from "../src/lib/billing/index.ts";

test("JSON rejects cycles, accessors and sparse arrays without evaluating them", () => {
  const cycle = {};
  cycle.self = cycle;
  assert.equal(hasSensitiveJson(cycle), true);
  let read = false;
  const array = [];
  Object.defineProperty(array, "0", {
    get() {
      read = true;
      return "secret";
    },
  });
  assert.throws(() => canonicalJson(array));
  assert.equal(read, false);
  assert.throws(() => canonicalJson(Array(2)));
  assert.throws(() => canonicalJson({ value: Infinity }));
  assert.equal(canonicalJson(JSON.parse('{"__proto__":{"a":1}}')), '{"__proto__":{"a":1}}');
});

test("control-plane bounds match existing migration constraints and R2 retries need approval", () => {
  assert.equal(validateOpaqueCredentialReferences(["cred_short"]), false);
  assert.equal(validateOpaqueCredentialReferences(Array(21).fill("cred_abcdefgh")), false);
  assert.equal(
    validateIdempotencyEnvelope({ idempotencyKey: "a".repeat(15), requestHash: "a".repeat(64) }),
    false,
  );
  const run = { riskTier: "R2", state: "failed", attemptCount: 1, maxAttempts: 3 };
  assert.equal(transitionControlledRun(run, "queued", { actor: "service" }).allowed, false);
  assert.equal(
    transitionControlledRun(run, "queued", { actor: "service", exactOwnerApproval: "denied" })
      .allowed,
    false,
  );
  assert.equal(
    transitionControlledRun({ ...run, maxAttempts: 11 }, "queued", {
      actor: "service",
      exactOwnerApproval: "approved",
    }).allowed,
    false,
  );
});

test("evidence cannot report a fabricated score for empty or inconsistent evaluation", () => {
  for (const counts of [
    { totalItems: 0, passedItems: 0, failedItems: 0 },
    { totalItems: 2, passedItems: NaN, failedItems: 2 },
  ])
    assert.throws(() => buildEvalResult(counts));
  assert.equal(
    validateDatasetItem({
      externalKey: "item",
      position: 2147483648,
      input: "hello",
      contentSha256: "a".repeat(64),
    }).ok,
    false,
  );
  assert.equal(safeEvidenceError(new Error("private database content")).message, "DATABASE_FAILED");
});

test("payment ledger snapshots resist mutation and reject cross-owner activation", () => {
  const event = {
    provider: "test",
    providerEventId: "event",
    eventType: "payment_confirmed",
    userId: "11111111-1111-4111-8111-111111111111",
    checkoutIntentId: "22222222-2222-4222-8222-222222222222",
    payloadDigest: "a".repeat(64),
    signatureVerified: true,
    occurredAt: "2026-09-10T00:00:00Z",
    money: { amountMinor: 100, currency: "USD" },
  };
  const ledger = new InMemoryPaymentEventLedger();
  const first = ledger.record(event);
  first.event.money.amountMinor = 999;
  assert.equal(ledger.record(event).event.money.amountMinor, 100);
  assert.throws(() => ledger.record({ ...event, signatureVerified: "true" }));
  assert.throws(() =>
    activateEntitlement({
      current: "pending",
      entitlementUserId: "33333333-3333-4333-8333-333333333333",
      checkoutIntentId: event.checkoutIntentId,
      paymentEvent: event,
    }),
  );
});
