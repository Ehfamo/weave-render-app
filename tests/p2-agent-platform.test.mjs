import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry } from "../src/lib/agents/registry.ts";
import { InMemoryApprovalStore, defaultApprovalPolicy } from "../src/lib/agents/approval.ts";
import { TaskOrchestrator } from "../src/lib/agents/orchestrator.ts";
import { browserActionRisk, validateBrowserAction } from "../src/lib/agents/browser-safety.ts";
import { selectAgent } from "../src/lib/agents/runtimes.ts";
import { classifyAgentTaskIntent } from "../src/lib/command-center/actions.ts";
import { canonicalSkills } from "../src/lib/agents/tools.ts";

const userId = "00000000-0000-4000-8000-000000000001",
  projectId = "00000000-0000-4000-8000-000000000002";
const task = (goal = "Research competitors") => ({
  id: "task-1",
  userId,
  projectId,
  goal,
  createdAt: "2026-09-12T00:00:00.000Z",
});
const brain = {
  snapshot: async () => ({
    summary: { text: "XEOMX", method: "deterministic" },
    instructions: [{ text: "No deploy" }],
    decisions: [],
    constraints: [{ text: "bounded" }],
    memories: [],
    project: { id: projectId, name: "x", description: null, updatedAt: "2026-09-12T00:00:00Z" },
    entries: [],
    updatedAt: "2026-09-12T00:00:00Z",
    goal: null,
    entities: [],
    openItems: [],
    recentActivity: [],
    memoryEnabled: false,
    candidateLimit: 100,
  }),
};
const gateway = {
  execute: async () => ({
    ok: true,
    requestId: "m",
    latencyMs: 1,
    model: { providerId: "mock", modelId: "mock" },
    output: { kind: "text", text: "Synthesis" },
  }),
};
function setup(
  tool = {
    id: "workspace.search",
    description: "search",
    capability: "workspace.search",
    risk: "SAFE_READ",
    enabled: true,
    validate: () => true,
    execute: async () => ({ results: [{ id: "1", title: "source" }] }),
  },
) {
  const registry = new AgentRegistry();
  registry.registerTool(tool);
  registry.registerTool({
    id: "model.reason",
    description: "model",
    capability: "model.reason",
    risk: "SAFE_READ",
    enabled: true,
    validate: () => true,
    execute: async () => "Synthesis",
  });
  return { registry, approvals: new InMemoryApprovalStore() };
}

test("registry rejects duplicates, disabled tools and invalid input", async () => {
  const r = new AgentRegistry(),
    tool = {
      id: "safe.read",
      description: "x",
      capability: "code.read",
      risk: "SAFE_READ",
      enabled: false,
      validate: () => false,
      execute: async () => null,
    };
  r.registerTool(tool);
  assert.throws(() => r.registerTool(tool), /DUPLICATE/);
  assert.equal(
    (
      await r.invoke(
        { id: "safe.read", taskId: "t", stepId: "s", input: null },
        { policy: defaultApprovalPolicy, approved: false },
      )
    ).error.code,
    "TOOL_DISABLED",
  );
});

test("canonical skills declare research coding and bounded browser capabilities", () => {
  const skills = canonicalSkills();
  assert.deepEqual(
    skills.map((x) => x.id),
    ["research.workspace", "coding.controlled", "browser.bounded"],
  );
  assert.equal(
    skills.find((x) => x.id === "coding.controlled").toolIds.includes("code.validate"),
    true,
  );
});
test("deterministic agent and Command Center task intent routing", () => {
  assert.equal(selectAgent("analyze this code").definition.id, "coding");
  assert.equal(selectAgent("check this website").definition.id, "browser");
  assert.equal(selectAgent("research competitors").definition.id, "research");
  assert.equal(classifyAgentTaskIntent("Research competitors for this project").intent, "research");
});
test("safe research completes with workspace provenance and bounded trace", async () => {
  const deps = setup(),
    o = new TaskOrchestrator({
      ...deps,
      brain,
      gateway,
      id: (() => {
        let n = 0;
        return () => `id-${++n}`;
      })(),
      now: () => "2026-09-12T00:00:00Z",
    });
  const r = await o.execute(task());
  assert.equal(r.trace.status, "completed");
  assert.equal(r.trace.steps.length, 2);
  assert.equal(r.result.sources[0].provenance, "workspace");
  assert.equal(
    r.trace.events.some((e) => e.type === "tool"),
    true,
  );
});
test("hard step limit fails safely without executing tools", async () => {
  const deps = setup(),
    o = new TaskOrchestrator({ ...deps, brain, gateway }, { maxSteps: 1 });
  const r = await o.execute(task());
  assert.equal(r.trace.status, "failed");
  assert.equal(r.error.code, "STEP_LIMIT_EXCEEDED");
  assert.equal(r.trace.steps.length, 0);
});
test("risky tool waits and records approval before execution", async () => {
  let calls = 0;
  const deps = setup({
    id: "workspace.search",
    description: "write",
    capability: "workspace.search",
    risk: "EXTERNAL_ACTION",
    enabled: true,
    validate: () => true,
    execute: async () => {
      calls++;
      return { results: [] };
    },
  });
  const r = await new TaskOrchestrator({ ...deps, brain, gateway }).execute(task());
  assert.equal(r.trace.status, "waiting_approval");
  assert.equal(calls, 0);
  assert.equal(
    r.trace.events.some((e) => e.type === "approval"),
    true,
  );
});
test("rejected approval is terminal and cannot become execution authority", async () => {
  const store = new InMemoryApprovalStore();
  await store.create({
    id: "a",
    taskId: "t",
    stepId: "s",
    toolId: "x",
    risk: "DESTRUCTIVE",
    requestedBy: userId,
    projectId,
    status: "pending",
    createdAt: "x",
  });
  const r = await store.decide({ requestId: "a", decision: "rejected", decidedBy: userId });
  assert.equal(r.status, "rejected");
  await assert.rejects(
    () => store.decide({ requestId: "a", decision: "approved", decidedBy: userId }),
    /NOT_PENDING/,
  );
});
test("browser boundary is origin-aware and consequential actions are risky", () => {
  assert.equal(
    validateBrowserAction({ action: "inspect", url: "https://xeomx.com/x" }, ["https://xeomx.com"]),
    true,
  );
  assert.equal(
    validateBrowserAction({ action: "navigate", url: "https://evil.test" }, ["https://xeomx.com"]),
    false,
  );
  assert.equal(browserActionRisk("submit"), "EXTERNAL_ACTION");
  assert.equal(browserActionRisk("inspect"), "SAFE_READ");
});
test("cancellation is preserved", async () => {
  const deps = setup(),
    c = new AbortController();
  c.abort();
  const r = await new TaskOrchestrator({ ...deps, brain, gateway }).execute(task(), {
    signal: c.signal,
  });
  assert.equal(r.trace.status, "cancelled");
});
