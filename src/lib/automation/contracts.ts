import type { JsonValue } from "../model-gateway/contracts.ts";
export type WorkflowStatus =
  | "draft"
  | "enabled"
  | "disabled"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";
export type TriggerKind =
  | "manual"
  | "project.event"
  | "generation.completed"
  | "asset.created"
  | "task.completed"
  | "project.changed"
  | "schedule";
export interface AutomationTrigger {
  kind: TriggerKind;
  event?: string;
  schedule?: { expression: string; timezone: string };
}
export interface AutomationCondition {
  field: string;
  operator: "eq" | "neq" | "exists";
  value?: JsonValue;
}
export interface AutomationStep {
  id: string;
  order: number;
  actionId: string;
  input: JsonValue;
  requiresApproval?: boolean;
  retries?: number;
}
export interface AutomationWorkflow {
  id: string;
  ownerId: string;
  projectId: string;
  name: string;
  status: WorkflowStatus;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  steps: AutomationStep[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface AutomationEvent {
  id: string;
  projectId: string;
  kind: TriggerKind;
  correlationId: string;
  sourceWorkflowId?: string;
  payload: JsonValue;
  createdAt: string;
}
export interface AutomationExecution {
  id: string;
  workflowId: string;
  projectId: string;
  eventId: string;
  correlationId: string;
  status: WorkflowStatus;
  completedStepIds: string[];
  approvalId?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}
export interface AutomationResult {
  execution: AutomationExecution;
  outputs: JsonValue[];
}
export interface AutomationAction {
  id: string;
  risk: "SAFE_READ" | "LOW_RISK_WRITE" | "EXTERNAL_ACTION" | "DESTRUCTIVE" | "SENSITIVE";
  execute(input: JsonValue, signal?: AbortSignal): Promise<JsonValue>;
}
