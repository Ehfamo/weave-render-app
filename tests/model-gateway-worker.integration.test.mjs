import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import {
  createGroqGatewayRoute,
  GatewayRouteFailure,
} from "../supabase/functions/xeomx-generation-worker/groq-gateway.ts";

test("real worker bridge preserves system instructions, output identifiers and partial usage", async () => {
  let calls = 0;
  const route = createGroqGatewayRoute({
    getApiKey: () => "test-key",
    systemInstruction: "preserved worker instruction",
    fetch: async (_url, init) => {
      calls++;
      const body = JSON.parse(init.body);
      assert.equal(body.messages[0].content, "preserved worker instruction");
      assert.equal(body.messages[1].content, "queued prompt");
      assert.equal(body.model, "llama-3.1-8b-instant");
      assert.equal(body.max_completion_tokens, 32);
      return Response.json({
        id: "provider-request",
        choices: [{ message: { content: "generated" }, finish_reason: "length" }],
        usage: { prompt_tokens: 5 },
      });
    },
  });
  assert.equal(route.configured(), true);
  const output = await route.generate({ prompt: "queued prompt", maxTokens: 32 });
  assert.equal(calls, 1);
  assert.equal(output.text, "generated");
  assert.equal(output.providerRequestId, "provider-request");
  assert.equal(output.finishReason, "length");
  assert.deepEqual(output.usage, {
    inputUnits: 5,
    outputUnits: null,
    actualCostMicrounits: null,
    unavailable: true,
  });
});

test("worker bridge cannot multiply retry budget or retry authorization rejection", async () => {
  for (const status of [401, 403, 429, 503]) {
    let calls = 0;
    const route = createGroqGatewayRoute({
      getApiKey: () => "test-key",
      systemInstruction: "test",
      fetch: async () => {
        calls++;
        return new Response("private error", { status });
      },
    });
    await assert.rejects(route.generate({ prompt: "queued prompt", maxTokens: 32 }), (e) => {
      assert.ok(e instanceof GatewayRouteFailure);
      assert.equal(e.retryable, status >= 429);
      assert.ok(!e.message.includes("private"));
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("worker keeps authorization/queue/persistence and bundles one canonical gateway dependency graph", async () => {
  const source = await readFile(
    new URL("../supabase/functions/xeomx-generation-worker/index.ts", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes('getApiKey: () => Deno.env.get("GROQ_API_KEY")'));
  assert.ok(!source.includes("api.groq.com"));
  for (const marker of [
    "xeomx_validate_worker_token",
    "xeomx_complete_generation_job",
    "xeomx_begin_provider_fallback",
    "generateValidatedResearchOutput",
    "!previousFailure.retryable",
  ])
    assert.ok(source.includes(marker), marker);
  const bundle = await build({
    entryPoints: [
      new URL("../supabase/functions/xeomx-generation-worker/index.ts", import.meta.url).pathname,
    ],
    bundle: true,
    write: false,
    platform: "neutral",
    format: "esm",
    external: ["npm:*"],
    metafile: true,
    logLevel: "silent",
  });
  const inputs = Object.keys(bundle.metafile.inputs);
  assert.ok(inputs.some((p) => p.endsWith("src/lib/model-gateway/runtime.ts")));
  assert.ok(inputs.some((p) => p.endsWith("src/lib/model-gateway/providers/groq.ts")));
  assert.ok(!inputs.some((p) => p.endsWith("runtime.server.ts"))); // no Node env or TanStack dependency inside Deno worker
});
