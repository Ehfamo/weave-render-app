import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixture, publisher as owner, buyer, stranger } from "./helpers/fi6-fixture.mjs";
import { effectivePolicy } from "../src/lib/governance/policy.ts";
import { runtimeGovernance, estimateMicrounits } from "../src/lib/governance/runtime.ts";
import { GatewayRuntime } from "../src/lib/model-gateway/runtime.ts";
import { ProviderRegistry } from "../src/lib/model-gateway/registry.ts";
import { TaskOrchestrator } from "../src/lib/agents/orchestrator.ts";
import { InMemoryApprovalStore } from "../src/lib/agents/approval.ts";
import { AgentRegistry } from "../src/lib/agents/registry.ts";
const request = {
  requestId: "opaque",
  task: "draft",
  mode: "FAST",
  capability: "text",
  input: "private goal",
  maxOutputTokens: 10,
};
const model = (id) => ({
  identity: { providerId: id, modelId: "one" },
  capabilities: ["text"],
  quality: 0.5,
  estimatedLatencyMs: 10,
  estimatedCostPer1kTokensUsd: 0.01,
});
const success = {
  ok: true,
  output: { kind: "text", text: "actual result" },
  usage: { inputTokens: 2, outputTokens: 3 },
};
function controlled(policy = {}, meter = { command: async () => ({}) }) {
  const state = { policy };
  const controls = runtimeGovernance({
    policy: { policy: async () => effectivePolicy(state.policy) },
    meter,
    userId: owner,
    projectId: "project",
    runId: "run",
    providerHosts: { a: "a.test", b: "b.test" },
  });
  return { state, ...controls };
}
function gateway(g, dispatch, ids = ["a", "b"]) {
  const registry = new ProviderRegistry();
  for (const id of ids)
    registry.register({
      provider: { id, displayName: id },
      getHealth: async () => ({ availability: "AVAILABLE", checkedAt: new Date().toISOString() }),
      discoverModels: async () => [model(id)],
      execute: () => dispatch(id),
    });
  return new GatewayRuntime(registry, { governance: g });
}
test("FI6 all routing modes filter policy BEFORE ranking; no restricted provider dispatch", async () => {
  const c = controlled({ deny: { providers: ["a"] } }),
    calls = [];
  for (const mode of ["FAST", "BALANCED", "BEST"]) {
    const r = await gateway(c.gateway, async (id) => {
      calls.push(id);
      return success;
    }).execute({ ...request, mode });
    assert.equal(r.ok, true);
    assert.equal(r.model.providerId, "b");
  }
  assert.deepEqual(calls, ["b", "b", "b"]);
});
test("FI6 fallback rechecks policy, destination and model allowlists", async () => {
  const c = controlled({
      allow: { providers: ["a", "b"], models: ["a/one", "b/one"], network: ["a.test", "b.test"] },
    }),
    calls = [];
  const r = await gateway(c.gateway, async (id) => {
    calls.push(id);
    c.state.policy = { deny: { providers: ["b"] } };
    return { ok: false, error: { code: "RATE_LIMIT" } };
  }).execute(request);
  assert.equal(r.error.code, "GOVERNANCE_BLOCKED");
  assert.deepEqual(calls, ["a"]);
  for (const policy of [{ allow: { models: [] } }, { allow: { network: [] } }]) {
    c.state.policy = policy;
    assert.equal(
      (await gateway(c.gateway, () => assert.fail("denied")).execute(request)).ok,
      false,
    );
  }
});
test("FI6 UNKNOWN price stays null and actual token usage never fabricates money", async () => {
  assert.equal(
    estimateMicrounits({ ...model("a"), estimatedCostPer1kTokensUsd: undefined }, request),
    null,
  );
  assert.equal(estimateMicrounits(model("a"), { ...request, capability: "image" }), null);
  const records = [],
    c = controlled({}, { command: async (action, data) => records.push({ action, data }) });
  await gateway(c.gateway, async () => success, ["a"]).execute(request);
  assert.equal(records[0].action, "reserve");
  assert.equal(records[1].data.inputUnits, 2);
  assert.ok(!JSON.stringify(records).includes("private goal"));
  assert.equal(records[1].data.actualMicrounits, undefined);
});
test("FI6 agent/tool/MCP/network denial and project scope are server governed", async () => {
  const task = {
    id: "run",
    userId: owner,
    projectId: "project",
    goal: "work",
    createdAt: new Date().toISOString(),
  };
  for (const [policy, tool, input] of [
    [{ deny: { agents: ["research"] } }, "model.reason", {}],
    [{ deny: { tools: ["model.reason"] } }, "model.reason", {}],
    [{ deny: { mcp: ["*"] } }, "mcp.external", {}],
    [{ allow: { network: ["safe.test"] } }, "browser.action", { url: "https://other.test" }],
    [{ deny: { actions: ["external.send"] } }, "external.send", {}],
  ])
    await assert.rejects(
      controlled(policy).agent.authorize(
        task,
        "research",
        { input },
        { id: tool, risk: "EXTERNAL_ACTION" },
      ),
      /GOVERNANCE_BLOCKED/,
    );
  await assert.rejects(
    controlled().agent.authorize({ ...task, userId: stranger }, "research"),
    /GOVERNANCE_BLOCKED/,
  );
  const c = controlled({ requireApproval: true });
  const registry = new AgentRegistry();
  let calls = 0;
  registry.registerTool({
    id: "workspace.search",
    description: "test",
    capability: "workspace.search",
    enabled: true,
    risk: "SAFE_READ",
    validate: () => true,
    execute: async () => {
      calls++;
      return {};
    },
  });
  const runner = new TaskOrchestrator({
    registry,
    approvals: new InMemoryApprovalStore(),
    governance: c.agent,
    brain: {
      buildContext: async () => ({
        text: JSON.stringify({ sections: [] }),
        maxCharacters: 1000,
        truncated: false,
      }),
    },
    gateway: { execute: () => assert.fail("approval first") },
  });
  const r = await runner.execute(task);
  assert.equal(r.trace.status, "waiting_approval");
  assert.equal(calls, 0);
  c.state.policy = { deny: { agents: ["research"] } };
  assert.equal((await runner.execute(task)).error.code, "GOVERNANCE_BLOCKED");
});
test("FI6 atomic PostgreSQL budgets, idempotency, isolation and truthful usage", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  await f.db.exec("RESET ROLE");
  await f.db.exec(
    await readFile(
      new URL("../supabase/migrations/20261001064853_fi6_runtime_governance.sql", import.meta.url),
      "utf8",
    ),
  );
  const g = f.governance(owner),
    p = f.projects[owner],
    run = crypto.randomUUID();
  const w = await g.command("create", { name: "Budget workspace" });
  await g.command("attach", { workspaceId: w.id, projectId: p });
  const base = {
    projectId: p,
    runId: run,
    requestKey: "one",
    provider: "a",
    model: "one",
    destination: "a.test",
    estimatedMicrounits: 80000,
  };
  const meter = async (action, data, who = owner) => {
    await f.actor(who, true);
    return f.scalar("SELECT xeomx_governance_meter($1,$2,$3)", [who, action, data]);
  };
  await t.test(
    "parent budget cannot be weakened, warnings and project/run/daily/monthly ceilings",
    async () => {
      await g.command("policy", {
        workspaceId: w.id,
        policy: { limits: { dailyMinor: 10, monthlyMinor: 10, warningPercent: 80 } },
      });
      await g.command("policy", {
        projectId: p,
        policy: { limits: { dailyMinor: 999, runMinor: 10 } },
      });
      const r = await meter("reserve", base);
      assert.equal(r.warning, true);
      assert.equal(r.actualUsage, "NOT_VERIFIED");
      await assert.rejects(
        meter("reserve", { ...base, requestKey: "two", estimatedMicrounits: 30000 }),
        /BUDGET_STOPPED/,
      );
      await meter("record", {
        ...base,
        outcome: "SUCCESS",
        latencyMs: 10,
        inputUnits: 2,
        outputUnits: 3,
      });
      assert.equal(
        await f.scalar(
          "SELECT actual_cost_microunits FROM usage_events WHERE governance_request_key='one'",
        ),
        null,
      );
      await assert.rejects(meter("reserve", base), /REQUEST_ALREADY_RECORDED/);
    },
  );
  await t.test("unknown cost and unreconciled historical cost never become zero", async () => {
    await assert.rejects(
      meter("reserve", { ...base, requestKey: "unknown", estimatedMicrounits: null }),
      /COST_UNKNOWN/,
    );
    await g.command("policy", { workspaceId: w.id, policy: {} });
    await g.command("policy", { projectId: p, policy: {} });
    const r = await meter("reserve", { ...base, requestKey: "unknown", estimatedMicrounits: null });
    assert.equal(r.costStatus, "UNKNOWN");
    await g.command("policy", { projectId: p, policy: { limits: { monthlyMinor: 999999 } } });
    await assert.rejects(meter("reserve", { ...base, requestKey: "three" }), /COST_UNKNOWN/);
  });
  await t.test(
    "concurrency reservations survive service recreation and reject duplicate claims",
    async () => {
      await g.command("policy", { projectId: p, policy: { limits: { concurrency: 1 } } });
      await assert.rejects(
        meter("reserve", { ...base, requestKey: "concurrent" }),
        /CONCURRENCY_LIMIT/,
      );
      await meter("record", { ...base, requestKey: "unknown", outcome: "TIMEOUT", latencyMs: 10 });
      await assert.rejects(meter("reserve", { ...base, requestKey: "later" }), /CONCURRENCY_LIMIT/);
    },
  );
  await t.test("browser cannot forge server reservation; cross-project/user denied", async () => {
    await f.actor(owner);
    await assert.rejects(
      f.scalar("SELECT xeomx_governance_meter($1,'reserve',$2)", [owner, base]),
      /permission denied/,
    );
    await assert.rejects(
      meter("reserve", { ...base, requestKey: "stolen" }, stranger),
      /PROJECT_ACCESS_DENIED/,
    );
    await assert.rejects(
      meter("record", { ...base, outcome: "SUCCESS" }, buyer),
      /METER_SCOPE_MISMATCH/,
    );
  });
  await t.test(
    "FI3 durable job claim obeys concurrency and fresh workspace membership",
    async () => {
      await g.command("policy", { projectId: p, policy: { limits: { concurrency: 1 } } });
      const command = async (who, action, id, data = {}) => {
        await f.actor(who, true);
        return f.scalar("SELECT xeomx_runtime_command($1,$2,$3,$4)", [who, action, id, data]);
      };
      const make = async () => {
        const id = crypto.randomUUID(),
          request = {
            task: {
              id,
              userId: owner,
              projectId: p,
              requestedAgent: "research",
              goal: "Actual work",
              createdAt: new Date().toISOString(),
            },
            capability: { kind: "business", agentId: "research" },
            idempotencyKey: id,
          };
        return command(owner, "submit", id, { request, hash: "a".repeat(64) });
      };
      const one = await make(),
        two = await make();
      assert.equal(
        (await command(owner, "claim", one.id, { lease: crypto.randomUUID() })).state,
        "running",
      );
      await assert.rejects(
        command(owner, "claim", two.id, { lease: crypto.randomUUID() }),
        /CONCURRENCY_LIMIT/,
      );
      await command(owner, "cancel", one.id);
      assert.equal(
        (await command(owner, "claim", two.id, { lease: crypto.randomUUID() })).state,
        "running",
      );
      await g.command("policy", { workspaceId: w.id, policy: { deny: { agents: ["research"] } } });
      await assert.rejects(
        command(owner, "checkpoint", two.id, { checkpoint: {} }),
        /GOVERNANCE_BLOCKED/,
      );
      await assert.rejects(command(stranger, "get", two.id), /PROJECT_ACCESS_DENIED/);
      await g.command("policy", { workspaceId: w.id, policy: {} });
      await f.db.exec("RESET ROLE");
      await f.db.query(
        "UPDATE workspace_members SET active=false WHERE workspace_id=$1 AND user_id=$2",
        [w.id, owner],
      );
      await assert.rejects(command(owner, "get", two.id), /PROJECT_ACCESS_DENIED/);
      await f.db.exec("RESET ROLE");
      await f.db.query(
        "UPDATE workspace_members SET active=true WHERE workspace_id=$1 AND user_id=$2",
        [w.id, owner],
      );
    },
  );
  await t.test("provider restriction is enforced inside privileged database boundary", async () => {
    await g.command("policy", { projectId: p, policy: { deny: { providers: ["a"] } } });
    await assert.rejects(meter("reserve", { ...base, requestKey: "denied" }), /GOVERNANCE_BLOCKED/);
  });
});
