import type { AgentExecution, AgentTaskStatus } from "../agents/contracts.ts";
import type { JsonValue, RoutingMode } from "../model-gateway/contracts.ts";

export const BUSINESS_PACK_IDS = ["research", "marketing", "sales", "support", "data"] as const;
export type BusinessPackId = (typeof BUSINESS_PACK_IDS)[number];
export type BusinessAgentId =
  | "web-research"
  | "competitor"
  | "market-research"
  | "marketing"
  | "seo"
  | "social-media"
  | "campaign"
  | "copywriter"
  | "sales-research"
  | "lead-generation"
  | "sdr"
  | "follow-up"
  | "sales-ops"
  | "customer-support"
  | "ticket"
  | "knowledge"
  | "data-analyst"
  | "report"
  | "visualization"
  | "kpi";
export type BusinessCapability =
  | "research.web"
  | "research.competitors"
  | "research.market"
  | "marketing.strategy"
  | "marketing.seo"
  | "marketing.social"
  | "marketing.campaign"
  | "marketing.copy"
  | "sales.research"
  | "sales.leads"
  | "sales.outreach-draft"
  | "sales.follow-up-draft"
  | "sales.operations"
  | "support.answer-draft"
  | "support.ticket"
  | "support.knowledge"
  | "data.analyze"
  | "data.report"
  | "data.visualization-spec"
  | "data.kpi";
export type HumanReviewAction =
  | "external_send"
  | "external_publish"
  | "public_content"
  | "customer_response"
  | "sales_outreach"
  | "campaign_publish"
  | "destructive_data";
export interface HumanReviewPolicy {
  requiredActions: readonly HumanReviewAction[];
  requiresReview(action: HumanReviewAction): boolean;
}
export interface BusinessAgentDefinition {
  id: BusinessAgentId;
  pack: BusinessPackId;
  name: string;
  capabilities: readonly BusinessCapability[];
  skillIds: readonly string[];
  instructions: readonly string[];
  outputSchema: string;
  reviewActions: readonly HumanReviewAction[];
}
export interface BusinessAgentPack {
  id: BusinessPackId;
  name: string;
  agents: readonly BusinessAgentDefinition[];
}
export interface BusinessSource {
  id: string;
  title: string;
  target?: string;
  provenance: "workspace" | "external" | "user" | "dataset";
}
export interface BusinessArtifact {
  id: string;
  type:
    | "research"
    | "campaign"
    | "copy"
    | "lead-list"
    | "support-draft"
    | "analysis"
    | "report"
    | "visualization-spec";
  title: string;
  data: JsonValue;
  sources: readonly BusinessSource[];
  review: "not_required" | "waiting_approval" | "approved" | "rejected";
}
export interface BusinessRunContext {
  id: string;
  taskId: string;
  userId: string;
  projectId: string;
  agentId: BusinessAgentId;
  goal: string;
  input?: JsonValue;
  routingMode?: RoutingMode;
}
export interface BusinessRunResult {
  runId: string;
  taskId: string;
  projectId: string;
  pack: BusinessPackId;
  agentId: BusinessAgentId;
  status: AgentTaskStatus;
  artifacts: readonly BusinessArtifact[];
  sources: readonly BusinessSource[];
  modelRoute?: string;
  toolUsage: readonly string[];
  usage?: { inputTokens?: number; outputTokens?: number; cost?: number; currency?: string };
  approvalStatus: "not_required" | "waiting_approval" | "approved" | "rejected";
  startedAt: string;
  completedAt?: string;
  execution: AgentExecution;
}
