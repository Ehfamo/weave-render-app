import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BUSINESS_PACKS,
  BusinessPackRegistry,
  defaultHumanReviewPolicy,
} from "../src/lib/business-agents/registry.ts";
import { BUSINESS_SKILL_IDS, businessSkillDefinitions } from "../src/lib/business-agents/skills.ts";
import { createBusinessAgentRuntime } from "../src/lib/business-agents/runtime.ts";
import { BusinessAgentService } from "../src/lib/business-agents/service.ts";
import { selectBusinessAgent } from "../src/lib/business-agents/routing.ts";
import { businessGoalTarget } from "../src/lib/command-center/actions.ts";

test("five reusable packs register all twenty thin agent definitions", () => {
  assert.deepEqual(
    BUSINESS_PACKS.map((x) => x.id),
    ["research", "marketing", "sales", "support", "data"],
  );
  assert.equal(BUSINESS_PACKS.flatMap((x) => x.agents).length, 20);
  assert.equal(new Set(BUSINESS_PACKS.flatMap((x) => x.agents.map((a) => a.id))).size, 20);
  assert.ok(
    BUSINESS_PACKS.flatMap((x) => x.agents).every((x) =>
      x.instructions.some((i) => /Never invent/.test(i)),
    ),
  );
});

test("pack enablement is isolated by project and capability discovery follows it", () => {
  const registry = new BusinessPackRegistry();
  registry.setEnabled("alpha", "sales", false);
  assert.equal(registry.discover("alpha").find((x) => x.id === "sales").enabled, false);
  assert.equal(registry.discover("beta").find((x) => x.id === "sales").enabled, true);
  assert.equal(registry.agent("alpha", "sdr"), undefined);
  assert.equal(registry.agent("beta", "sdr").pack, "sales");
});

test("shared business skills are reusable canonical P2 SkillDefinitions", () => {
  assert.equal(BUSINESS_SKILL_IDS.length, 20);
  assert.equal(businessSkillDefinitions.length, 20);
  assert.ok(
    businessSkillDefinitions.every((x) => x.toolIds.join() === "workspace.search,model.reason"),
  );
});

test("business runtime plans workspace provenance then Model Gateway reasoning", async () => {
  const definition = BUSINESS_PACKS[0].agents[1];
  const runtime = createBusinessAgentRuntime(definition);
  const plan = await runtime.plan({
    task: { id: "t", userId: "u", projectId: "p", goal: "Compare", createdAt: "now" },
    projectSummary: "",
    instructions: [],
    decisions: [],
    constraints: [],
    memories: [],
    maxCharacters: 1000,
    truncated: false,
  });
  assert.deepEqual(
    plan.steps.map((x) => x.toolId),
    ["workspace.search", "model.reason"],
  );
  assert.equal(runtime.definition.id, "business.competitor");
});

test("goal-first routing deterministically selects vertical capabilities", () => {
  assert.equal(selectBusinessAgent("Research my competitors"), "competitor");
  assert.equal(selectBusinessAgent("Write SEO content"), "seo");
  assert.equal(selectBusinessAgent("Find potential leads"), "lead-generation");
  assert.equal(selectBusinessAgent("Answer this support request"), "customer-support");
  assert.equal(selectBusinessAgent("Create a weekly KPI report"), "kpi");
  assert.equal(businessGoalTarget("Build a marketing campaign"), "/business-agents");
});

test("consequential external actions always require human review", () => {
  for (const action of [
    "external_send",
    "external_publish",
    "public_content",
    "customer_response",
    "sales_outreach",
    "campaign_publish",
    "destructive_data",
  ])
    assert.equal(defaultHumanReviewPolicy.requiresReview(action), true);
  assert.equal(defaultHumanReviewPolicy.requiresReview("draft"), false);
});

test("service enforces project authorization and exposes trace provenance without invented cost", async () => {
  const execution = {
    trace: {
      taskId: "t",
      agentId: "business.sdr",
      userId: "u",
      projectId: "p",
      status: "completed",
      steps: [{ id: "s", status: "completed", toolId: "workspace.search" }],
      events: [],
      retries: 0,
      startedAt: "start",
      completedAt: "end",
    },
    result: {
      summary: "draft",
      data: { email: null },
      sources: [{ id: "s1", title: "CRM export", provenance: "workspace" }],
    },
  };
  const orchestrator = {
    registerAgent() {},
    async execute() {
      return execution;
    },
  };
  const service = new BusinessAgentService(orchestrator, new BusinessPackRegistry(), {
    async canUse(projectId, userId) {
      return projectId === "p" && userId === "u";
    },
  });
  await assert.rejects(
    () =>
      service.run({
        id: "r0",
        taskId: "t0",
        userId: "attacker",
        projectId: "p",
        agentId: "sdr",
        goal: "draft",
      }),
    /PROJECT_ACCESS_DENIED/,
  );
  const result = await service.run(
    { id: "r", taskId: "t", userId: "u", projectId: "p", agentId: "sdr", goal: "draft" },
    "sales_outreach",
  );
  assert.equal(result.status, "waiting_approval");
  assert.equal(result.approvalStatus, "waiting_approval");
  assert.equal(result.sources[0].provenance, "workspace");
  assert.equal(result.usage, undefined);
  assert.deepEqual(result.toolUsage, ["workspace.search"]);
});

test("vertical fixtures reject fabricated facts and calculate only fixture metrics", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/p5-vertical-evals.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(fixture.research.unsupportedClaims, []);
  assert.equal(fixture.sales.leads[0].email, null);
  assert.equal(fixture.sales.action, "draft_only");
  assert.equal(fixture.support.escalate, true);
  assert.equal(
    fixture.data.rows.reduce((sum, row) => sum + row.visits, 0),
    fixture.data.expectedTotal,
  );
  assert.deepEqual(fixture.data.chart, { type: "line", x: "week", y: "visits" });
});

test("single business-agent UI is localized responsive and RTL-safe", async () => {
  const ui = await readFile(
    new URL("../src/components/xeomx/business/BusinessAgentsWorkspace.tsx", import.meta.url),
    "utf8",
  );
  for (const token of [
    'dir="auto"',
    "sm:grid-cols",
    "lg:grid-cols",
    "min-h-11",
    "aria-labelledby",
    'role="status"',
  ])
    assert.match(ui, new RegExp(token));
  const locales = await Promise.all(
    ["en", "fa", "ar", "zh", "hi"].map(async (locale) =>
      JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
    ),
  );
  const keys = Object.keys(locales[0])
    .filter((key) => key.startsWith("p5_"))
    .sort();
  assert.equal(keys.length, 12);
  for (const locale of locales)
    assert.deepEqual(
      Object.keys(locale)
        .filter((key) => key.startsWith("p5_"))
        .sort(),
      keys,
    );
});

test("source boundaries forbid direct providers SQL shell and external sends", async () => {
  const files = await Promise.all(
    ["contracts", "registry", "runtime", "service", "skills"].map((name) =>
      readFile(new URL(`../src/lib/business-agents/${name}.ts`, import.meta.url), "utf8"),
    ),
  );
  const source = files.join("\n");
  assert.doesNotMatch(
    source,
    /from ["'](?:openai|groq|@google)|service_role|child_process|exec\(|SELECT\s|sendEmail|publishPost/i,
  );
  assert.match(source, /TaskOrchestrator/);
});
