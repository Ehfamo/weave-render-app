import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  ModelGateway,
  normalizeModelError,
  rankModels,
  ROUTING_POLICY,
} from "../src/lib/model-gateway/gateway.ts";

const request = {
  requestId: "r1",
  task: "draft",
  mode: "BALANCED",
  capability: "text",
  input: "hello",
};
const model = (providerId, quality = 0.5, latency = 100, cost = 0.1) => ({
  identity: { providerId, modelId: "model" },
  capabilities: ["text", "structured", "embedding"],
  quality,
  estimatedLatencyMs: latency,
  estimatedCostPer1kTokensUsd: cost,
});
function adapter(id = "a", overrides = {}) {
  return {
    provider: { id, displayName: id },
    getHealth: async () => ({ availability: "AVAILABLE", checkedAt: "2026-09-11T00:00:00Z" }),
    discoverModels: async () => [model(id)],
    execute: async () => ({
      ok: true,
      output: { kind: "text", text: "done" },
      usage: { inputTokens: 1, outputTokens: 2 },
    }),
    ...overrides,
  };
}

test("gateway projects canonical requests/responses and does not mutate caller input", async () => {
  const input = { ...request, privateExtra: "must-not-cross" };
  const gateway = new ModelGateway([
    adapter("a", {
      execute: async (r, m) => {
        assert.deepEqual(r, request);
        assert.ok(Object.isFrozen(r));
        assert.ok(Object.isFrozen(m));
        return {
          ok: true,
          rawHeaders: "secret",
          output: { kind: "text", text: "done", sdk: "secret" },
          usage: { inputTokens: 1, outputTokens: 2, raw: "secret" },
        };
      },
    }),
  ]);
  const response = await gateway.execute(input);
  assert.equal(response.ok, true);
  assert.deepEqual(response.model, { providerId: "a", modelId: "model" });
  assert.deepEqual(response.output, { kind: "text", text: "done" });
  assert.deepEqual(response.usage, { inputTokens: 1, outputTokens: 2 });
  assert.ok(response.latencyMs >= 0);
  assert.ok(!JSON.stringify(response).includes("secret"));
  assert.equal(input.privateExtra, "must-not-cross");
});

test("all normalized errors discard provider messages and credential-bearing details", async () => {
  for (const code of [
    "AUTH_ERROR",
    "RATE_LIMIT",
    "PROVIDER_UNAVAILABLE",
    "INVALID_REQUEST",
    "TIMEOUT",
    "CONTENT_REJECTED",
    "UNKNOWN_PROVIDER_ERROR",
  ]) {
    const error = normalizeModelError({ code, message: "secret-token", headers: "secret-token" });
    assert.equal(error.code, code);
    assert.ok(!JSON.stringify(error).includes("secret-token"));
  }
  const response = await new ModelGateway([
    adapter("a", {
      execute: async () => {
        throw new Error("secret-token");
      },
    }),
  ]).execute(request);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "UNKNOWN_PROVIDER_ERROR");
  assert.ok(!JSON.stringify(response).includes("secret-token"));
  const declared = await new ModelGateway([
    adapter("a", {
      execute: async () => ({ ok: false, error: { code: "AUTH_ERROR", message: "secret-token" } }),
    }),
  ]).execute(request);
  assert.equal(declared.error.code, "AUTH_ERROR");
  assert.ok(!JSON.stringify(declared).includes("secret-token"));
});

test("unavailable or failed providers do not break healthy independent adapters", async () => {
  const broken = adapter("broken", {
    getHealth: async () => {
      throw new Error("offline");
    },
  });
  const off = adapter("off", {
    getHealth: async () => ({ availability: "UNAVAILABLE" }),
    execute: () => assert.fail("must not execute"),
  });
  assert.equal((await new ModelGateway([broken, off, adapter()]).execute(request)).ok, true);
  assert.equal(
    (await new ModelGateway([broken, off]).execute(request)).error.code,
    "PROVIDER_UNAVAILABLE",
  );
  assert.throws(() => new ModelGateway([adapter(), adapter()]), /Duplicate/);
});

test("capabilities and discovery identities constrain provider selection", async () => {
  const bad = adapter("a", { discoverModels: async () => [model("other")] });
  assert.equal((await new ModelGateway([bad]).execute(request)).error.code, "PROVIDER_UNAVAILABLE");
  const textOnly = adapter("a", {
    discoverModels: async () => [{ ...model("a"), capabilities: ["text"] }],
  });
  assert.equal(
    (await new ModelGateway([textOnly]).execute({ ...request, capability: "embedding" })).error
      .code,
    "PROVIDER_UNAVAILABLE",
  );
});

test("FAST BALANCED BEST are deterministic quality/latency/cost policies, not provider aliases", () => {
  const candidates = [
    model("quick", 0.2, 10, 0.1),
    model("middle", 0.7, 200, 0.05),
    model("quality", 1, 2000, 1),
  ];
  const expected = { FAST: "quick", BALANCED: "middle", BEST: "quality" };
  for (const mode of Object.keys(expected)) {
    assert.equal(
      rankModels(candidates, { ...request, mode })[0].identity.providerId,
      expected[mode],
    );
    assert.deepEqual(
      rankModels(candidates, { ...request, mode }),
      rankModels([...candidates].reverse(), { ...request, mode }),
    );
    const renamed = candidates.map((m) => ({
      ...m,
      identity: { ...m.identity, providerId: "new-" + m.identity.providerId },
    }));
    assert.equal(
      rankModels(renamed, { ...request, mode })[0].identity.providerId,
      "new-" + expected[mode],
    );
    assert.ok(Object.isFrozen(ROUTING_POLICY[mode]));
  }
  assert.equal(rankModels([model("b"), model("a")], request)[0].identity.providerId, "a");
  assert.equal(rankModels([model("invalid", NaN)], request).length, 0);
});

test("invalid requests and cancellation never execute adapters", async () => {
  const gateway = new ModelGateway([
    adapter("a", { execute: () => assert.fail("must not execute") }),
  ]);
  for (const patch of [
    { input: "" },
    { mode: "a" },
    { maxOutputTokens: -1 },
    { capability: "video" },
  ]) {
    assert.equal((await gateway.execute({ ...request, ...patch })).error.code, "INVALID_REQUEST");
  }
  const controller = new AbortController();
  controller.abort();
  assert.equal((await gateway.execute(request, controller.signal)).error.code, "TIMEOUT");
});

test("malformed provider results fail closed and structured/embedding output is isolated", async () => {
  for (const result of [
    null,
    { ok: true, output: { kind: "embedding", values: [1] } },
    { ok: true, output: { kind: "text", text: "ok" }, usage: { inputTokens: -1, outputTokens: 1 } },
  ]) {
    const r = await new ModelGateway([adapter("a", { execute: async () => result })]).execute(
      request,
    );
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "UNKNOWN_PROVIDER_ERROR");
  }
  for (const output of [
    { kind: "embedding", values: [1, 2] },
    { kind: "structured", value: { title: "hello" } },
  ]) {
    const r = await new ModelGateway([
      adapter("a", { execute: async () => ({ ok: true, output }) }),
    ]).execute({ ...request, capability: output.kind });
    assert.equal(r.ok, true);
    assert.deepEqual(r.output, output);
    assert.notEqual(r.output, output);
  }
});

test("canonical contract surface imports no SDK and exposes no credential or native response types", async () => {
  const contracts = await readFile(
    new URL("../src/lib/model-gateway/contracts.ts", import.meta.url),
    "utf8",
  );
  assert.ok(!/^import /m.test(contracts));
  assert.ok(!/\b(any|apiKey|accessToken|OpenAI|Gemini|Groq|Cloudflare)\b/.test(contracts));
  for (const name of [
    "ProviderAdapter",
    "ModelRequest",
    "ModelResponse",
    "ProviderHealth",
    "ModelUsage",
  ])
    assert.ok(contracts.includes(` ${name} `));
});
