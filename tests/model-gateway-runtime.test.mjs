import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { ProviderRegistry } from "../src/lib/model-gateway/registry.ts";
import { GatewayRuntime } from "../src/lib/model-gateway/runtime.ts";
import { GroqAdapter } from "../src/lib/model-gateway/providers/groq.ts";

const request = { requestId: "r", task: "draft", mode: "FAST", capability: "text", input: "hello" };
const descriptor = (id, quality = 0.5, latency = 100, cost = 0.1) => ({
  identity: { providerId: id, modelId: "configured-model" },
  capabilities: ["text"],
  quality,
  estimatedLatencyMs: latency,
  estimatedCostPer1kTokensUsd: cost,
});
const success = { ok: true, output: { kind: "text", text: "reply" } };
function fake(id, execute = async () => success, model = descriptor(id)) {
  return {
    provider: { id, displayName: id },
    discoverModels: async () => [model],
    getHealth: async () => ({ availability: "AVAILABLE", checkedAt: "2026-09-11T00:00:00Z" }),
    execute,
  };
}
function runtime(adapters, policy) {
  const registry = new ProviderRegistry();
  adapters.forEach((a) => registry.register(a));
  return new GatewayRuntime(registry, policy);
}
const groq = (transport) =>
  new GroqAdapter({ apiKey: "test-only-key", models: [descriptor("groq")], fetch: transport });
const payload = (usage) => ({
  choices: [{ message: { content: "reply" }, finish_reason: "stop" }],
  ...(usage ? { usage } : {}),
});

test("registry exposes safe independent snapshots and enforces enabled state", async () => {
  const r = new ProviderRegistry();
  r.register(fake("a"));
  r.register(fake("b"), false);
  assert.throws(() => r.register(fake("a")), /duplicate/);
  const s = await r.snapshot();
  assert.equal(s[1].health.availability, "UNAVAILABLE");
  assert.deepEqual(s[1].models, []);
  s[0].models[0].capabilities.push("embedding");
  assert.deepEqual((await r.snapshot())[0].models[0].capabilities, ["text"]);
  r.setEnabled("a", false);
  assert.equal(r.getAdapter("a"), undefined);
  assert.throws(() => r.setEnabled("unknown", true));
  assert.equal((await new GatewayRuntime(r).execute(request)).error.code, "PROVIDER_UNAVAILABLE");
});

test("runtime executes all routing modes and deterministic ties", async () => {
  const adapters = [
    fake("quick", undefined, descriptor("quick", 0.2, 10, 0.1)),
    fake("middle", undefined, descriptor("middle", 0.7, 200, 0.05)),
    fake("quality", undefined, descriptor("quality", 1, 2000, 1)),
  ];
  for (const [mode, expected] of Object.entries({
    FAST: "quick",
    BALANCED: "middle",
    BEST: "quality",
  })) {
    const r = await runtime(adapters).execute({ ...request, mode });
    assert.equal(r.model.providerId, expected);
    assert.equal(r.mode, mode);
    assert.equal(r.attempts.length, 1);
  }
  assert.equal((await runtime([fake("b"), fake("a")]).execute(request)).model.providerId, "a");
});

test("transient failure falls back with recorded attempts and latency", async () => {
  const r = await runtime([
    fake("a", async () => ({
      ok: false,
      error: { code: "RATE_LIMIT", message: "private", retryable: false },
    })),
    fake("b"),
  ]).execute(request);
  assert.equal(r.ok, true);
  assert.equal(r.fallbackOccurred, true);
  assert.deepEqual(
    r.attempts.map((a) => a.outcome),
    ["RATE_LIMIT", "SUCCESS"],
  );
  assert.deepEqual(
    r.attempts.map((a) => a.model.providerId),
    ["a", "b"],
  );
  assert.ok(r.latencyMs >= 0);
  assert.ok(r.attempts.every((a) => a.latencyMs >= 0));
  assert.ok(!JSON.stringify(r).includes("private"));
});

test("non-retryable normalized failures never fallback regardless of adapter retry hint", async () => {
  for (const code of [
    "AUTH_ERROR",
    "INVALID_REQUEST",
    "CONTENT_REJECTED",
    "UNKNOWN_PROVIDER_ERROR",
  ]) {
    const r = await runtime([
      fake("a", async () => ({ ok: false, error: { code, retryable: true } })),
      fake("b", () => assert.fail("must not fallback")),
    ]).execute(request);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, code);
    assert.equal(r.attempts.length, 1);
  }
});

test("retries are bounded and no usage is invented for failures", async () => {
  let calls = 0;
  const r = await runtime([
    fake("a", async () => {
      calls++;
      return { ok: false, error: { code: "PROVIDER_UNAVAILABLE" } };
    }),
  ]).execute(request);
  assert.equal(calls, 3);
  assert.equal(r.attempts.length, 3);
  assert.equal(r.fallbackOccurred, false);
  assert.equal(r.usage, undefined);
  assert.throws(() => runtime([], { maxAttempts: 4 }));
  assert.throws(() => runtime([], { attemptTimeoutMs: NaN }));
});

test("hard timeout and caller abort terminate non-cooperative requests", async () => {
  const hanging = fake("a", () => new Promise(() => {}));
  const r = await runtime([hanging], { maxAttempts: 1, attemptTimeoutMs: 10 }).execute(request);
  assert.equal(r.error.code, "TIMEOUT");
  assert.equal(r.attempts.length, 1);
  const controller = new AbortController();
  controller.abort();
  const cancelled = await runtime([fake("a", () => assert.fail("aborted"))]).execute(
    request,
    controller.signal,
  );
  assert.equal(cancelled.error.code, "TIMEOUT");
  assert.equal(cancelled.attempts.length, 0);
});

test("Groq REST integration returns canonical text and supplied usage only", async () => {
  const a = groq(async (url, init) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(init.headers.Authorization, "Bearer test-only-key");
    assert.equal(init.redirect, "error");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "configured-model");
    assert.equal(body.max_completion_tokens, 12);
    assert.equal(body.messages[1].content, "hello");
    return Response.json(payload({ prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }));
  });
  const r = await runtime([a]).execute({ ...request, maxOutputTokens: 12 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.output, { kind: "text", text: "reply" });
  assert.deepEqual(r.usage, { inputTokens: 3, outputTokens: 4, totalTokens: 7 });
  assert.ok(!JSON.stringify(r).includes("test-only-key"));
  assert.ok(!JSON.stringify(a).includes("test-only-key"));
  const absent = await runtime([groq(async () => Response.json(payload()))]).execute(request);
  assert.equal(absent.usage, undefined);
});

test("Groq HTTP errors normalize and retry only transient classes", async () => {
  for (const [status, code, expectedCalls] of [
    [401, "AUTH_ERROR", 1],
    [403, "AUTH_ERROR", 1],
    [400, "INVALID_REQUEST", 1],
    [429, "RATE_LIMIT", 3],
    [503, "PROVIDER_UNAVAILABLE", 3],
    [404, "PROVIDER_UNAVAILABLE", 3],
  ]) {
    let calls = 0;
    const r = await runtime([
      groq(async () => {
        calls++;
        return new Response("private upstream body", { status });
      }),
    ]).execute(request);
    assert.equal(r.error.code, code);
    assert.equal(calls, expectedCalls);
    assert.ok(!JSON.stringify(r).includes("private"));
  }
});

test("Groq missing credentials and unsupported capabilities never make requests", async () => {
  const a = new GroqAdapter({
    models: [descriptor("groq")],
    fetch: () => assert.fail("no credential"),
  });
  assert.equal((await a.getHealth()).availability, "UNAVAILABLE");
  assert.deepEqual(await a.discoverModels(), []);
  assert.equal((await runtime([a]).execute(request)).error.code, "PROVIDER_UNAVAILABLE");
  const unsupported = await runtime([groq(() => assert.fail("capability mismatch"))]).execute({
    ...request,
    capability: "embedding",
  });
  assert.equal(unsupported.error.code, "PROVIDER_UNAVAILABLE");
});

test("refusals and malformed successful payloads do not masquerade as success", async () => {
  for (const [body, code] of [
    [{ choices: [{ finish_reason: "content_filter" }] }, "CONTENT_REJECTED"],
    [{ choices: [] }, "UNKNOWN_PROVIDER_ERROR"],
  ]) {
    const r = await runtime([groq(async () => Response.json(body))]).execute(request);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, code);
    assert.equal(r.attempts.length, 1);
  }
});

test("server composition is guarded and SDK-free contracts stay isolated", async () => {
  const server = await readFile(
    new URL("../src/lib/model-gateway/runtime.server.ts", import.meta.url),
    "utf8",
  );
  assert.ok(server.includes('import "@tanstack/react-start/server-only"'));
  assert.ok(!server.includes("VITE_GROQ"));
  for (const file of ["contracts.ts", "registry.ts", "runtime.ts", "gateway.ts"]) {
    const code = await readFile(
      new URL(`../src/lib/model-gateway/${file}`, import.meta.url),
      "utf8",
    );
    assert.ok(!code.includes("process.env"));
    assert.ok(!code.includes("api.groq.com"));
  }
});
