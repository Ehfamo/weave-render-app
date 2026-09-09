import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROVIDER_EVAL_COMPUTE,
  EvidenceError,
  assertProviderComputeAvailable,
  buildEvalResult,
  buildEvidenceDraft,
  canTransitionEvalRun,
  canTransitionExperiment,
  canonicalizeEvidence,
  containsSecretLikeKey,
  evidenceSurfaceState,
  safeEvidenceError,
  summarizeDatasetItems,
  validateDatasetDraft,
  validateDatasetItem,
} from "../src/lib/evidence/evidence.ts";

const SHA = "a".repeat(64);

test("dataset validation preserves explicit empty and invalid states", () => {
  assert.equal(validateDatasetDraft({ name: "  " }).ok, false);
  assert.deepEqual(validateDatasetDraft({ name: "  Golden   Set  ", metadata: {} }), {
    ok: true,
    value: { name: "Golden Set", description: null, metadata: {} },
    issues: [],
  });
  assert.equal(
    validateDatasetItem({
      externalKey: "row-1",
      position: -1,
      input: { prompt: "hello" },
      contentSha256: "not-a-hash",
    }).ok,
    false,
  );
  assert.deepEqual(summarizeDatasetItems([]), {
    total: 0,
    valid: 0,
    invalid: 0,
    empty: true,
    duplicateKeys: [],
    duplicatePositions: [],
    state: "valid",
  });
});

test("dataset duplicate validation is deterministic", () => {
  const item = {
    externalKey: "same",
    position: 0,
    input: { prompt: "hello" },
    expectedOutput: null,
    contentSha256: SHA,
    metadata: {},
  };
  const summary = summarizeDatasetItems([item, { ...item }]);
  assert.equal(summary.state, "invalid");
  assert.deepEqual(summary.duplicateKeys, ["same"]);
  assert.deepEqual(summary.duplicatePositions, [0]);
});

test("eval and experiment state machines reject terminal rewrites", () => {
  assert.equal(canTransitionEvalRun("queued", "running"), true);
  assert.equal(canTransitionEvalRun("running", "succeeded"), true);
  assert.equal(canTransitionEvalRun("succeeded", "running"), false);
  assert.equal(canTransitionEvalRun("blocked", "queued"), false);
  assert.equal(canTransitionExperiment("draft", "running"), true);
  assert.equal(canTransitionExperiment("completed", "running"), false);

  assert.deepEqual(buildEvalResult({ totalItems: 4, passedItems: 3, failedItems: 1 }), {
    totalItems: 4,
    passedItems: 3,
    failedItems: 1,
    score: 0.75,
    status: "succeeded",
  });
  assert.throws(
    () => buildEvalResult({ totalItems: 4, passedItems: 4, failedItems: 1 }),
    EvidenceError,
  );
});

test("surface state distinguishes loading, empty, invalid and failure", () => {
  assert.equal(evidenceSurfaceState({ loading: true }), "loading");
  assert.equal(evidenceSurfaceState({ itemCount: 0 }), "empty");
  assert.equal(evidenceSurfaceState({ valid: false, itemCount: 2 }), "invalid");
  assert.equal(evidenceSurfaceState({ error: new Error("offline") }), "failure");
  assert.equal(evidenceSurfaceState({ valid: true, itemCount: 2 }), "ready");
});

test("provider eval compute remains explicitly disconnected and fail-closed", () => {
  assert.equal(PROVIDER_EVAL_COMPUTE.status, "DEPENDENCY_NOT_CONNECTED");
  assert.equal(PROVIDER_EVAL_COMPUTE.runtimeVerified, false);
  assert.throws(
    () => assertProviderComputeAvailable("configured"),
    (error) => {
      assert.equal(error.code, "PROVIDER_COMPUTE_DISCONNECTED");
      return true;
    },
  );
  assert.doesNotThrow(() => assertProviderComputeAvailable("verified"));
});

test("recursive JSON boundary rejects secret-like keys without storing values", () => {
  assert.equal(containsSecretLikeKey({ nested: [{ service_role_key: "redacted" }] }), true);
  assert.equal(containsSecretLikeKey({ provider: { gemini_api_key: "redacted" } }), true);
  assert.equal(containsSecretLikeKey({ provider: { clientSecret: "redacted" } }), true);
  assert.equal(containsSecretLikeKey({ request: { Authorization: "redacted" } }), true);
  assert.equal(containsSecretLikeKey({ request: { webhookSignature: "redacted" } }), true);
  assert.equal(containsSecretLikeKey({ metrics: { input_tokens: 5, latency_ms: 8 } }), false);
  assert.equal(validateDatasetDraft({ name: "unsafe", metadata: { password: "x" } }).ok, false);
  assert.equal(
    validateDatasetItem({
      externalKey: "unsafe",
      position: 0,
      input: { nested: { private_key: "x" } },
      contentSha256: SHA,
    }).ok,
    false,
  );
  assert.throws(
    () =>
      buildEvidenceDraft({
        kind: "manual",
        subjectType: "project",
        subjectId: null,
        title: "Unsafe evidence",
        summary: null,
        contentSha256: SHA,
        payload: { access_token: "x" },
      }),
    EvidenceError,
  );
});

test("canonical evidence and safe database errors are deterministic", () => {
  assert.equal(
    canonicalizeEvidence({ z: 1, a: { d: true, c: [2, 1] } }),
    '{"a":{"c":[2,1],"d":true},"z":1}',
  );
  assert.equal(
    safeEvidenceError(new Error("XEOMX_PROVIDER_COMPUTE_DISCONNECTED")).code,
    "PROVIDER_COMPUTE_DISCONNECTED",
  );
  assert.equal(safeEvidenceError(new Error("raw database detail")).code, "DATABASE_FAILED");
});
