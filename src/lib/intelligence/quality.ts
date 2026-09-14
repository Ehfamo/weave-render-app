import type { JsonValue } from "../model-gateway/contracts.ts";
import type { QualityFinding, QualityOutcome } from "./contracts.ts";

export type QualityVertical =
  "GENERAL" | "RESEARCH" | "CODE" | "CREATIVE" | "BUSINESS" | "MARKETPLACE";
export interface QualityEvaluator {
  id: string;
  verticals: readonly QualityVertical[];
  evaluate(output: JsonValue, signal: AbortSignal): Promise<QualityFinding>;
}
export interface QualityPolicy {
  maxRepairAttempts: number;
  maxCostMinor: number;
  repairCostMinor: number;
  timeoutMs: number;
  qualityThresholdRequired: boolean;
}
export async function generateEvaluateRepair<T extends JsonValue>(input: {
  vertical: QualityVertical;
  generate(signal: AbortSignal): Promise<T>;
  evaluators: readonly QualityEvaluator[];
  repair(value: T, findings: readonly QualityFinding[], signal: AbortSignal): Promise<T>;
  policy: QualityPolicy;
  signal?: AbortSignal;
}): Promise<QualityOutcome> {
  if (input.policy.maxRepairAttempts < 0 || input.policy.maxRepairAttempts > 2)
    throw Error("INVALID_REPAIR_LIMIT");
  const controller = new AbortController(),
    cancel = () => controller.abort(),
    timer = setTimeout(cancel, input.policy.timeoutMs);
  input.signal?.addEventListener("abort", cancel, { once: true });
  if (input.signal?.aborted) cancel();
  let repairs = 0;
  try {
    if (controller.signal.aborted)
      return {
        decision: "FAIL_SAFELY",
        findings: [],
        repairCount: 0,
        confidence: "NOT_INDEPENDENTLY_VERIFIED",
      };
    let output = await input.generate(controller.signal);
    while (true) {
      if (controller.signal.aborted)
        return {
          decision: "FAIL_SAFELY",
          findings: [],
          repairCount: repairs,
          confidence: "NOT_INDEPENDENTLY_VERIFIED",
        };
      const applicable = input.evaluators.filter((x) => x.verticals.includes(input.vertical));
      if (!applicable.length)
        return {
          decision: "DELIVER_WITH_WARNING",
          findings: [
            {
              evaluatorId: "none",
              status: "NOT_EVALUATED",
              code: "MISSING_EVALUATOR",
              repairable: false,
            },
          ],
          repairCount: repairs,
          confidence: "NOT_INDEPENDENTLY_VERIFIED",
          output,
        };
      const findings = await Promise.all(
        applicable.map((x) => x.evaluate(output, controller.signal)),
      );
      if (findings.every((x) => x.status === "PASS"))
        return {
          decision: "ACCEPT",
          findings,
          repairCount: repairs,
          confidence: "VERIFIED",
          output,
        };
      const repairable = findings.some((x) => x.status === "FAIL" && x.repairable);
      if (!repairable)
        return {
          decision: "DELIVER_WITH_WARNING",
          findings,
          repairCount: repairs,
          confidence: "PARTIALLY_VERIFIED",
          output,
        };
      if (
        repairs >= input.policy.maxRepairAttempts ||
        (repairs + 1) * input.policy.repairCostMinor > input.policy.maxCostMinor
      )
        return {
          decision: "FAIL_SAFELY",
          findings,
          repairCount: repairs,
          confidence: "NEEDS_USER_REVIEW",
        };
      output = await input.repair(output, findings, controller.signal);
      repairs++;
    }
  } catch {
    return {
      decision: "FAIL_SAFELY",
      findings: [],
      repairCount: repairs,
      confidence: "NOT_INDEPENDENTLY_VERIFIED",
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", cancel);
  }
}

export function verticalEvaluatorIds(vertical: QualityVertical): readonly string[] {
  return {
    GENERAL: ["instruction", "structure", "safety"],
    RESEARCH: ["provenance", "unsupported-claims", "coverage"],
    CODE: ["tests", "typecheck-lint", "security", "patch-boundary"],
    CREATIVE: ["reference-metadata", "brand", "format", "asset-references"],
    BUSINESS: ["factual-claims", "brand-voice", "external-approval"],
    MARKETPLACE: ["compatibility", "permissions", "license-provenance", "quality-metadata"],
  }[vertical];
}
