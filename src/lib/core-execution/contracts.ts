import type {
  ExecutionTraceRecord,
  QualityFinding,
  ResultConfidence,
} from "../intelligence/contracts.ts";
import type { RoutingMode } from "../model-gateway/contracts.ts";

export const CORE_EXECUTION_STATES = [
  "PREPARING",
  "PLANNING",
  "RUNNING",
  "EVALUATING",
  "REPAIRING",
  "APPROVAL_REQUIRED",
  "COMPLETED",
  "FAILED",
  "NOT_CONFIGURED",
  "CANCELLED",
  "BUDGET_STOPPED",
] as const;
export type CoreExecutionState = (typeof CORE_EXECUTION_STATES)[number];

export interface CoreExecutionRequest {
  goal: string;
  idempotencyKey: string;
  projectId?: string;
  conversationId?: string;
  quality?: RoutingMode;
  locale?: string;
}

export interface CoreExecutionResult {
  executionId: string;
  conversationId?: string;
  state: CoreExecutionState;
  goal: string;
  output?: string;
  quality: {
    confidence: ResultConfidence;
    findings: readonly Pick<QualityFinding, "evaluatorId" | "status" | "code">[];
    repairCount: number;
  };
  trace?: ExecutionTraceRecord;
  sources?: readonly { id: string; title: string; target?: string }[];
  errorCode?: string;
  nextAction:
    | "RETRY"
    | "CHANGE_QUALITY"
    | "REDUCE_SCOPE"
    | "CONFIGURE_PROVIDER"
    | "REVIEW_APPROVAL"
    | "RETURN_TO_GOAL";
}

export type CoreExecutionResponse =
  { ok: true; data: CoreExecutionResult } | { ok: false; data: CoreExecutionResult };
