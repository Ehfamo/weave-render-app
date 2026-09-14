import assert from "node:assert/strict";
import test from "node:test";
import {
  createExecutionIntent,
  inferQuality,
  interpretIntent,
} from "../src/lib/intelligence/brief.ts";
import { classifyMemoryWrite, nextActions } from "../src/lib/intelligence/personalization.ts";
import { generateEvaluateRepair, verticalEvaluatorIds } from "../src/lib/intelligence/quality.ts";
import { planCapabilities, selectCompatibleFallback } from "../src/lib/intelligence/planner.ts";
import {
  buildRiskSignals,
  creatorInsights,
  detectDuplicateSignals,
  evaluateCompatibility,
  listingSuggestions,
  matchGoalToCapabilities,
  rankMarketplaceCandidates,
  recommendBundle,
  summarizeVerifiedReviews,
} from "../src/lib/intelligence/marketplace.ts";
import { createExecutionTrace, toIntelligenceMetrics } from "../src/lib/intelligence/trace.ts";
import { readFile } from "node:fs/promises";

const baseIntent = (goal, extra = {}) => ({
  id: "brief-1",
  userId: "u1",
  projectId: "p1",
  goal,
  ...extra,
});
const manifest = (extra = {}) => ({
  packageId: "pkg-1",
  objectType: "skill",
  version: "1.0.0",
  creatorId: "creator",
  title: "SEO research",
  summary: "Research and rank competitors",
  description: "SEO research workflow",
  compatibility: { runtime: "xeomx", minimumVersion: "1.0.0", objectAdapter: "skill" },
  dependencies: [],
  permissions: [],
  requiredSkills: [],
  requiredTools: [],
  license: {
    identifier: "MIT",
    commercialUse: true,
    redistribution: true,
    attributionRequired: false,
    creatorDeclared: true,
  },
  provenance: { kind: "creator-owned", sourceReferences: [], creatorDeclaration: "mine" },
  previews: [{ kind: "sample", references: [], publicData: {} }],
  changelog: "initial",
  payload: {},
  integrity: { algorithm: "xeomx-canonical-v1", digest: "aaa" },
  createdAt: "2026-09-14T00:00:00Z",
  ...extra,
});
const listing = (extra = {}) => ({
  id: "l1",
  packageId: "pkg-1",
  version: "1.0.0",
  creatorId: "creator",
  state: "published",
  category: "marketing",
  tags: ["seo", "research"],
  price: { kind: "FREE", amount: 0, currency: "CREDITS" },
  ratingCount: 0,
  ratingTotal: 0,
  ...extra,
});
const marketContext = {
  runtimeVersion: "1.2.0",
  installedPackages: {},
  allowedPermissions: new Set(),
  locale: "fa",
  capabilities: ["marketing"],
};
const providers = [
  {
    model: { providerId: "p", modelId: "balanced" },
    capabilities: ["text", "structured"],
    enabled: true,
    health: "healthy",
    latencyMs: 100,
    successRate: 0.99,
    quality: 0.9,
    cost: {
      model: { providerId: "p", modelId: "balanced" },
      inputPerMillionMinor: 100,
      outputPerMillionMinor: 100,
      currency: "USD",
      effectiveAt: "2026-09-14",
    },
  },
  {
    model: { providerId: "backup", modelId: "safe" },
    capabilities: ["text", "structured"],
    enabled: true,
    health: "healthy",
    latencyMs: 150,
    successRate: 0.95,
    quality: 0.85,
    cost: {
      model: { providerId: "backup", modelId: "safe" },
      inputPerMillionMinor: 100,
      outputPerMillionMinor: 100,
      currency: "USD",
      effectiveAt: "2026-09-14",
    },
  },
];
const inventory = {
  agents: [
    {
      id: "research",
      name: "Research",
      enabled: true,
      capabilities: ["workspace.search", "model.reason"],
    },
    {
      id: "coding",
      name: "Coding",
      enabled: true,
      capabilities: ["code.read", "code.propose", "code.validate"],
    },
  ],
  tools: [
    {
      id: "workspace.search",
      description: "search",
      capability: "workspace.search",
      risk: "SAFE_READ",
      enabled: true,
      validate: () => true,
      execute: async () => ({}),
    },
    {
      id: "model.reason",
      description: "reason",
      capability: "model.reason",
      risk: "SAFE_READ",
      enabled: true,
      validate: () => true,
      execute: async () => ({}),
    },
    {
      id: "external.send",
      description: "send",
      capability: "model.reason",
      risk: "EXTERNAL_ACTION",
      enabled: true,
      validate: () => true,
      execute: async () => ({}),
    },
  ],
  skills: [],
  providers,
  budget: { maxRunMinor: 100, allowUnknown: false },
  usage: { inputTokens: 100, outputTokens: 100 },
  allowedToolIds: new Set(["workspace.search", "model.reason", "external.send"]),
};

test("golden intents select bounded capability categories", () => {
  const cases = [
    ["simple question", "GENERAL"],
    ["Research competitors", "RESEARCH"],
    ["Make an ad", "CREATIVE"],
    ["inspect repository code", "CODE"],
    ["When a lead replies create a task", "AUTOMATION"],
    ["make a sales campaign", "BUSINESS"],
    ["Find an SEO capability", "MARKETPLACE"],
  ];
  for (const [goal, expected] of cases) assert.equal(interpretIntent(goal).kind, expected);
  assert.deepEqual(interpretIntent("patch this code").capabilities, [
    "code.inspect",
    "code.patch",
    "code.validate",
  ]);
});
test("quality mode inference honors explicit override", () => {
  assert.equal(inferQuality("quick draft"), "FAST");
  assert.equal(inferQuality("final production-ready result"), "BEST");
  assert.equal(inferQuality("normal work"), "BALANCED");
  assert.equal(inferQuality("quick", "BEST"), "BEST");
});
test("brief reuses only relevant same-user same-project context", () => {
  const result = createExecutionIntent(
    baseIntent("Make the next episode with the same character", {
      locale: "fa",
      selectedReferences: [{ id: "r1", kind: "result" }],
      context: [
        {
          id: "character-1",
          ownerId: "u1",
          projectId: "p1",
          kind: "character",
          value: "N",
          relevant: true,
        },
        {
          id: "cross-user",
          ownerId: "u2",
          projectId: "p1",
          kind: "brand",
          value: "x",
          relevant: true,
        },
        {
          id: "cross-project",
          ownerId: "u1",
          projectId: "p2",
          kind: "voice",
          value: "x",
          relevant: true,
        },
        {
          id: "irrelevant",
          ownerId: "u1",
          projectId: "p1",
          kind: "brand",
          value: "x",
          relevant: false,
        },
      ],
    }),
  );
  assert.equal(result.clarification.blocks, false);
  assert.deepEqual(
    result.brief.contextSources.map((x) => x.id),
    ["character-1"],
  );
  assert.equal(result.brief.referenceResultId, "r1");
  assert.equal(result.brief.locale, "fa");
});
test("ambiguous continuation asks exactly one blocking question", () => {
  const value = createExecutionIntent(baseIntent("continue"));
  assert.equal(value.clarification.blocks, true);
  assert.equal(typeof value.clarification.question, "string");
  assert.equal(value.brief.missing.filter((x) => x.state === "CRITICAL_UNKNOWN").length, 1);
});
test("safe defaults avoid preference questionnaires", () => {
  const value = createExecutionIntent(baseIntent("summarize this"));
  assert.equal(value.clarification.blocks, false);
  assert.deepEqual(value.clarification.defaultsApplied, ["locale:en", "channel:auto"]);
});
test("planner selects existing agents tools model router and approval boundary", () => {
  const intent = createExecutionIntent(baseIntent("Research competitors"));
  const plan = planCapabilities(intent.brief, intent.interpretation.capabilities, inventory);
  assert.ok(plan.steps.length <= 8);
  assert.equal(plan.maxDepth, 2);
  assert.equal(plan.steps[0].agent.id, "research");
  assert.equal(plan.steps[0].modelRoute.status, "SELECTED");
  assert.equal(plan.steps[1].approval?.required, true);
});
test("planner rejects blocked brief and unauthorized tools", () => {
  const blocked = createExecutionIntent(baseIntent("continue"));
  assert.throws(
    () => planCapabilities(blocked.brief, blocked.interpretation.capabilities, inventory),
    /BLOCKED/,
  );
  const clean = createExecutionIntent(baseIntent("Research competitors"));
  const plan = planCapabilities(clean.brief, clean.interpretation.capabilities, {
    ...inventory,
    allowedToolIds: new Set(["workspace.search"]),
  });
  assert.equal(
    plan.steps.flatMap((x) => x.tools).some((x) => x.id === "external.send"),
    false,
  );
});
test("fallback stays inside pre-authorized compatible route set", () => {
  const value = createExecutionIntent(baseIntent("Research competitors"));
  const step = planCapabilities(value.brief, value.interpretation.capabilities, inventory).steps[0];
  const fallback = selectCompatibleFallback(step, providers, inventory.budget);
  assert.equal(fallback.status, "selected");
  assert.notEqual(fallback.model?.providerId, step.modelRoute.model?.providerId);
});
test("budget guard blocks model route", () => {
  const value = createExecutionIntent(baseIntent("Research competitors"));
  const plan = planCapabilities(value.brief, value.interpretation.capabilities, {
    ...inventory,
    budget: { maxRunMinor: 0, allowUnknown: false },
    usage: { inputTokens: 1000000, outputTokens: 1000000 },
  });
  assert.equal(plan.steps[0].modelRoute.status, "BUDGET_EXCEEDED");
});
test("quality loop accepts good result", async () => {
  const result = await generateEvaluateRepair({
    vertical: "GENERAL",
    generate: async () => ({ ok: true }),
    evaluators: [
      {
        id: "e",
        verticals: ["GENERAL"],
        evaluate: async () => ({ evaluatorId: "e", status: "PASS", code: "OK", repairable: false }),
      },
    ],
    repair: async (x) => x,
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 2,
      repairCostMinor: 1,
      timeoutMs: 1000,
      qualityThresholdRequired: true,
    },
  });
  assert.equal(result.decision, "ACCEPT");
  assert.equal(result.repairCount, 0);
});
test("quality loop repairs then accepts and enforces max two", async () => {
  let checks = 0;
  const result = await generateEvaluateRepair({
    vertical: "CODE",
    generate: async () => ({ fixed: false }),
    evaluators: [
      {
        id: "tests",
        verticals: ["CODE"],
        evaluate: async () => ({
          evaluatorId: "tests",
          status: ++checks > 1 ? "PASS" : "FAIL",
          code: "TEST",
          repairable: true,
        }),
      },
    ],
    repair: async () => ({ fixed: true }),
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 2,
      repairCostMinor: 1,
      timeoutMs: 1000,
      qualityThresholdRequired: true,
    },
  });
  assert.equal(result.decision, "ACCEPT");
  assert.equal(result.repairCount, 1);
});
test("failed repair stops and budget blocks repair", async () => {
  const args = {
    vertical: "GENERAL",
    generate: async () => "bad",
    evaluators: [
      {
        id: "e",
        verticals: ["GENERAL"],
        evaluate: async () => ({ evaluatorId: "e", status: "FAIL", code: "BAD", repairable: true }),
      },
    ],
    repair: async (x) => x,
  };
  const stopped = await generateEvaluateRepair({
    ...args,
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 2,
      repairCostMinor: 1,
      timeoutMs: 1000,
      qualityThresholdRequired: true,
    },
  });
  assert.equal(stopped.decision, "FAIL_SAFELY");
  assert.equal(stopped.repairCount, 2);
  const budget = await generateEvaluateRepair({
    ...args,
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 0,
      repairCostMinor: 1,
      timeoutMs: 1000,
      qualityThresholdRequired: true,
    },
  });
  assert.equal(budget.repairCount, 0);
});
test("missing evaluator remains not evaluated", async () => {
  const result = await generateEvaluateRepair({
    vertical: "CREATIVE",
    generate: async () => "image",
    evaluators: [],
    repair: async (x) => x,
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 2,
      repairCostMinor: 1,
      timeoutMs: 1000,
      qualityThresholdRequired: true,
    },
  });
  assert.equal(result.findings[0].status, "NOT_EVALUATED");
  assert.equal(result.decision, "DELIVER_WITH_WARNING");
});
test("cancellation stops loop", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await generateEvaluateRepair({
    vertical: "GENERAL",
    generate: async () => "x",
    evaluators: [],
    repair: async (x) => x,
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 2,
      repairCostMinor: 1,
      timeoutMs: 1000,
      qualityThresholdRequired: true,
    },
    signal: controller.signal,
  });
  assert.equal(result.decision, "FAIL_SAFELY");
});
test("vertical policies never claim unavailable visual semantics", () => {
  assert.deepEqual(verticalEvaluatorIds("CREATIVE"), [
    "reference-metadata",
    "brand",
    "format",
    "asset-references",
  ]);
  assert.ok(verticalEvaluatorIds("RESEARCH").includes("provenance"));
});
test("memory write policy stores only accepted stable nonsensitive facts", () => {
  assert.equal(
    classifyMemoryWrite({ kind: "brand", accepted: true, stable: true, sensitive: false }),
    "IMPORTANT_STABLE",
  );
  assert.equal(
    classifyMemoryWrite({ kind: "wording", accepted: false, stable: false, sensitive: false }),
    "EPHEMERAL",
  );
  assert.equal(
    classifyMemoryWrite({ kind: "secret", accepted: true, stable: true, sensitive: true }),
    "DO_NOT_STORE",
  );
});
test("next actions are small and never execute anything", () => {
  const value = createExecutionIntent(baseIntent("Make an ad"));
  assert.ok(nextActions(value.brief, true).length <= 3);
  assert.deepEqual(nextActions(value.brief, false), []);
});
test("marketplace goal matching is problem-oriented", () => {
  assert.ok(matchGoalToCapabilities("Grow my Instagram").includes("marketing"));
  assert.ok(matchGoalToCapabilities("Persian voice for ads").includes("creative.generate"));
});
test("compatibility is factual and unknown stays unknown", () => {
  assert.equal(evaluateCompatibility(manifest(), marketContext).state, "COMPATIBLE");
  assert.equal(
    evaluateCompatibility(
      manifest({
        compatibility: { runtime: "xeomx", minimumVersion: "invalid", objectAdapter: "skill" },
      }),
      marketContext,
    ).state,
    "UNKNOWN",
  );
  assert.equal(
    evaluateCompatibility(
      manifest({
        compatibility: { runtime: "xeomx", minimumVersion: "9.0.0", objectAdapter: "skill" },
      }),
      marketContext,
    ).state,
    "INCOMPATIBLE",
  );
  assert.equal(
    evaluateCompatibility(
      manifest({ permissions: [{ id: "send", reason: "send", risk: "external" }] }),
      marketContext,
    ).state,
    "COMPATIBLE_WITH_REQUIREMENTS",
  );
});
test("ranking excludes incompatible and keeps missing metrics neutral", () => {
  const ranked = rankMarketplaceCandidates({
    goal: "SEO research",
    context: marketContext,
    candidates: [
      { listing: listing(), manifest: manifest(), signals: { validated: true } },
      {
        listing: listing({ id: "bad", packageId: "bad" }),
        manifest: manifest({
          packageId: "bad",
          compatibility: { runtime: "xeomx", minimumVersion: "9.0.0", objectAdapter: "skill" },
        }),
      },
    ],
  });
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].unknownSignals.includes("successfulExecutions"));
  assert.equal(ranked[0].placement, "ORGANIC");
  assert.match(ranked[0].explanation, /Matches/);
});
test("sponsored placement is explicit and does not change utility", () => {
  const a = rankMarketplaceCandidates({
    goal: "SEO",
    context: marketContext,
    candidates: [{ listing: listing(), manifest: manifest(), sponsored: true }],
  })[0];
  const b = rankMarketplaceCandidates({
    goal: "SEO",
    context: marketContext,
    candidates: [{ listing: listing(), manifest: manifest() }],
  })[0];
  assert.equal(a.placement, "SPONSORED");
  assert.equal(a.utility, b.utility);
});
test("review summaries require real verified noncreator reviews", () => {
  const reviews = [1, 2, 3].map((n) => ({
    id: `r${n}`,
    listingId: "l1",
    authorId: `u${n}`,
    creatorId: "creator",
    rating: 5,
    text: "works well",
    status: "active",
    updatedAt: "now",
    verifiedAcquisition: true,
  }));
  assert.equal(summarizeVerifiedReviews(reviews).status, "AVAILABLE");
  assert.equal(summarizeVerifiedReviews(reviews.slice(0, 2)).status, "INSUFFICIENT");
  assert.equal(
    summarizeVerifiedReviews([{ ...reviews[0], authorId: "creator" }]).reviewIds.length,
    0,
  );
});
test("duplicate/slop detection flags for review without punishment", () => {
  const result = detectDuplicateSignals(manifest({ packageId: "new" }), [manifest()]);
  assert.equal(result.action, "REQUEST_MODERATION_REVIEW");
  assert.equal(result.autonomousPenalty, false);
});
test("fraud signals never accuse or ban automatically", () => {
  const result = buildRiskSignals({ selfPurchases: 1, permissionRiskChanged: true });
  assert.equal(result.signals.length, 2);
  assert.equal(result.accusation, false);
  assert.equal(result.automaticBan, false);
});
test("creator intelligence reports data gaps instead of invented insights", () => {
  const empty = creatorInsights({});
  assert.equal(empty.insights.length, 0);
  assert.ok(empty.dataGaps.includes("acquisition_funnel"));
  const factual = creatorInsights({ views: 100, acquisitions: 1, installs: 20, repeatUses: 1 });
  assert.ok(factual.insights.length >= 2);
});
test("listing assistant suggests but never publishes", () => {
  const result = listingSuggestions({
    manifest: manifest({
      previews: [],
      dependencies: [{ packageId: "x", version: "1", optional: false }],
    }),
    validationCodes: ["BAD_SCHEMA"],
    reviewSummary: summarizeVerifiedReviews([]),
  });
  assert.equal(result.autoPublish, false);
  assert.ok(result.suggestions.length >= 2);
});
test("bundles disclose prices and require acquisition approval", () => {
  const ranked = rankMarketplaceCandidates({
    goal: "SEO",
    context: marketContext,
    candidates: [
      {
        listing: listing({ price: { kind: "ONE_TIME_CREDITS", amount: 5, currency: "CREDITS" } }),
        manifest: manifest(),
      },
    ],
  });
  const bundle = recommendBundle(ranked);
  assert.equal(bundle.totalKnownAmount, 5);
  assert.equal(bundle.requiresAcquisitionApproval, true);
  assert.equal(bundle.optional, true);
});

test("trace records bounded rationale IDs without goal or private context content", () => {
  const intent = createExecutionIntent(
    baseIntent("Research secret competitors", {
      context: [
        {
          id: "brand-1",
          ownerId: "u1",
          projectId: "p1",
          kind: "brand",
          value: "private content",
          relevant: true,
        },
      ],
    }),
  );
  const plan = planCapabilities(intent.brief, intent.interpretation.capabilities, inventory);
  const quality = {
    decision: "ACCEPT",
    findings: [{ evaluatorId: "source", status: "PASS", code: "CITED", repairable: false }],
    repairCount: 0,
    confidence: "VERIFIED",
    output: {},
  };
  const trace = createExecutionTrace({
    brief: intent.brief,
    intentKind: intent.interpretation.kind,
    plan,
    quality,
    finalState: "delivered",
  });
  assert.deepEqual(trace.contextReferenceIds, ["brand-1"]);
  assert.doesNotMatch(JSON.stringify(trace), /private content|secret competitors/);
  const metrics = toIntelligenceMetrics(intent.interpretation.kind, false, plan, quality);
  assert.equal(metrics.repairCount, 0);
  assert.ok(metrics.selectedAgentIds.includes("research"));
});

test("P9 advanced routing UX stays behind disclosure with five-locale parity", async () => {
  const home = await readFile(
    new URL("../src/components/xeomx/os/HomeExperience.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(home.indexOf("<details") < home.indexOf("p9_routing_details"));
  assert.doesNotMatch(home, /providerId|modelId|requestedAgent/);
  const locales = await Promise.all(
    ["en", "fa", "ar", "zh", "hi"].map(async (locale) =>
      JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
    ),
  );
  const keys = Object.keys(locales[0]).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(locale).sort(), keys);
    assert.equal(Object.keys(locale).filter((key) => key.startsWith("p9_")).length, 4);
  }
});
