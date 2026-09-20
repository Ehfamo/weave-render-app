import type { AgentExecution, AgentTask } from "../agents/contracts.ts";
import type { AgentRegistry } from "../agents/registry.ts";
import { DEFAULT_AGENTS } from "../agents/runtimes.ts";
import { createExecutionIntent } from "../intelligence/brief.ts";
import type { ExecutionPlan } from "../intelligence/contracts.ts";
import { planCapabilities, type PlanningInventory } from "../intelligence/planner.ts";
import {
  generateEvaluateRepair,
  type QualityEvaluator,
  type QualityVertical,
} from "../intelligence/quality.ts";
import { createExecutionTrace } from "../intelligence/trace.ts";
import type { JsonValue } from "../model-gateway/contracts.ts";
import { createHash } from "node:crypto";
import type { ProjectsService } from "../projects/service.ts";
import type { ProjectContext } from "../project-brain/contracts.ts";
import type {
  CoreExecutionRequest,
  CoreExecutionResponse,
  CoreExecutionResult,
} from "./contracts.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9:_-]{16,200}$/;

export interface CoreExecutionDependencies {
  registry: AgentRegistry;
  inventory: PlanningInventory;
  executeTask(task: AgentTask, signal?: AbortSignal): Promise<AgentExecution>;
  evaluators?: readonly QualityEvaluator[];
  repair?(value: string, findings: readonly unknown[], signal: AbortSignal): Promise<string>;
  now?: () => string;
  id?: () => string;
  projects?: ProjectsService;
}

export function validateCoreExecutionRequest(value: unknown): CoreExecutionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_REQUEST");
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "goal",
    "idempotencyKey",
    "projectId",
    "conversationId",
    "quality",
    "locale",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("INVALID_REQUEST");
  if (typeof input.goal !== "string") throw new Error("INVALID_REQUEST");
  const goal = input.goal.trim();
  if (goal.length < 2 || goal.length > 50_000) throw new Error("INVALID_REQUEST");
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_PATTERN.test(input.idempotencyKey))
    throw new Error("INVALID_REQUEST");
  if (
    input.conversationId !== undefined &&
    (!input.projectId ||
      typeof input.conversationId !== "string" ||
      !UUID_PATTERN.test(input.conversationId))
  )
    throw new Error("INVALID_REQUEST");
  if (
    input.projectId !== undefined &&
    (typeof input.projectId !== "string" || !UUID_PATTERN.test(input.projectId))
  )
    throw new Error("INVALID_REQUEST");
  if (input.quality !== undefined && !["FAST", "BALANCED", "BEST"].includes(String(input.quality)))
    throw new Error("INVALID_REQUEST");
  if (
    input.locale !== undefined &&
    (typeof input.locale !== "string" || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.locale))
  )
    throw new Error("INVALID_REQUEST");
  return {
    goal,
    idempotencyKey: input.idempotencyKey,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId as string } : {}),
    ...(input.quality ? { quality: input.quality as CoreExecutionRequest["quality"] } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
  };
}

function vertical(kind: string): QualityVertical {
  return ["RESEARCH", "CODE", "CREATIVE", "BUSINESS", "MARKETPLACE"].includes(kind)
    ? (kind as QualityVertical)
    : "GENERAL";
}

function failure(
  executionId: string,
  goal: string,
  state: CoreExecutionResult["state"],
  errorCode: string,
  nextAction: CoreExecutionResult["nextAction"],
): CoreExecutionResponse {
  return {
    ok: false,
    data: {
      executionId,
      state,
      goal,
      errorCode,
      quality: { confidence: "NOT_INDEPENDENTLY_VERIFIED", findings: [], repairCount: 0 },
      nextAction,
    },
  };
}

export async function runCoreExecution(
  actorId: string,
  raw: unknown,
  deps: CoreExecutionDependencies,
  signal?: AbortSignal,
): Promise<CoreExecutionResponse> {
  const input = validateCoreExecutionRequest(raw);
  if (!UUID_PATTERN.test(actorId)) throw new Error("UNAUTHENTICATED");
  if (!input.projectId) return executePreparedCore(actorId, input, deps, signal);
  const executionId = deps.id?.() ?? crypto.randomUUID();
  if (!deps.projects || deps.projects.persistence.userId !== actorId)
    return failure(executionId, input.goal, "FAILED", "PROJECT_ACCESS_DENIED", "RETURN_TO_GOAL");
  let conversationId: string | undefined;
  try {
    // Authorization and bounded context precede planning and all provider work.
    const context = await deps.projects.context(input.projectId, input.conversationId);
    const submission = await deps.projects.persistence.begin({
      ...input,
      executionId,
      requestHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    });
    if (!submission.created)
      return (
        submission.response ??
        failure(executionId, input.goal, "FAILED", "EXECUTION_IN_PROGRESS", "RETURN_TO_GOAL")
      );
    conversationId = submission.conversationId;
    const response = await executePreparedCore(
      actorId,
      input,
      { ...deps, id: () => executionId },
      signal,
      context,
    );
    response.data.conversationId = conversationId;
    await deps.projects.persistence.finish(conversationId, response);
    return response;
  } catch {
    const response = failure(
      executionId,
      input.goal,
      "FAILED",
      "PROJECT_EXECUTION_UNAVAILABLE",
      "RETURN_TO_GOAL",
    );
    // If storage failed after provider execution, never return a false persisted success.
    if (conversationId) response.data.conversationId = conversationId;
    return response;
  }
}

async function executePreparedCore(
  actorId: string,
  raw: unknown,
  deps: CoreExecutionDependencies,
  signal?: AbortSignal,
  projectContext?: ProjectContext,
): Promise<CoreExecutionResponse> {
  const input = validateCoreExecutionRequest(raw);
  if (!UUID_PATTERN.test(actorId)) throw new Error("UNAUTHENTICATED");
  const executionId = deps.id?.() ?? crypto.randomUUID();
  const projectId = input.projectId ?? actorId;
  const intent = createExecutionIntent({
    id: executionId,
    userId: actorId,
    projectId,
    goal: input.goal,
    locale: input.locale,
    explicitQuality: input.quality,
    ...(projectContext
      ? {
          context: [
            {
              id: `brain-${projectId}`,
              ownerId: actorId,
              projectId,
              kind: "project",
              value: projectContext.text,
              relevant: true,
            },
          ],
          selectedReferences: projectContext.referenceResultId
            ? [{ id: projectContext.referenceResultId, kind: "result" as const }]
            : [],
        }
      : {}),
  });
  if (intent.clarification.blocks)
    return failure(executionId, input.goal, "FAILED", "MISSING_CRITICAL_CONTEXT", "RETURN_TO_GOAL");

  let plan: ExecutionPlan;
  try {
    plan = planCapabilities(intent.brief, intent.interpretation.capabilities, deps.inventory);
  } catch (error) {
    const code = error instanceof Error ? error.message : "PLANNING_FAILED";
    return failure(executionId, input.goal, "FAILED", code, "REDUCE_SCOPE");
  }
  if (plan.steps.some((step) => step.modelRoute.status === "BUDGET_EXCEEDED"))
    return failure(executionId, input.goal, "BUDGET_STOPPED", "BUDGET_EXCEEDED", "CHANGE_QUALITY");
  if (plan.steps.some((step) => step.modelRoute.status === "UNAVAILABLE"))
    return failure(
      executionId,
      input.goal,
      "NOT_CONFIGURED",
      "PROVIDER_NOT_CONFIGURED",
      "CONFIGURE_PROVIDER",
    );
  if (
    intent.brief.requiredApprovals.length ||
    plan.steps.some(
      (step) => step.approval?.required || step.tools.some((tool) => tool.approvalRequired),
    )
  )
    return failure(
      executionId,
      input.goal,
      "APPROVAL_REQUIRED",
      "APPROVAL_REQUIRED",
      "REVIEW_APPROVAL",
    );

  const supported = new Set(["GENERAL", "RESEARCH"]);
  if (!supported.has(intent.interpretation.kind))
    return failure(
      executionId,
      input.goal,
      "FAILED",
      "CAPABILITY_NOT_YET_INTEGRATED",
      "RETURN_TO_GOAL",
    );

  const selected = plan.steps.find((step) => step.agent.id !== "generic")?.agent.id;
  const selectedAgent = DEFAULT_AGENTS.find((agent) => agent.definition.id === selected)?.definition
    .id;
  const task: AgentTask = {
    id: executionId,
    userId: actorId,
    projectId,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    goal: input.goal,
    ...(selectedAgent ? { requestedAgent: selectedAgent } : {}),
    routingMode: intent.brief.quality,
    createdAt: deps.now?.() ?? new Date().toISOString(),
  };
  let agentExecution: AgentExecution | undefined;
  const quality = await generateEvaluateRepair({
    vertical: vertical(intent.interpretation.kind),
    generate: async (qualitySignal) => {
      agentExecution = await deps.executeTask(task, signal ?? qualitySignal);
      if (agentExecution.trace.status === "waiting_approval") throw new Error("APPROVAL_REQUIRED");
      if (agentExecution.trace.status === "cancelled") throw new Error("CANCELLED");
      if (!agentExecution.result)
        throw new Error(agentExecution.error?.code ?? "ORCHESTRATION_FAILED");
      return agentExecution.result.summary;
    },
    evaluators: deps.evaluators ?? [],
    repair: async (value, findings, repairSignal) =>
      deps.repair ? deps.repair(value, findings, repairSignal) : value,
    policy: {
      maxRepairAttempts: 2,
      maxCostMinor: 2,
      repairCostMinor: 1,
      timeoutMs: 30_000,
      qualityThresholdRequired: false,
    },
    signal,
  });
  if (!quality.output) {
    const agentCode = agentExecution?.error?.code;
    const cancelled = signal?.aborted || agentExecution?.trace.status === "cancelled";
    const state = cancelled ? "CANCELLED" : "FAILED";
    return {
      ok: false,
      data: {
        executionId,
        state,
        goal: input.goal,
        errorCode: cancelled ? "CANCELLED" : (agentCode ?? "EXECUTION_FAILED"),
        quality: {
          confidence: quality.confidence,
          findings: quality.findings.map(({ evaluatorId, status, code }) => ({
            evaluatorId,
            status,
            code,
          })),
          repairCount: quality.repairCount,
        },
        trace: createExecutionTrace({
          brief: intent.brief,
          intentKind: intent.interpretation.kind,
          plan,
          quality,
          finalState: state,
        }),
        nextAction: cancelled ? "RETURN_TO_GOAL" : "RETRY",
      },
    };
  }
  const trace = createExecutionTrace({
    brief: intent.brief,
    intentKind: intent.interpretation.kind,
    plan,
    quality,
    finalState: "COMPLETED",
  });
  const sourceValues = agentExecution?.result?.sources ?? [];
  return {
    ok: true,
    data: {
      executionId,
      state: "COMPLETED",
      goal: input.goal,
      output: String(quality.output as JsonValue),
      quality: {
        confidence: quality.confidence,
        findings: quality.findings.map(({ evaluatorId, status, code }) => ({
          evaluatorId,
          status,
          code,
        })),
        repairCount: quality.repairCount,
      },
      trace,
      ...(sourceValues.length
        ? {
            sources: sourceValues.map(({ id, title, target }) => ({
              id,
              title,
              ...(target ? { target } : {}),
            })),
          }
        : {}),
      nextAction: "RETURN_TO_GOAL",
    },
  };
}
