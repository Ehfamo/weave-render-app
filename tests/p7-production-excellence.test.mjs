import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCostLedgerEntry,
  normalizeActualCost,
  routeByCost,
} from "../src/lib/production/cost-router.ts";
import {
  compareEvalRuns,
  evaluateCase,
  runBoundedQualityLoop,
} from "../src/lib/production/evals.ts";
import { ObservabilityService, redactTelemetry } from "../src/lib/production/observability.ts";
import {
  canResumeJob,
  normalizeOperationalError,
  recoverStaleJob,
  retryBounded,
} from "../src/lib/production/resilience.ts";
import {
  SUPPORTED_LOCALES,
  canonicalUtc,
  directionFor,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../src/lib/production/localization.ts";
import {
  evaluateReleaseReadiness,
  sourceAccessibilityGate,
  sourceMobileGate,
  validateDependencyIntegrity,
} from "../src/lib/production/release.ts";
import { CostAwareModelRuntime } from "../src/lib/production/model-runtime.ts";
import {
  assertSafeBoundedPayload,
  findUnsafeClientEnvironment,
} from "../src/lib/production/security.ts";

const signal = (id, latency, quality, health = "healthy", cost = 100) => ({
  model: { providerId: id, modelId: `${id}-model` },
  enabled: true,
  health,
  latencyMs: latency,
  successRate: 0.99,
  quality,
  cost: {
    model: { providerId: id, modelId: `${id}-model` },
    inputPerMillionMinor: cost,
    outputPerMillionMinor: cost,
    currency: "USD",
    effectiveAt: "2026-09-13T00:00:00.000Z",
  },
});
test("cost router deterministically honors FAST BALANCED BEST and health", () => {
  const options = [signal("fast", 10, 0.6), signal("best", 900, 1)];
  assert.equal(
    routeByCost(
      options,
      { mode: "FAST", capability: "text", budget: { allowUnknown: true } },
      { inputTokens: 1000, outputTokens: 1000 },
    ).model.providerId,
    "fast",
  );
  assert.equal(
    routeByCost(
      options,
      { mode: "BEST", capability: "text", budget: { allowUnknown: true } },
      { inputTokens: 1000, outputTokens: 1000 },
    ).model.providerId,
    "best",
  );
  assert.equal(
    routeByCost([signal("down", 1, 1, "unavailable")], {
      mode: "BALANCED",
      capability: "text",
      budget: { allowUnknown: true },
    }).status,
    "unavailable",
  );
});
test("budget blocks known overage and never invents missing pricing", () => {
  const over = routeByCost(
    [signal("a", 10, 0.9, "healthy", 10000)],
    { mode: "BALANCED", capability: "text", budget: { allowUnknown: false, maxRunMinor: 1 } },
    { inputTokens: 1000, outputTokens: 1000 },
  );
  assert.equal(over.status, "budget_exceeded");
  const unknown = signal("b", 10, 0.9);
  delete unknown.cost.inputPerMillionMinor;
  assert.equal(
    routeByCost([unknown], { mode: "FAST", capability: "text", budget: { allowUnknown: true } })
      .estimate.availability,
    "unavailable",
  );
});
test("actual cost and variance are provider-backed or unavailable", () => {
  const actual = normalizeActualCost({ minorUnits: 8, currency: "USD", providerReported: true });
  const item = createCostLedgerEntry({
    id: "c",
    taskId: "t",
    userId: "u",
    projectId: "p",
    estimate: { availability: "known", minorUnits: 5, currency: "USD" },
    actual,
    model: { providerId: "p", modelId: "m" },
    createdAt: "2026-09-13T00:00:00.000Z",
  });
  assert.equal(item.varianceMinor, 3);
  assert.equal(normalizeActualCost({ currency: "USD" }).availability, "unavailable");
});
test("cost-aware runtime hard-stops before Model Gateway when budget fails", async () => {
  let calls = 0;
  const runtime = new CostAwareModelRuntime({
    execute: async () => {
      calls++;
      throw Error("should not run");
    },
  });
  const result = await runtime.execute({
    request: { requestId: "r", task: "t", mode: "FAST", capability: "text", input: "x" },
    signals: [signal("costly", 10, 1, "healthy", 10000)],
    policy: { mode: "FAST", capability: "text", budget: { allowUnknown: false, maxRunMinor: 1 } },
    expectedUsage: { inputTokens: 1000, outputTokens: 1000 },
  });
  assert.equal(result.route.status, "budget_exceeded");
  assert.equal(calls, 0);
});
test("golden dataset covers all platform verticals and gate evaluates dimensions", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/p7-golden-evals.json", import.meta.url)),
  );
  assert.deepEqual(
    fixture.cases.map((x) => x.vertical),
    ["general", "research", "coding", "creative", "automation", "business", "marketplace"],
  );
  const result = evaluateCase(fixture.cases[0], {}, () => ({ structure: 1, contract: 0.9 }), {
    minimumScore: 0.8,
    required: ["structure", "contract"],
    minimumDimensionScore: 0.8,
  });
  assert.equal(result.passed, true);
});
test("quality loop is bounded by attempts and spend", async () => {
  let calls = 0;
  const attempt = await runBoundedQualityLoop(
    async () => ++calls,
    (x) => x === 3,
    { maxAttempts: 3, maxCostMinor: 2, costPerAttemptMinor: 1, timeoutMs: 1000 },
  );
  assert.deepEqual(attempt, { status: "budget_exceeded", attempts: 2 });
  assert.equal(calls, 2);
});
test("regression detector blocks score/failure regressions and warns cost latency", () => {
  assert.equal(
    compareEvalRuns(
      { score: 0.9, failures: 0, latencyMs: 10 },
      { score: 0.8, failures: 1, latencyMs: 10 },
    ).status,
    "blocked",
  );
  assert.equal(
    compareEvalRuns(
      { score: 0.9, failures: 0, latencyMs: 10, costMinor: 1 },
      { score: 0.9, failures: 0, latencyMs: 400, costMinor: 102 },
    ).status,
    "warn",
  );
});
function trace(userId = "u", projectId = "p") {
  return {
    taskId: "t",
    agentId: "research",
    userId,
    projectId,
    status: "completed",
    steps: [],
    events: [
      {
        id: "e",
        at: "2026-09-13T00:00:00.000Z",
        type: "model",
        metadata: { authorization: "Bearer hidden" },
      },
    ],
    retries: 1,
    startedAt: "2026-09-13T00:00:00.000Z",
    completedAt: "2026-09-13T00:00:01.000Z",
  };
}
test("observability redacts secrets and isolates tenant/project metrics", () => {
  assert.deepEqual(redactTelemetry({ apiKey: "secret", note: "Bearer abc.def" }), {
    apiKey: "[REDACTED]",
    note: "[REDACTED]",
  });
  const service = new ObservabilityService();
  service.ingest({ trace: trace(), latencyMs: 20 });
  service.ingest({ trace: trace("other", "other"), latencyMs: 999 });
  const result = service.metrics({ userId: "u", projectId: "p" });
  assert.equal(result.count, 1);
  assert.equal(result.averageLatencyMs, 20);
  assert.equal(
    service.query({ userId: "u", projectId: "p" })[0].trace.events[0].metadata.authorization,
    "[REDACTED]",
  );
});
test("resilience bounds retries, normalizes errors, cancels and recovers stale jobs", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      retryBounded(
        async () => {
          attempts++;
          throw { code: "TIMEOUT", detail: "private" };
        },
        { maxAttempts: 2, baseDelayMs: 0 },
      ),
    (error) => error.code === "TIMEOUT" && error.message === "The operation timed out",
  );
  assert.equal(attempts, 2);
  assert.equal(
    normalizeOperationalError(new Error("database secret")).code,
    "INTERNAL_SAFE_FAILURE",
  );
  const job = {
    id: "j",
    userId: "u",
    projectId: "p",
    status: "running",
    attempts: 1,
    updatedAt: "2026-09-13T00:00:00.000Z",
    resumeToken: "opaque",
  };
  assert.equal(recoverStaleJob(job, new Date("2026-09-13T00:10:00.000Z"), 1000).status, "queued");
  assert.equal(
    canResumeJob(
      job,
      { userId: "other", projectId: "p" },
      new Date("2026-09-13T00:00:00.500Z"),
      1000,
    ),
    false,
  );
});
test("five locales format numbers currency dates RTL and Jalali without changing UTC truth", () => {
  assert.equal(SUPPORTED_LOCALES.length, 5);
  assert.equal(directionFor("fa"), "rtl");
  assert.equal(directionFor("ar"), "rtl");
  assert.equal(directionFor("en"), "ltr");
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(formatNumber(1234, locale));
    assert.ok(formatCurrency(1234, "USD", locale));
  }
  assert.notEqual(
    formatDate("2026-09-13T00:00:00.000Z", "fa", "persian"),
    formatDate("2026-09-13T00:00:00.000Z", "en"),
  );
  assert.equal(canonicalUtc(new Date("2026-09-13T00:00:00Z")), "2026-09-13T00:00:00.000Z");
});
test("locale keys remain exact and Persian Arabic content is RTL-ready", async () => {
  const locales = await Promise.all(
    SUPPORTED_LOCALES.map(async (x) =>
      JSON.parse(await readFile(new URL(`../messages/${x}.json`, import.meta.url))),
    ),
  );
  const expected = Object.keys(locales[0]).sort();
  for (const locale of locales) assert.deepEqual(Object.keys(locale).sort(), expected);
  const ui = await readFile(
    new URL("../src/components/xeomx/production/ProductionOperations.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /dir="auto"/);
  assert.equal(sourceMobileGate(ui), true);
  assert.equal(sourceAccessibilityGate(ui), true);
});
test("release gate distinguishes source pass from deferred rendered and live evidence", () => {
  const result = evaluateReleaseReadiness({
    tests: true,
    typecheck: true,
    lint: true,
    build: true,
    security: true,
    authorization: true,
    evalRegression: "PASS",
    costGuardrails: true,
    localizationParity: true,
    dependencyIntegrity: true,
    mobileSource: true,
    performanceSource: true,
    accessibilitySource: true,
    external: {
      renderedBrowser: "DEFERRED_EXTERNAL",
      liveProvider: "BLOCKED_BY_CREDENTIAL",
      productionDeployment: "NOT_CONFIGURED",
    },
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.external.renderedBrowser, "DEFERRED_EXTERNAL");
  assert.notEqual(result.external.renderedBrowser, "LIVE_VERIFIED");
});
test("dependency lock and security boundaries remain source enforced", async () => {
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
  assert.equal(validateDependencyIntegrity(lock), true);
  const [browser, patch, market] = await Promise.all([
    readFile(new URL("../src/lib/agents/browser-safety.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/agents/patch-executor.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/marketplace/validation.ts", import.meta.url), "utf8"),
  ]);
  assert.match(browser, /approval|origin/i);
  assert.match(patch, /traversal|secret|approval/i);
  assert.match(market, /shell|sql|network/i);
});
test("central security policy blocks secret payloads and unsafe client environment", () => {
  assert.deepEqual(
    findUnsafeClientEnvironment(["VITE_APP_NAME", "VITE_PRIVATE_KEY", "DATABASE_PASSWORD"]),
    ["DATABASE_PASSWORD", "VITE_PRIVATE_KEY"],
  );
  assert.throws(() => assertSafeBoundedPayload({ token: "sk-abcdefghijklmnop" }), /SECRET_CONTENT/);
  assert.throws(() => assertSafeBoundedPayload({ value: "x".repeat(100) }, 10), /PAYLOAD_LIMIT/);
});
