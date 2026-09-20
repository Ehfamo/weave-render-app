import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AgentRegistry } from "../src/lib/agents/registry.ts";
import { DEFAULT_AGENTS } from "../src/lib/agents/runtimes.ts";
import {
  consumePendingGoal,
  createPendingGoal,
  PENDING_GOAL_KEY,
  savePendingGoal,
} from "../src/lib/core-execution/handoff.ts";
import { BoundedIdempotencyCache } from "../src/lib/core-execution/idempotency.ts";
import {
  runCoreExecution,
  validateCoreExecutionRequest,
} from "../src/lib/core-execution/service.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function storage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function dependencies(options = {}) {
  const registry = new AgentRegistry();
  registry.registerTool({
    id: "model.reason",
    description: "gateway",
    capability: "model.reason",
    risk: options.risk ?? "SAFE_READ",
    enabled: true,
    validate: () => true,
    execute: async () => "result",
  });
  registry.registerSkill({
    id: "general.reason",
    description: "general",
    capabilities: ["model.reason"],
    toolIds: ["model.reason"],
    enabled: true,
  });
  let calls = 0;
  const deps = {
    registry,
    inventory: {
      agents: DEFAULT_AGENTS.map((agent) => agent.definition),
      skills: registry.listSkills(),
      tools: registry.listTools(),
      providers: options.providers ?? [
        {
          model: { providerId: "test", modelId: "text" },
          capabilities: ["text"],
          enabled: true,
          health: "healthy",
          latencyMs: 1,
          successRate: 1,
          quality: 1,
          cost: {
            model: { providerId: "test", modelId: "text" },
            currency: "USD",
            effectiveAt: "2026-09-14T00:00:00.000Z",
          },
        },
      ],
      budget: { allowUnknown: true },
      allowedToolIds: new Set(["model.reason"]),
    },
    executeTask: async (task) => {
      calls++;
      return {
        trace: {
          taskId: task.id,
          agentId: "research",
          userId: task.userId,
          projectId: task.projectId,
          status: "completed",
          steps: [],
          events: [],
          retries: 0,
          startedAt: "2026-09-14T00:00:00.000Z",
          completedAt: "2026-09-14T00:00:01.000Z",
        },
        result: { summary: options.output ?? "actual server output" },
      };
    },
    evaluators: options.evaluators,
    repair: options.repair,
    id: () => "22222222-2222-4222-8222-222222222222",
    now: () => "2026-09-14T00:00:00.000Z",
  };
  return { deps, calls: () => calls };
}

test("Home stores a private goal handoff and does not put raw goal in the URL", async () => {
  const home = await read("src/components/xeomx/os/HomeExperience.tsx");
  assert.match(home, /savePendingGoal\(window\.localStorage/);
  assert.match(home, /navigate\(\{ to: "\/xeomx-ai" \}\)/);
  assert.doesNotMatch(home, /search:\s*\{\s*goal/);
});

test("pending goal survives auth storage, expires, and is consumed exactly once", () => {
  const store = storage();
  const pending = createPendingGoal("Research competitors", "BEST", 1000, "request_1234567890");
  savePendingGoal(store, pending);
  assert.ok(store.values.has(PENDING_GOAL_KEY));
  assert.deepEqual(consumePendingGoal(store, 2000), pending);
  assert.equal(consumePendingGoal(store, 2000), null);
  savePendingGoal(store, pending);
  assert.equal(consumePendingGoal(store, pending.expiresAt), null);
});

test("auth handoff returns only to the fixed XEOMX workspace", async () => {
  const workspace = await read("src/components/xeomx/ai/XeomxAiWorkspace.tsx");
  assert.match(workspace, /to: "\/auth", search: \{ next: "\/xeomx-ai" \}/);
  assert.match(
    workspace,
    /consumePendingGoal\(\s*window\.localStorage,\s*Date\.now\(\),\s*user\.id,\s*\{\s*projectId\s*\}/,
  );
});

test("server validation rejects unknown fields, invalid IDs, and capability injection", () => {
  const valid = { goal: "Answer this", idempotencyKey: "request_1234567890" };
  assert.equal(validateCoreExecutionRequest(valid).goal, "Answer this");
  for (const value of [
    { ...valid, goal: "" },
    { ...valid, projectId: "not-a-uuid" },
    { ...valid, providerId: "arbitrary" },
    { ...valid, requestedAgent: "browser" },
    { ...valid, capabilities: ["admin"] },
  ])
    assert.throws(() => validateCoreExecutionRequest(value), /INVALID_REQUEST/);
});

test("bounded idempotency returns one promise for duplicate execution", async () => {
  const cache = new BoundedIdempotencyCache();
  let calls = 0;
  const operation = async () => ++calls;
  const [a, b] = await Promise.all([
    cache.run("actor:key", "hash", operation, 1),
    cache.run("actor:key", "hash", operation, 1),
  ]);
  assert.deepEqual([a, b], [1, 1]);
  assert.equal(calls, 1);
  assert.throws(() => cache.run("actor:key", "other", operation, 1), /IDEMPOTENCY_CONFLICT/);
});

test("runtime uses P9 brief and planner, executes, and returns a safe trace", async () => {
  const { deps, calls } = dependencies();
  const response = await runCoreExecution(
    actor,
    { goal: "Research competitors", idempotencyKey: "request_1234567890" },
    deps,
  );
  assert.equal(response.ok, true);
  assert.equal(response.data.output, "actual server output");
  assert.equal(calls(), 1);
  assert.equal(response.data.trace.intentKind, "RESEARCH");
  assert.deepEqual(response.data.trace.capabilityIds, ["research", "synthesis"]);
  assert.doesNotMatch(
    JSON.stringify(response.data.trace),
    /Research competitors|actual server output/,
  );
});

test("missing provider is NOT_CONFIGURED and never executes an agent", async () => {
  const { deps, calls } = dependencies({ providers: [] });
  const response = await runCoreExecution(
    actor,
    { goal: "Answer this", idempotencyKey: "request_1234567890" },
    deps,
  );
  assert.equal(response.ok, false);
  assert.equal(response.data.state, "NOT_CONFIGURED");
  assert.equal(calls(), 0);
});

test("missing evaluator stays NOT_EVALUATED while output is delivered", async () => {
  const { deps } = dependencies();
  const response = await runCoreExecution(
    actor,
    { goal: "Answer this", idempotencyKey: "request_1234567890" },
    deps,
  );
  assert.equal(response.ok, true);
  assert.equal(response.data.quality.confidence, "NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(response.data.quality.findings[0].status, "NOT_EVALUATED");
});

test("quality repair is invoked and bounded to two", async () => {
  let repairs = 0;
  const evaluator = {
    id: "instruction",
    verticals: ["GENERAL"],
    async evaluate(output) {
      return {
        evaluatorId: "instruction",
        status: output === "fixed" ? "PASS" : "FAIL",
        code: "CHECK",
        repairable: true,
      };
    },
  };
  const first = dependencies({
    evaluators: [evaluator],
    repair: async () => {
      repairs++;
      return "fixed";
    },
  });
  const response = await runCoreExecution(
    actor,
    { goal: "Answer this", idempotencyKey: "request_1234567890" },
    first.deps,
  );
  assert.equal(response.ok, true);
  assert.equal(response.data.quality.repairCount, 1);
  assert.equal(repairs, 1);
  const neverPass = {
    ...evaluator,
    evaluate: async () => ({
      evaluatorId: "instruction",
      status: "FAIL",
      code: "CHECK",
      repairable: true,
    }),
  };
  const bounded = dependencies({ evaluators: [neverPass], repair: async (value) => value });
  const stopped = await runCoreExecution(
    actor,
    { goal: "Answer this", idempotencyKey: "request_abcdefghij" },
    bounded.deps,
  );
  assert.equal(stopped.ok, false);
  assert.ok(stopped.data.quality.repairCount <= 2);
});

test("approval-required intent stops before orchestration", async () => {
  const { deps, calls } = dependencies();
  const response = await runCoreExecution(
    actor,
    {
      goal: "When a lead replies, create a follow-up task",
      idempotencyKey: "request_1234567890",
    },
    deps,
  );
  assert.equal(response.ok, false);
  assert.equal(response.data.state, "APPROVAL_REQUIRED");
  assert.equal(calls(), 0);
});

test("composition uses canonical registries, orchestrator, and Model Gateway", async () => {
  const runtime = await read("src/lib/core-execution/runtime.server.ts");
  assert.match(runtime, /createCanonicalTools/);
  assert.match(runtime, /canonicalSkills/);
  assert.match(runtime, /DEFAULT_AGENTS/);
  assert.match(runtime, /new TaskOrchestrator/);
  assert.match(runtime, /createModelGatewayRuntime/);
  assert.doesNotMatch(runtime, /P9.*fixture|fake provider/i);
});

test("UI renders server output and failure states have a next action", async () => {
  const workspace = await read("src/components/xeomx/ai/XeomxAiWorkspace.tsx");
  assert.match(workspace, /result\.output/);
  assert.match(workspace, /failureMessage\(result\.errorCode\)/);
  assert.match(workspace, /common_retry/);
  assert.doesNotMatch(workspace, /chain.of.thought|raw reasoning/i);
});

test("FI1 locale catalogs have exact parity", async () => {
  const locales = await Promise.all(
    ["en", "fa", "ar", "zh", "hi"].map(async (name) =>
      JSON.parse(await read(`messages/${name}.json`)),
    ),
  );
  const keys = Object.keys(locales[0]).sort();
  for (const locale of locales) assert.deepEqual(Object.keys(locale).sort(), keys);
  assert.ok(keys.filter((key) => key.startsWith("fi1_")).length >= 30);
});
