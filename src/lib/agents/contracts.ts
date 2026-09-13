import type { JsonValue, RoutingMode } from "../model-gateway/contracts.ts";

export const AGENT_TASK_STATUSES = [
  "queued",
  "planning",
  "waiting_approval",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number];
export type AgentKind = "research" | "coding" | "browser" | `business.${string}`;
export type AgentCapability =
  | "workspace.search"
  | "project.context"
  | "memory.read"
  | "model.reason"
  | "code.read"
  | "code.propose"
  | "code.validate"
  | "browser.navigate"
  | "browser.inspect"
  | "browser.interact";
export type RiskClass =
  "SAFE_READ" | "LOW_RISK_WRITE" | "EXTERNAL_ACTION" | "DESTRUCTIVE" | "SENSITIVE";

export interface AgentDefinition {
  id: AgentKind;
  name: string;
  capabilities: readonly AgentCapability[];
  enabled: boolean;
}
export interface AgentTask {
  id: string;
  userId: string;
  projectId: string;
  conversationId?: string;
  goal: string;
  requestedAgent?: AgentKind;
  routingMode?: RoutingMode;
  createdAt: string;
}
export interface AgentContext {
  task: AgentTask;
  projectSummary: string;
  instructions: readonly string[];
  decisions: readonly string[];
  constraints: readonly string[];
  memories: readonly { id: string; type: string; content: string }[];
  maxCharacters: number;
  truncated: boolean;
}
export interface AgentPlanStep {
  id: string;
  capability: AgentCapability;
  skillId?: string;
  toolId?: string;
  input: JsonValue;
}
export interface AgentPlan {
  objective: string;
  steps: readonly AgentPlanStep[];
}
export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}
export interface AgentResult {
  summary: string;
  data?: JsonValue;
  sources?: readonly {
    id: string;
    title: string;
    target?: string;
    provenance: "workspace" | "external";
  }[];
  changes?: readonly { path: string; patch: string; status: "proposed" | "applied" }[];
  validations?: readonly { commandId: string; ok: boolean; summary: string }[];
}
export interface AgentStep {
  id: string;
  status: "pending" | "waiting_approval" | "running" | "completed" | "failed" | "cancelled";
  toolId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: AgentError;
}
export interface AgentTraceEvent {
  id: string;
  at: string;
  type: "status" | "tool" | "approval" | "model" | "error";
  stepId?: string;
  metadata: Readonly<Record<string, JsonValue>>;
}
export interface AgentTrace {
  taskId: string;
  agentId: AgentKind;
  userId: string;
  projectId: string;
  status: AgentTaskStatus;
  steps: readonly AgentStep[];
  events: readonly AgentTraceEvent[];
  retries: number;
  startedAt: string;
  completedAt?: string;
}
export interface AgentExecution {
  trace: AgentTrace;
  result?: AgentResult;
  error?: AgentError;
}

export interface SkillInput {
  taskId: string;
  value: JsonValue;
}
export interface SkillOutput {
  value: JsonValue;
  metadata?: Readonly<Record<string, JsonValue>>;
}
export interface SkillDefinition {
  id: string;
  description: string;
  capabilities: readonly AgentCapability[];
  toolIds: readonly string[];
  enabled: boolean;
}
export interface ToolInvocation {
  id: string;
  taskId: string;
  stepId: string;
  input: JsonValue;
}
export interface ToolResult {
  ok: boolean;
  value?: JsonValue;
  error?: AgentError;
}
export interface ToolDefinition {
  id: string;
  description: string;
  capability: AgentCapability;
  risk: RiskClass;
  enabled: boolean;
  validate(input: JsonValue): boolean;
  execute(input: JsonValue, signal?: AbortSignal): Promise<JsonValue>;
}
export interface ApprovalRequest {
  id: string;
  taskId: string;
  stepId: string;
  toolId: string;
  risk: RiskClass;
  requestedBy: string;
  projectId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}
export interface ApprovalDecision {
  requestId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  reason?: string;
}
export interface ApprovalPolicy {
  classify(tool: ToolDefinition): RiskClass;
  requiresApproval(risk: RiskClass): boolean;
}

export interface AgentRuntime {
  definition: AgentDefinition;
  plan(context: AgentContext): Promise<AgentPlan>;
  finish(context: AgentContext, outputs: readonly ToolResult[]): Promise<AgentResult>;
}
