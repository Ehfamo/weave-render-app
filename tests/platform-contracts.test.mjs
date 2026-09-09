import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKEND_CAPABILITY_IDS,
  CAPABILITY_RELEASE_STATES,
  createPrivacySafeErrorMetadata,
  createJobSnapshot,
  createPaymentSession,
  evaluateEffectivePermissions,
  getBackendAdapter,
  transitionJob,
  transitionPayment,
} from "../src/lib/platform-contracts.ts";
import { createEmptyProjectContext, recordProjectHandoff } from "../src/lib/project-context.ts";

test("the release vocabulary is canonical and backend adapters fail closed", async () => {
  assert.deepEqual(CAPABILITY_RELEASE_STATES, [
    "live",
    "beta",
    "preview",
    "mock",
    "planned",
    "unavailable",
  ]);

  for (const required of [
    "ai-provider",
    "generation-jobs",
    "research-jobs",
    "model-benchmarks",
    "evidence-datasets",
    "payments",
    "entitlements",
    "credentials",
    "policy-decisions",
    "approvals",
    "audit-events",
    "telemetry",
    "storage",
    "realtime",
    "deployment",
    "cybersecurity-events",
  ]) {
    assert.ok(BACKEND_CAPABILITY_IDS.includes(required), `Missing adapter contract: ${required}`);
    const result = await getBackendAdapter(required).execute({ preview: true });
    assert.equal(result.state, "unavailable");
    assert.equal(result.data, undefined);
    assert.equal(result.error?.code, "DEPENDENCY_UNAVAILABLE");
  }

  const localInterface = await getBackendAdapter("frontend-shell").execute({ route: "/ecosystem" });
  assert.equal(localInterface.state, "success");
  assert.deepEqual(localInterface.data, { route: "/ecosystem" });
});

test("job transitions support recovery without allowing fabricated completion", () => {
  let job = createJobSnapshot("job-1", "generation-jobs", "t0");
  assert.throws(
    () => transitionJob(job, { type: "SUCCEED", at: "t1", result: "fake" }),
    /Invalid job transition/,
  );

  job = transitionJob(job, { type: "QUEUE", at: "t1" });
  job = transitionJob(job, { type: "START", at: "t2" });
  job = transitionJob(job, { type: "PROGRESS", at: "t3", progress: 45, partialResult: "draft" });
  assert.equal(job.state, "partial");
  assert.equal(job.progress, 45);
  assert.equal(job.partialResult, "draft");

  job = transitionJob(job, { type: "PAUSE", at: "t4" });
  assert.equal(job.state, "paused");
  job = transitionJob(job, { type: "RESUME", at: "t5" });
  job = transitionJob(job, { type: "FAIL", at: "t6", reason: "provider disconnected" });
  assert.equal(job.state, "failed");
  assert.equal(job.failureReason, "provider disconnected");
  job = transitionJob(job, { type: "RETRY", at: "t7" });
  assert.equal(job.state, "retrying");
  assert.equal(job.attempt, 1);
  assert.equal(job.history.length, 8);
});

test("payment state never grants entitlement before confirmed payment", () => {
  let payment = createPaymentSession("order-opaque", "t0");
  assert.throws(
    () => transitionPayment(payment, { type: "ACTIVATE_ENTITLEMENT", at: "t1" }),
    /Invalid payment transition/,
  );

  payment = transitionPayment(payment, { type: "AWAIT_PROVIDER", at: "t1" });
  assert.equal(payment.submitLocked, true);
  assert.throws(
    () => transitionPayment(payment, { type: "AWAIT_PROVIDER", at: "duplicate" }),
    /Invalid payment transition/,
  );
  payment = transitionPayment(payment, { type: "CONFIRMING", at: "t2" });
  payment = transitionPayment(payment, {
    type: "CONFIRMED",
    at: "t3",
    providerReference: "opaque-confirmation",
  });
  assert.equal(payment.paymentConfirmed, true);
  assert.equal(payment.entitlementActive, false);
  payment = transitionPayment(payment, { type: "ENTITLEMENT_PENDING", at: "t4" });
  payment = transitionPayment(payment, { type: "ACTIVATE_ENTITLEMENT", at: "t5" });
  assert.equal(payment.entitlementActive, true);
  assert.equal(payment.orderReference, "order-opaque");
});

test("payment failure preserves the order and exposes a safe retry", () => {
  let payment = createPaymentSession("order-stable", "t0");
  payment = transitionPayment(payment, { type: "AWAIT_PROVIDER", at: "t1" });
  payment = transitionPayment(payment, { type: "FAIL", at: "t2" });
  assert.equal(payment.state, "payment-failed");
  assert.equal(payment.submitLocked, false);
  payment = transitionPayment(payment, { type: "RETRY", at: "t3" });
  assert.equal(payment.state, "checkout-start");
  assert.equal(payment.orderReference, "order-stable");
  assert.equal(payment.attempts, 1);
});

test("effective permission preview fails closed and requires exact approval", () => {
  const base = {
    target: "external repository",
    action: "write deployment",
    requestedScopes: ["repository:write"],
    grantedScopes: ["repository:write"],
    credentialReference: "credential-opaque",
    credentialRequired: true,
    budgetLimit: "10 credits",
    timeLimitMinutes: 15,
    dataAccess: "project only",
    consequence: "changes external state",
    reversible: true,
    externalEffect: "consequential",
  };

  const unavailable = evaluateEffectivePermissions({
    ...base,
    services: { credentials: false, policy: false, approvals: false, audit: false },
  });
  assert.equal(unavailable.decision, "unavailable");
  assert.equal(unavailable.canExecute, false);

  const approval = evaluateEffectivePermissions({
    ...base,
    services: { credentials: true, policy: true, approvals: true, audit: true },
  });
  assert.equal(approval.decision, "approval-required");
  assert.equal(approval.requiresHumanApproval, true);
  assert.equal(approval.canExecute, false);

  const safe = evaluateEffectivePermissions({
    ...base,
    credentialRequired: false,
    credentialReference: undefined,
    externalEffect: "none",
    services: { credentials: true, policy: true, approvals: true, audit: true },
  });
  assert.equal(safe.decision, "allowed");
  assert.equal(safe.canExecute, true);
});

test("project handoff preserves every opaque context reference", () => {
  const context = {
    ...createEmptyProjectContext(),
    projectId: "project-opaque",
    assetIds: ["asset-1"],
    fileIds: ["file-1"],
    selectedModelIds: ["model-1"],
    sourceIds: ["source-1"],
    referenceIds: ["reference-1"],
    conversationId: "conversation-1",
    permissionIds: ["permission-1"],
    jobIds: ["job-1"],
    historyIds: ["history-1"],
  };
  const next = recordProjectHandoff(context, {
    environment: "create",
    view: "video",
    at: "t1",
  });

  for (const key of [
    "projectId",
    "assetIds",
    "fileIds",
    "selectedModelIds",
    "sourceIds",
    "referenceIds",
    "conversationId",
    "permissionIds",
    "jobIds",
    "historyIds",
  ]) {
    assert.deepEqual(next[key], context[key], `${key} was lost during handoff`);
  }
  assert.deepEqual(next.lastLocation, { environment: "create", view: "video", at: "t1" });
});

test("future telemetry metadata strips sensitive payload fields", () => {
  const metadata = createPrivacySafeErrorMetadata({
    route: "/os/create/video",
    feature: "generation-job",
    category: "provider",
    recoverable: true,
    occurredAt: "t0",
    projectReference: "project-opaque",
    providerReference: "provider-opaque",
    jobReference: "job-opaque",
    promptContent: "must-not-leave-device",
    credential: "must-not-be-logged",
  });

  assert.deepEqual(Object.keys(metadata).sort(), [
    "category",
    "feature",
    "jobReference",
    "occurredAt",
    "projectReference",
    "providerReference",
    "recoverable",
    "route",
  ]);
  assert.ok(!JSON.stringify(metadata).includes("must-not"));
});
