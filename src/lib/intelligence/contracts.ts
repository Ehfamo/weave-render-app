import type { AgentKind, RiskClass } from "../agents/contracts.ts";
import type {
  JsonValue,
  ModelCapability,
  ModelIdentity,
  RoutingMode,
} from "../model-gateway/contracts.ts";

export type IntelligenceCapability =
  | "general"
  | "research"
  | "synthesis"
  | "marketing"
  | "sales"
  | "support"
  | "data"
  | "copywriting"
  | "creative.generate"
  | "creative.modify"
  | "translation"
  | "code.inspect"
  | "code.patch"
  | "code.validate"
  | "automation.propose"
  | "marketplace.search";
export type KnowledgeState = "KNOWN" | "INFERABLE_SAFELY" | "OPTIONAL" | "CRITICAL_UNKNOWN";
export type PlanningConfidence =
  "HIGH_CONFIDENCE" | "ADEQUATE" | "LOW_CONFIDENCE" | "BLOCKED_MISSING_CRITICAL_CONTEXT";
export type ResultConfidence =
  "VERIFIED" | "PARTIALLY_VERIFIED" | "NOT_INDEPENDENTLY_VERIFIED" | "NEEDS_USER_REVIEW";

export interface BriefConstraint {
  id: string;
  value: string;
  source: "explicit" | "project" | "memory" | "policy";
}
export interface BriefReference {
  id: string;
  kind: "asset" | "result" | "character" | "voice" | "brand" | "source";
}
export interface BriefContextSource {
  id: string;
  scope: "user" | "project" | "conversation";
  kind: string;
  affectedFields: readonly string[];
}
export interface BriefMissingField {
  field: string;
  state: KnowledgeState;
  reason: string;
  safeDefault?: string;
}
export interface BriefConfidence {
  state: PlanningConfidence;
  grounds: readonly string[];
}
export interface IntentInterpretation {
  kind: "GENERAL" | "RESEARCH" | "CREATIVE" | "CODE" | "AUTOMATION" | "BUSINESS" | "MARKETPLACE";
  modification: boolean;
  continuation: boolean;
  explicitQuality?: RoutingMode;
  capabilities: readonly IntelligenceCapability[];
}
export interface StructuredBrief {
  id: string;
  userId: string;
  projectId: string;
  goal: string;
  desiredOutcome: string;
  audience?: string;
  channel?: string;
  locale: string;
  outputTypes: readonly string[];
  constraints: readonly BriefConstraint[];
  references: readonly BriefReference[];
  contextSources: readonly BriefContextSource[];
  missing: readonly BriefMissingField[];
  quality: RoutingMode;
  confidence: BriefConfidence;
  requiredApprovals: readonly RiskClass[];
  preserve: readonly string[];
  changes: readonly string[];
  referenceResultId?: string;
}
export interface ClarificationDecision {
  blocks: boolean;
  question?: string;
  field?: string;
  defaultsApplied: readonly string[];
}
export interface ExecutionIntent {
  brief: StructuredBrief;
  interpretation: IntentInterpretation;
  clarification: ClarificationDecision;
}
export interface CapabilityRequirement {
  capability: IntelligenceCapability;
  required: boolean;
  modality: ModelCapability;
}
export interface SelectedAgent {
  id: AgentKind | "generic";
  reasonCodes: readonly string[];
}
export interface SelectedSkill {
  id: string;
  reasonCode: string;
}
export interface SelectedTool {
  id: string;
  risk: RiskClass;
  approvalRequired: boolean;
}
export interface SelectedModelRoute {
  mode: RoutingMode;
  model?: ModelIdentity;
  status: "SELECTED" | "UNAVAILABLE" | "BUDGET_EXCEEDED";
  reasonCode: string;
}
export interface ApprovalBoundary {
  stepId: string;
  risk: RiskClass;
  required: boolean;
}
export interface ExecutionStep {
  id: string;
  capability: IntelligenceCapability;
  agent: SelectedAgent;
  skills: readonly SelectedSkill[];
  tools: readonly SelectedTool[];
  modelRoute: SelectedModelRoute;
  approval?: ApprovalBoundary;
  expectedArtifact: string;
  fallbackRouteIds: readonly string[];
}
export interface ExecutionPlan {
  id: string;
  briefId: string;
  steps: readonly ExecutionStep[];
  maxSteps: number;
  maxDepth: number;
  constraints: readonly string[];
}
export type QualityDecision =
  "ACCEPT" | "REPAIR" | "RETRY_ALTERNATIVE_ROUTE" | "DELIVER_WITH_WARNING" | "FAIL_SAFELY";
export interface QualityFinding {
  evaluatorId: string;
  status: "PASS" | "FAIL" | "UNKNOWN" | "NOT_EVALUATED";
  code: string;
  repairable: boolean;
  evidence?: JsonValue;
}
export interface QualityOutcome {
  decision: QualityDecision;
  findings: readonly QualityFinding[];
  repairCount: number;
  confidence: ResultConfidence;
  output?: JsonValue;
}
export type MemoryWriteClass =
  "IMPORTANT_STABLE" | "PROJECT_RELEVANT" | "EPHEMERAL" | "DO_NOT_STORE";
export interface ExecutionTraceRecord {
  intentKind: IntentInterpretation["kind"];
  briefId: string;
  capabilityIds: readonly string[];
  routeIds: readonly string[];
  fallbackIds: readonly string[];
  contextReferenceIds: readonly string[];
  qualityFindings: readonly Pick<QualityFinding, "evaluatorId" | "status" | "code">[];
  repairCount: number;
  finalState: string;
}
