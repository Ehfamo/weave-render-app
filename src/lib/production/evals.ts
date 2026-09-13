import type {
  EvaluationCase,
  EvaluationResult,
  QualityDimension,
  QualityGate,
  RegressionResult,
} from "./contracts.ts";

export type Evaluator = (
  testCase: EvaluationCase,
  output: unknown,
) => Partial<Record<QualityDimension, number>> & { findings?: EvaluationResult["findings"] };
export function evaluateCase(
  testCase: EvaluationCase,
  output: unknown,
  evaluator: Evaluator,
  gate: QualityGate,
): EvaluationResult {
  const raw = evaluator(testCase, output),
    scores: Partial<Record<QualityDimension, number>> = {};
  for (const dimension of testCase.dimensions)
    scores[dimension] = Math.max(0, Math.min(1, raw[dimension] ?? 0));
  const values = testCase.dimensions.map((x) => scores[x] ?? 0),
    score = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const passed =
    score >= gate.minimumScore &&
    gate.required.every((x) => (scores[x] ?? 0) >= gate.minimumDimensionScore);
  return { caseId: testCase.id, scores, score, findings: raw.findings ?? [], passed };
}
export function compareEvalRuns(
  baseline: { score: number; failures: number; latencyMs: number; costMinor?: number },
  candidate: typeof baseline,
  thresholds = { score: -0.03, failures: 0, latencyMs: 250, costMinor: 100 },
): RegressionResult {
  const result = {
    scoreDelta: candidate.score - baseline.score,
    failureDelta: candidate.failures - baseline.failures,
    latencyDeltaMs: candidate.latencyMs - baseline.latencyMs,
    ...(baseline.costMinor === undefined || candidate.costMinor === undefined
      ? {}
      : { costDeltaMinor: candidate.costMinor - baseline.costMinor }),
  };
  const blocked = result.scoreDelta < thresholds.score || result.failureDelta > thresholds.failures;
  const warn =
    result.latencyDeltaMs > thresholds.latencyMs ||
    (result.costDeltaMinor ?? 0) > thresholds.costMinor;
  return { status: blocked ? "blocked" : warn ? "warn" : "pass", ...result };
}
export async function runBoundedQualityLoop<T>(
  generate: (attempt: number, signal: AbortSignal) => Promise<T>,
  accept: (value: T) => boolean,
  policy: {
    maxAttempts: number;
    maxCostMinor: number;
    costPerAttemptMinor: number;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<{
  status: "accepted" | "failed" | "cancelled" | "budget_exceeded";
  attempts: number;
  value?: T;
}> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), policy.timeoutMs);
  const cancel = () => controller.abort();
  policy.signal?.addEventListener("abort", cancel, { once: true });
  try {
    let attempts = 0;
    while (attempts < policy.maxAttempts) {
      if (controller.signal.aborted) return { status: "cancelled", attempts };
      if ((attempts + 1) * policy.costPerAttemptMinor > policy.maxCostMinor)
        return { status: "budget_exceeded", attempts };
      const value = await generate(++attempts, controller.signal);
      if (accept(value)) return { status: "accepted", attempts, value };
    }
    return { status: "failed", attempts };
  } finally {
    clearTimeout(timer);
    policy.signal?.removeEventListener("abort", cancel);
  }
}
