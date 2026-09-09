import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONTROL_PLANE_ACTIONS,
  canonicalizeControlPlaneValue,
  containsSensitiveKey,
  evaluateRunAdmission,
  transitionControlledRun,
  validateIdempotencyEnvelope,
  validateOpaqueCredentialReferences,
} from "../src/lib/agents/control-plane.ts";

test("R0 and R1 admit only their explicit sandbox allowlists", () => {
  for (const [riskTier, actions] of Object.entries(CONTROL_PLANE_ACTIONS).slice(0, 2)) {
    for (const actionKey of actions) {
      assert.deepEqual(evaluateRunAdmission({ riskTier, maxRiskTier: "R3", actionKey }), {
        admitted: true,
        initialState: "queued",
        approvalRequired: false,
        failureCode: null,
      });
    }
  }

  assert.equal(
    evaluateRunAdmission({
      riskTier: "R0",
      maxRiskTier: "R3",
      actionKey: "sandbox.echo",
    }).failureCode,
    "ACTION_NOT_ALLOWLISTED",
  );
  assert.equal(
    evaluateRunAdmission({ riskTier: "R1", maxRiskTier: "R3", actionKey: "unknown" }).failureCode,
    "ACTION_NOT_ALLOWLISTED",
  );
});

test("R2 waits and cannot execute without the exact owner approval synchronizer", () => {
  const admitted = evaluateRunAdmission({
    riskTier: "R2",
    maxRiskTier: "R2",
    actionKey: "external.write",
  });
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.initialState, "awaiting_approval");
  assert.equal(admitted.approvalRequired, true);

  const run = { riskTier: "R2", state: "awaiting_approval", attemptCount: 1, maxAttempts: 3 };
  assert.deepEqual(transitionControlledRun(run, "running", { actor: "service" }), {
    allowed: false,
    reason: "EXACT_OWNER_APPROVAL_REQUIRED",
  });
  assert.deepEqual(
    transitionControlledRun(run, "queued", {
      actor: "project-owner",
      exactOwnerApproval: "approved",
    }),
    { allowed: false, reason: "EXACT_OWNER_APPROVAL_REQUIRED" },
  );
  assert.deepEqual(
    transitionControlledRun(run, "queued", {
      actor: "approval-sync",
      exactOwnerApproval: "approved",
    }),
    { allowed: true, nextState: "queued", nextAttemptCount: 1 },
  );
});

test("R2 exact-owner denial is terminal", () => {
  const run = { riskTier: "R2", state: "awaiting_approval", attemptCount: 1, maxAttempts: 3 };
  assert.deepEqual(
    transitionControlledRun(run, "denied", {
      actor: "approval-sync",
      exactOwnerApproval: "denied",
    }),
    { allowed: true, nextState: "denied", nextAttemptCount: 1 },
  );
});

test("R3 remains default-deny even when ordinary approval is claimed", () => {
  const admission = evaluateRunAdmission({
    riskTier: "R3",
    maxRiskTier: "R3",
    actionKey: "production.deploy",
  });
  assert.deepEqual(admission, {
    admitted: false,
    initialState: "denied",
    approvalRequired: false,
    failureCode: "R3_DEFAULT_DENY",
  });
  assert.deepEqual(
    transitionControlledRun(
      { riskTier: "R3", state: "denied", attemptCount: 1, maxAttempts: 3 },
      "queued",
      { actor: "approval-sync", exactOwnerApproval: "approved" },
    ),
    { allowed: false, reason: "R3_DEFAULT_DENY" },
  );
});

test("service lifecycle covers failure, bounded recovery, success and cancel", () => {
  const queued = { riskTier: "R1", state: "queued", attemptCount: 1, maxAttempts: 2 };
  assert.equal(transitionControlledRun(queued, "running", { actor: "service" }).allowed, true);
  assert.equal(
    transitionControlledRun({ ...queued, state: "running" }, "failed", { actor: "service" })
      .allowed,
    true,
  );
  assert.deepEqual(
    transitionControlledRun({ ...queued, state: "failed" }, "queued", { actor: "service" }),
    { allowed: true, nextState: "queued", nextAttemptCount: 2 },
  );
  assert.deepEqual(
    transitionControlledRun({ ...queued, state: "failed", attemptCount: 2 }, "queued", {
      actor: "service",
    }),
    { allowed: false, reason: "ATTEMPTS_EXHAUSTED" },
  );
  assert.equal(transitionControlledRun(queued, "cancelled", { actor: "requester" }).allowed, true);
  assert.equal(
    transitionControlledRun({ ...queued, state: "running" }, "succeeded", { actor: "service" })
      .allowed,
    true,
  );
});

test("credential values and secret-shaped nested fields are rejected", () => {
  assert.equal(validateOpaqueCredentialReferences([]), true);
  assert.equal(validateOpaqueCredentialReferences(["cred_gemini_staging_01"]), true);
  assert.equal(validateOpaqueCredentialReferences(["raw-provider-key"]), false);
  assert.equal(containsSensitiveKey({ nested: [{ api_key: "not-stored" }] }), true);
  assert.equal(containsSensitiveKey({ credential_ref: "cred_gemini_staging_01" }), false);
  assert.equal(
    evaluateRunAdmission({
      riskTier: "R0",
      maxRiskTier: "R0",
      actionKey: "project.read",
      payload: { nested: { password: "not-stored" } },
    }).failureCode,
    "SENSITIVE_VALUE_REJECTED",
  );
});

test("idempotency envelope and canonical payload are deterministic", () => {
  assert.equal(
    validateIdempotencyEnvelope({
      idempotencyKey: "agent-run:test:0001",
      requestHash: "a".repeat(64),
    }),
    true,
  );
  assert.equal(
    validateIdempotencyEnvelope({ idempotencyKey: "short", requestHash: "A".repeat(64) }),
    false,
  );
  assert.equal(
    canonicalizeControlPlaneValue({ z: 2, a: { y: 1, x: [3, 2, 1] } }),
    canonicalizeControlPlaneValue({ a: { x: [3, 2, 1], y: 1 }, z: 2 }),
  );
});

test("definition maximum risk is enforced before admission", () => {
  assert.equal(
    evaluateRunAdmission({
      riskTier: "R2",
      maxRiskTier: "R1",
      actionKey: "external.write",
    }).failureCode,
    "RISK_EXCEEDS_DEFINITION",
  );
});
