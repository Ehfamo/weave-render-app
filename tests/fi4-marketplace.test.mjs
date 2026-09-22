import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixture, entry, trialInput, actor, other } from "./helpers/fi4-fixture.mjs";
import { canonicalManifestValue } from "../src/lib/marketplace/validation.ts";
import { packageDigest, verifyPackage } from "../src/lib/marketplace/integrity.ts";
import { ModelGateway } from "../src/lib/model-gateway/gateway.ts";
import { evaluateCompatibility } from "../src/lib/intelligence/marketplace.ts";
import { SAFE_TRIAL_CONTEXT } from "../src/lib/marketplace/service.ts";
async function published(f, changes = {}, meta = {}) {
  const e = await entry(changes, meta);
  await f.service.publish(e);
  return e;
}
test("FI4 persisted port survives service recreation and exposes only real listings", async () => {
  const f = await fixture();
  assert.deepEqual(await f.service.discover(), []);
  const e = await published(f);
  assert.equal((await f.connect().discover())[0].id, e.id);
});
test("FI4 guest discovers public metadata without package payload or private context", async () => {
  const f = await fixture();
  const e = await published(f);
  const result = await f.connect(null).details(e.id);
  assert.equal(result.title, e.manifest.title);
  assert.equal(result.payload, undefined);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_CANARY|Summarize the supplied data/);
});
test("FI4 guest and other users cannot discover or inspect a private listing", async () => {
  const f = await fixture();
  const e = await published(f, {}, { visibility: "private" });
  for (const who of [null, other]) {
    assert.deepEqual(await f.connect(who).discover(), []);
    await assert.rejects(f.connect(who).details(e.id), /UNAVAILABLE/);
  }
});
test("FI4 team project listing remains isolated and membership revocation takes effect", async () => {
  const f = await fixture();
  const e = await published(f, {}, { visibility: "project", scopeProjectId: f.project });
  assert.deepEqual(await f.connect(other).discover(), []);
  f.fi2.db.members.set(`${other}:${f.project}`, "viewer");
  assert.equal((await f.connect(other).details(e.id)).id, e.id);
  f.fi2.db.members.delete(`${other}:${f.project}`);
  await assert.rejects(f.connect(other).details(e.id));
});
test("FI4 unauthorized publisher cannot mutate or publish another publisher version", async () => {
  const f = await fixture();
  const e = await published(f);
  await assert.rejects(f.connect(other).publish(e), /OWNER_REQUIRED/);
  await assert.rejects(f.service.publish(e), /IMMUTABLE/);
});
test("FI4 SHA256 is canonical order independent and matches the crypto reference", async () => {
  const e = await entry();
  assert.equal(
    e.manifest.integrity.digest,
    createHash("sha256").update(canonicalManifestValue(e.manifest)).digest("hex"),
  );
  const reverse = Object.fromEntries(Object.entries(e.manifest).reverse());
  assert.equal(await packageDigest(reverse), e.manifest.integrity.digest);
});
test("FI4 tampering is rejected before discovery, details, trial and permission readiness", async () => {
  const f = await fixture();
  const e = await published(f);
  f.entries.get(e.id).manifest.payload.prompt = "tampered";
  assert.deepEqual(await f.service.discover(), []);
  await assert.rejects(f.service.details(e.id), /INTEGRITY/);
  await assert.rejects(f.service.trial(trialInput(e)), /INTEGRITY/);
  await assert.rejects(f.service.readiness(e.id, f.project), /INTEGRITY/);
  assert.equal(f.calls.length, 0);
});
test("FI4 legacy weak fingerprint is never trusted", async () => {
  const e = await entry();
  e.manifest.integrity = { algorithm: "xeomx-canonical-v1", digest: "12345678" };
  await assert.rejects(verifyPackage(e.manifest), /INTEGRITY/);
});
test("FI4 P9 intent matching returns Research for competitor goal without title keyword", async () => {
  const f = await fixture();
  const e = await published(f);
  assert.equal((await f.service.discover({ goal: "competitor landscape" }))[0].id, e.id);
  assert.deepEqual(await f.service.discover({ goal: "unrelated zzzzz" }), []);
  assert.deepEqual(await f.service.discover({ type: "voice" }), []);
});
test("FI4 authorized task recommendation preserves original project and task without exposing the goal", async () => {
  const f = await fixture();
  await published(f);
  const id = crypto.randomUUID();
  const c = {
    id,
    projectId: f.project,
    userId: actor,
    title: "Research PRIVATE_CANARY competitors",
  };
  f.fi2.db.conversations.set(id, c);
  const r = await f.service.recommend(id, "conversation");
  assert.equal(r.recommendations.length, 1);
  assert.deepEqual(r.continuation, { projectId: f.project, referenceId: id, kind: "conversation" });
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_CANARY/);
  assert.deepEqual(f.fi2.db.conversations.get(id), c);
  assert.equal(r.autoInstall, false);
  assert.equal(r.autoBuy, false);
  assert.equal(f.grants.size, 0);
});
test("FI4 task recommendation denies another user and conversation reference", async () => {
  const f = await fixture();
  const id = crypto.randomUUID();
  f.fi2.db.conversations.set(id, { userId: actor, projectId: f.project, title: "Research" });
  await assert.rejects(f.connect(other).recommend(id, "conversation"));
  await assert.rejects(f.service.recommend(crypto.randomUUID(), "conversation"));
});
test("FI4 sample trial reaches canonical orchestrator tool and model boundary; Memory OFF remains isolated", async () => {
  const f = await fixture();
  const e = await published(f);
  const result = await f.service.trial(trialInput(e, { projectId: f.project }));
  assert.equal(result.state, "COMPLETED");
  assert.equal(f.calls.length, 1);
  assert.match(String(f.calls[0].input), new RegExp(SAFE_TRIAL_CONTEXT.slice(0, 14)));
  assert.doesNotMatch(String(f.calls[0].input), /PRIVATE_CANARY/);
  assert.equal(f.contexts.length, 0);
  assert.equal(f.fi2.db.memoryWrites, 0);
  assert.equal(f.calls[0].maxOutputTokens, 512);
  assert.equal(f.trials.get(result.id).state, "COMPLETED");
});
test("FI4 trial cannot make network calls without explicit approval", async () => {
  const f = await fixture();
  const e = await published(f);
  const result = await f.service.trial(trialInput(e, { allowNetwork: false }));
  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(f.calls.length, 0);
  assert.equal(result.errorCode, "NETWORK_APPROVAL_REQUIRED");
});
test("FI4 missing provider stays NOT_CONFIGURED and never produces successful trial eligibility", async () => {
  const f = await fixture();
  const e = await published(f);
  const svc = f.connect(actor, f.runtime(new ModelGateway([])));
  const result = await svc.trial(trialInput(e));
  assert.equal(result.state, "NOT_CONFIGURED");
  assert.equal((await f.service.details(e.id)).reviewEligibility, "NOT_ENOUGH_DATA");
});
test("FI4 explicit private project context is bounded and user authorized", async () => {
  const f = await fixture();
  const e = await published(f, {
    permissions: [
      { id: "model.reason", reason: "Synthesis", risk: "safe_read" },
      { id: "project.read", reason: "Explicit context", risk: "safe_read" },
    ],
  });
  const r = await f.service.trial(trialInput(e, { usePrivateContext: true, projectId: f.project }));
  assert.equal(r.state, "COMPLETED");
  assert.match(String(f.calls[0].input), /PRIVATE_CANARY/);
  assert.ok(String(f.calls[0].input).length <= 6000);
  await assert.rejects(
    f.connect(other).trial(trialInput(e, { usePrivateContext: true, projectId: f.project })),
    /PROJECT_ACCESS_DENIED/,
  );
});
test("FI4 private context requires both declared permission and explicit selection", async () => {
  const f = await fixture();
  const e = await published(f);
  await assert.rejects(
    f.service.trial(trialInput(e, { usePrivateContext: true, projectId: f.project })),
    /PRIVATE_CONTEXT_APPROVAL_REQUIRED/,
  );
  assert.equal(f.contexts.length, 0);
});
test("FI4 duplicate trial requests coalesce across service recreation and do not duplicate calls", async () => {
  const f = await fixture();
  const e = await published(f);
  const input = trialInput(e);
  await Promise.all([f.service.trial(input), f.connect().trial(input)]);
  assert.equal(f.calls.length, 1);
  await f.connect().trial(input);
  assert.equal(f.calls.length, 1);
  await assert.rejects(
    f.connect().trial({ ...input, allowNetwork: false }),
    /IDEMPOTENCY_CONFLICT/,
  );
});
test("FI4 undeclared permissions and MCP execution are denied in text sandbox", async () => {
  const f = await fixture();
  const e = await published(f);
  await assert.rejects(
    f.service.trial(trialInput(e, { approvedPermissionIds: [] })),
    /APPROVAL_REQUIRED/,
  );
  const mcp = await published(f, {
    packageId: "research.mcp",
    disclosure: {
      languages: ["en"],
      mcp: {
        tools: [
          {
            name: "send",
            schema: { type: "object" },
            permissionIds: ["model.reason"],
            consequential: true,
          },
        ],
        hosts: ["example.org"],
        credentialNames: ["EXAMPLE_ACCESS"],
      },
      trial: { mode: "text", providerRequired: true },
    },
  });
  await assert.rejects(f.service.trial(trialInput(mcp)), /TRIAL_UNAVAILABLE/);
  assert.equal((await f.service.details(mcp.id)).trust.security, "NOT_EVALUATED");
  assert.equal(f.calls.length, 0);
});
test("FI4 trust dimensions and unknown cost/privacy remain independent and evidence based", async () => {
  const f = await fixture();
  const e = await published(f);
  const d = await f.service.details(e.id);
  assert.equal(d.trust.integrity, "VERIFIED");
  assert.equal(d.trust.publisher, "NOT_VERIFIED");
  assert.equal(d.trust.signature, "NOT_CONFIGURED");
  assert.equal(d.trust.reliability, "NOT_ENOUGH_DATA");
  assert.equal(d.runtimeCost, "UNKNOWN");
  assert.equal(d.price, null);
  assert.equal(d.privacyState, "NOT_DECLARED");
  assert.equal(d.privacy.retention, "NOT_DECLARED");
});
test("FI4 version permission expansion requires explicit reapproval and carries no silent grant", async () => {
  const f = await fixture();
  const v1 = await published(f);
  assert.equal((await f.service.readiness(v1.id, f.project)).state, "APPROVAL_REQUIRED");
  await f.service.approvePermissions(v1.id, f.project, v1.manifest.integrity.digest, [
    "model.reason",
  ]);
  const v2 = await published(f, {
    version: "1.1.0",
    permissions: [
      ...v1.manifest.permissions,
      { id: "project.read", reason: "New data", risk: "safe_read" },
    ],
  });
  assert.equal((await f.service.readiness(v2.id, f.project)).state, "REAPPROVAL_REQUIRED");
  await assert.rejects(
    f.service.approvePermissions(v2.id, f.project, v1.manifest.integrity.digest, ["model.reason"]),
  );
  await f.service.approvePermissions(v2.id, f.project, v2.manifest.integrity.digest, [
    "model.reason",
    "project.read",
  ]);
  assert.equal((await f.service.readiness(v2.id, f.project)).state, "READY_FOR_ACQUISITION");
});
test("FI4 dependency graph resolves exact versions and rejects missing required dependencies", async () => {
  const f = await fixture();
  const dep = await published(f);
  const e = await published(f, {
    packageId: "research.composed",
    dependencies: [{ packageId: dep.manifest.packageId, version: "1.0.0", optional: false }],
  });
  assert.equal((await f.service.details(e.id)).graph.length, 2);
  await assert.rejects(
    published(f, {
      packageId: "research.missing",
      dependencies: [{ packageId: dep.manifest.packageId, version: "9.0.0", optional: false }],
    }),
    /MISSING_DEPENDENCY/,
  );
});
test("FI4 dependency cycles reject activation/readiness", async () => {
  const f = await fixture();
  const a = await entry({
    packageId: "cycle.aaa",
    dependencies: [{ packageId: "cycle.bbb", version: "1.0.0", optional: false }],
  });
  const b = await entry({
    packageId: "cycle.bbb",
    dependencies: [{ packageId: "cycle.aaa", version: "1.0.0", optional: false }],
  });
  f.entries.set(a.id, a);
  f.entries.set(b.id, b);
  await assert.rejects(f.service.readiness(a.id, f.project), /DEPENDENCY_CYCLE/);
  assert.equal((await f.service.details(a.id)).trial.eligible, false);
});
test("FI4 moderation signals describe duplicate metadata and missing declarations without accusations", async () => {
  const f = await fixture();
  await published(f);
  const e = await published(f, { packageId: "research.duplicate" });
  const d = await f.service.details(e.id);
  assert.ok(d.signals.includes("NORMALIZED_METADATA_DUPLICATE"));
  assert.ok(d.signals.includes("INCOMPLETE_PRIVACY_DECLARATION"));
  assert.ok(d.signals.includes("UNSIGNED_PACKAGE"));
  assert.doesNotMatch(JSON.stringify(d), /fraudulent|malicious/i);
});
test("FI4 reviews require actual completed version-specific trial and prohibit self review", async () => {
  const f = await fixture();
  const e = await published(f, { creatorId: actor });
  await assert.rejects(
    f.connect(other).review(e.id, { usefulness: 5 }, "Excellent"),
    /NOT_ELIGIBLE/,
  );
  await f.service.trial(trialInput(e));
  await assert.rejects(f.service.review(e.id, { usefulness: 5 }, "My own work"), /NOT_ELIGIBLE/);
  const buyer = f.connect(other, {
    async run() {
      return { state: "COMPLETED", output: "Test integration output" };
    },
  });
  await buyer.trial(trialInput(e));
  await buyer.review(e.id, { usefulness: 4, reliability: 3 }, "Useful output");
  assert.equal(f.reviews.length, 1);
  const next = await published(f, { version: "2.0.0" });
  await assert.rejects(
    buyer.review(next.id, { usefulness: 5 }, "Never tried this version"),
    /NOT_ELIGIBLE/,
  );
});
test("FI4 safe error handling never persists provider exception text", async () => {
  const f = await fixture();
  const e = await published(f);
  const result = await f
    .connect(actor, {
      async run() {
        throw Error("PRIVATE_PROVIDER_EXCEPTION");
      },
    })
    .trial(trialInput(e));
  assert.equal(result.state, "FAILED");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PROVIDER_EXCEPTION/);
});

test("FI4 compatibility compares minor/patch and exact dependency versions", async () => {
  const e = await entry({
    compatibility: { runtime: "xeomx", minimumVersion: "1.1.0", objectAdapter: "prompt" },
  });
  const context = {
    runtimeVersion: "1.0.9",
    installedPackages: {},
    allowedPermissions: new Set(),
    locale: "en",
    capabilities: [],
  };
  assert.equal(evaluateCompatibility(e.manifest, context).state, "INCOMPATIBLE");
  const d = await entry({
    dependencies: [{ packageId: "dep.pkg", version: "1.1.0", optional: false }],
  });
  assert.ok(
    evaluateCompatibility(d.manifest, {
      ...context,
      installedPackages: { "dep.pkg": "1.0.0" },
    }).reasons.includes("DEPENDENCY_INSTALL_REQUIRED"),
  );
});
test("FI4 configured sandbox cannot continue beyond runtime deadline", async (t) => {
  const f = await fixture();
  const e = await published(f);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let started;
  const start = new Promise((r) => {
    started = r;
  });
  const svc = f.connect(actor, {
    async run(_input, signal) {
      started();
      await new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(Error("Stopped")), { once: true }),
      );
    },
  });
  const pending = svc.trial(trialInput(e));
  await start;
  t.mock.timers.tick(8001);
  const r = await pending;
  assert.equal(r.state, "FAILED");
  assert.equal(f.trials.get(r.id).state, "FAILED");
});
