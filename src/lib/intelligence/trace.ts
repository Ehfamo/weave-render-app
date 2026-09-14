import type {
  ExecutionPlan,
  ExecutionTraceRecord,
  QualityOutcome,
  StructuredBrief,
} from "./contracts.ts";

export function createExecutionTrace(input: {
  brief: StructuredBrief;
  intentKind: ExecutionTraceRecord["intentKind"];
  plan: ExecutionPlan;
  quality: QualityOutcome;
  finalState: string;
}): ExecutionTraceRecord {
  return {
    intentKind: input.intentKind,
    briefId: input.brief.id,
    capabilityIds: input.plan.steps.map((step) => step.capability),
    routeIds: input.plan.steps.flatMap((step) =>
      step.modelRoute.model
        ? [`${step.modelRoute.model.providerId}/${step.modelRoute.model.modelId}`]
        : [],
    ),
    fallbackIds: input.plan.steps.flatMap((step) => step.fallbackRouteIds).slice(0, 16),
    contextReferenceIds: input.brief.contextSources.map((source) => source.id).slice(0, 32),
    qualityFindings: input.quality.findings.map(({ evaluatorId, status, code }) => ({
      evaluatorId,
      status,
      code,
    })),
    repairCount: input.quality.repairCount,
    finalState: input.finalState,
  };
}

export interface IntelligenceMetrics {
  intentKind: string;
  clarificationRequired: boolean;
  selectedAgentIds: readonly string[];
  selectedToolIds: readonly string[];
  selectedRouteIds: readonly string[];
  fallbackCount: number;
  repairCount: number;
  qualityOutcomes: readonly string[];
  finalState: string;
}

export function toIntelligenceMetrics(
  intentKind: string,
  clarificationRequired: boolean,
  plan: ExecutionPlan,
  outcome: QualityOutcome,
): IntelligenceMetrics {
  return {
    intentKind,
    clarificationRequired,
    selectedAgentIds: [...new Set(plan.steps.map((step) => step.agent.id))],
    selectedToolIds: [...new Set(plan.steps.flatMap((step) => step.tools.map((tool) => tool.id)))],
    selectedRouteIds: plan.steps.flatMap((step) =>
      step.modelRoute.model
        ? [`${step.modelRoute.model.providerId}/${step.modelRoute.model.modelId}`]
        : [],
    ),
    fallbackCount: plan.steps.filter((step) => step.modelRoute.reasonCode.includes("FALLBACK"))
      .length,
    repairCount: outcome.repairCount,
    qualityOutcomes: outcome.findings.map((finding) => finding.status),
    finalState: outcome.decision,
  };
}
