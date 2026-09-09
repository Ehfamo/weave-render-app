import type { FeatureStatus } from "@/lib/feature-status";
import type { BackendCapabilityId, ExternalEffect } from "@/lib/platform-contracts";
import type { ProductEnvironmentId } from "@/lib/product-architecture";

export const EVENT_CORE_PHASES = [
  "event",
  "policy",
  "workflow",
  "action",
  "audit",
  "notification",
] as const;

export type EventCorePhase = (typeof EVENT_CORE_PHASES)[number];

export const WORKFLOW_RUNTIME_STATES = [
  "idle",
  "evaluating-policy",
  "awaiting-approval",
  "ready",
  "running",
  "partial",
  "failed",
  "cancelled",
  "completed",
  "unavailable",
] as const;

export type WorkflowRuntimeState = (typeof WORKFLOW_RUNTIME_STATES)[number];

export type WorkflowRuntimeEvent =
  | "EVALUATE_POLICY"
  | "REQUIRE_APPROVAL"
  | "ALLOW"
  | "START"
  | "REPORT_PARTIAL"
  | "FAIL"
  | "CANCEL"
  | "COMPLETE"
  | "MARK_UNAVAILABLE"
  | "RETRY";

const WORKFLOW_TRANSITIONS: Record<WorkflowRuntimeState, readonly WorkflowRuntimeEvent[]> = {
  idle: ["EVALUATE_POLICY", "MARK_UNAVAILABLE"],
  "evaluating-policy": ["REQUIRE_APPROVAL", "ALLOW", "MARK_UNAVAILABLE", "FAIL"],
  "awaiting-approval": ["ALLOW", "CANCEL", "MARK_UNAVAILABLE"],
  ready: ["START", "CANCEL", "MARK_UNAVAILABLE"],
  running: ["REPORT_PARTIAL", "FAIL", "CANCEL", "COMPLETE", "MARK_UNAVAILABLE"],
  partial: ["REPORT_PARTIAL", "FAIL", "CANCEL", "COMPLETE", "MARK_UNAVAILABLE"],
  failed: ["RETRY", "CANCEL"],
  cancelled: ["RETRY"],
  completed: [],
  unavailable: ["RETRY"],
};

export type WorkflowRuntimeSnapshot = {
  state: WorkflowRuntimeState;
  phase: EventCorePhase;
  attempt: number;
  executionConfirmed: boolean;
};

export function createWorkflowRuntimeSnapshot(): WorkflowRuntimeSnapshot {
  return { state: "idle", phase: "event", attempt: 0, executionConfirmed: false };
}

export function canTransitionWorkflow(
  state: WorkflowRuntimeState,
  event: WorkflowRuntimeEvent,
): boolean {
  return WORKFLOW_TRANSITIONS[state].includes(event);
}

export function transitionWorkflow(
  current: WorkflowRuntimeSnapshot,
  event: WorkflowRuntimeEvent,
): WorkflowRuntimeSnapshot {
  if (!canTransitionWorkflow(current.state, event)) {
    throw new Error(`Invalid workflow transition: ${current.state} -> ${event}`);
  }

  switch (event) {
    case "EVALUATE_POLICY":
      return { ...current, state: "evaluating-policy", phase: "policy" };
    case "REQUIRE_APPROVAL":
      return { ...current, state: "awaiting-approval", phase: "policy" };
    case "ALLOW":
      return { ...current, state: "ready", phase: "workflow" };
    case "START":
      return { ...current, state: "running", phase: "action" };
    case "REPORT_PARTIAL":
      return { ...current, state: "partial", phase: "action" };
    case "FAIL":
      return { ...current, state: "failed", phase: "audit" };
    case "CANCEL":
      return { ...current, state: "cancelled", phase: "audit" };
    case "COMPLETE":
      return {
        ...current,
        state: "completed",
        phase: "notification",
        executionConfirmed: true,
      };
    case "MARK_UNAVAILABLE":
      return { ...current, state: "unavailable", phase: "audit" };
    case "RETRY":
      return {
        state: "idle",
        phase: "event",
        attempt: current.attempt + 1,
        executionConfirmed: false,
      };
  }
}

export type CoreWorkflowId = `W${number}`;

export type CoreWorkflowDefinition = {
  id: CoreWorkflowId;
  key: string;
  title: string;
  outcome: string;
  entry: { environment: ProductEnvironmentId; view: string };
  capability: BackendCapabilityId;
  releaseState: FeatureStatus;
  externalEffect: ExternalEffect;
  requiresApproval: boolean;
  stages: readonly string[];
  recovery: string;
};

function workflow(definition: CoreWorkflowDefinition): CoreWorkflowDefinition {
  return definition;
}

export const CORE_WORKFLOWS: readonly CoreWorkflowDefinition[] = [
  workflow({
    id: "W01",
    key: "ai-support",
    title: "AI support",
    outcome: "Resolve a request with confidence, escalation and knowledge feedback preserved.",
    entry: { environment: "support", view: "help" },
    capability: "ai-provider",
    releaseState: "preview",
    externalEffect: "none",
    requiresApproval: false,
    stages: ["Request", "Intent", "Knowledge", "Answer", "Confidence", "Escalation", "Resolution"],
    recovery: "Preserve the support context package and offer documentation or escalation.",
  }),
  workflow({
    id: "W02",
    key: "onboarding-activation",
    title: "Onboarding and activation",
    outcome: "Move from intent to a first useful project result before asking for deep setup.",
    entry: { environment: "ai", view: "home" },
    capability: "identity",
    releaseState: "preview",
    externalEffect: "none",
    requiresApproval: false,
    stages: [
      "Sign up",
      "Intent",
      "Recommended path",
      "First project",
      "First result",
      "Preferences",
    ],
    recovery: "Keep the intent draft and return to the exact activation step after authentication.",
  }),
  workflow({
    id: "W03",
    key: "model-router",
    title: "AI model router",
    outcome:
      "Choose by task capability, evidence, cost and latency with an explicit user override.",
    entry: { environment: "models", view: "compare" },
    capability: "ai-provider",
    releaseState: "preview",
    externalEffect: "none",
    requiresApproval: false,
    stages: ["Task", "Requirements", "Candidates", "Route", "Override", "Execute", "Feedback"],
    recovery: "Fail closed when no verified provider route exists; keep the task and selection.",
  }),
  workflow({
    id: "W04",
    key: "generation-job",
    title: "Unified generation job",
    outcome: "Run long work in the background with progress, partial output and recovery.",
    entry: { environment: "create", view: "home" },
    capability: "generation-jobs",
    releaseState: "preview",
    externalEffect: "reversible",
    requiresApproval: false,
    stages: [
      "Request",
      "Queue",
      "Run",
      "Progress",
      "Result or failure",
      "Retry or resume",
      "History",
    ],
    recovery: "Keep partial artifacts and a resumable job reference after provider failure.",
  }),
  workflow({
    id: "W05",
    key: "credit-usage",
    title: "Credit and usage",
    outcome: "Estimate, reserve and reconcile actual usage without inventing a ledger.",
    entry: { environment: "billing", view: "usage" },
    capability: "entitlements",
    releaseState: "preview",
    externalEffect: "consequential",
    requiresApproval: false,
    stages: [
      "Estimate",
      "Credit check",
      "Reserve",
      "Execute",
      "Actual usage",
      "Reconcile",
      "Ledger",
    ],
    recovery: "Release a reservation or flag reconciliation when execution does not complete.",
  }),
  workflow({
    id: "W06",
    key: "subscription-payment",
    title: "Subscription and payment lifecycle",
    outcome: "Activate access only after confirmed payment and entitlement processing.",
    entry: { environment: "billing", view: "subscriptions" },
    capability: "payments",
    releaseState: "planned",
    externalEffect: "consequential",
    requiresApproval: false,
    stages: [
      "Checkout",
      "Provider pending",
      "Confirmation",
      "Entitlement pending",
      "Active",
      "Renewal",
      "Cancellation",
    ],
    recovery: "Preserve the order reference; never grant access before server confirmation.",
  }),
  workflow({
    id: "W07",
    key: "payment-recovery",
    title: "Failed payment recovery",
    outcome: "Recover payment method and access state without duplicate submission.",
    entry: { environment: "billing", view: "methods" },
    capability: "payments",
    releaseState: "planned",
    externalEffect: "consequential",
    requiresApproval: false,
    stages: [
      "Failure",
      "Notify",
      "Retry",
      "Payment method",
      "Grace state",
      "Entitlement adjustment",
    ],
    recovery: "Unlock a safe retry while preserving the order and explaining access impact.",
  }),
  workflow({
    id: "W08",
    key: "project-context",
    title: "Project context",
    outcome: "Attach work and relationships once, then preserve them across environments.",
    entry: { environment: "projects", view: "overview" },
    capability: "database",
    releaseState: "preview",
    externalEffect: "none",
    requiresApproval: false,
    stages: [
      "Activity",
      "Attach",
      "Update context",
      "Preserve relationships",
      "Cross-environment access",
    ],
    recovery: "Keep opaque session references when durable project storage is unavailable.",
  }),
  workflow({
    id: "W09",
    key: "universal-asset",
    title: "Universal file and asset",
    outcome: "Validate, version and reuse one asset without duplicate uploads.",
    entry: { environment: "projects", view: "files" },
    capability: "storage",
    releaseState: "preview",
    externalEffect: "reversible",
    requiresApproval: false,
    stages: [
      "Upload or generate",
      "Validate",
      "Metadata",
      "Provenance",
      "Project",
      "Version",
      "Permission",
      "Reuse",
    ],
    recovery: "Retain metadata and provenance references while the object stays unavailable.",
  }),
  workflow({
    id: "W10",
    key: "notification-inbox",
    title: "Notification and inbox",
    outcome: "Turn policy-filtered events into actionable, prioritized work.",
    entry: { environment: "projects", view: "activity" },
    capability: "realtime",
    releaseState: "planned",
    externalEffect: "none",
    requiresApproval: false,
    stages: [
      "Event",
      "Preference or policy",
      "Priority",
      "Inbox",
      "Channel adapters",
      "Read or action",
    ],
    recovery: "Preserve the actionable item until its state is acknowledged by the backend.",
  }),
  workflow({
    id: "W11",
    key: "feedback-quality",
    title: "Feedback to quality",
    outcome:
      "Associate contextual feedback with task, model and provider without claiming a score.",
    entry: { environment: "evidence", view: "reviews" },
    capability: "evidence-datasets",
    releaseState: "planned",
    externalEffect: "none",
    requiresApproval: false,
    stages: [
      "Output",
      "Feedback",
      "Reason",
      "Context",
      "Model and task",
      "Dataset contract",
      "Routing input",
    ],
    recovery: "Keep feedback local until an authorized quality dataset accepts it.",
  }),
  workflow({
    id: "W12",
    key: "model-evidence-test",
    title: "Model evidence and community test",
    outcome: "Separate normalized outputs, evaluation sources, evidence and history.",
    entry: { environment: "evidence", view: "runs" },
    capability: "model-benchmarks",
    releaseState: "planned",
    externalEffect: "none",
    requiresApproval: false,
    stages: ["Test", "Execute", "Normalize", "Evaluate", "Evidence", "Score source", "History"],
    recovery: "Mark incomplete runs and exclude them from evidence-backed ranking.",
  }),
  workflow({
    id: "W13",
    key: "moderation-abuse",
    title: "Content moderation and abuse",
    outcome: "Classify with a visible decision, review path and audit boundary.",
    entry: { environment: "enterprise", view: "ai-governance" },
    capability: "policy-decisions",
    releaseState: "planned",
    externalEffect: "consequential",
    requiresApproval: true,
    stages: [
      "Content or action",
      "Classify",
      "Allow warn block or review",
      "Appeal",
      "Recovery",
      "Audit",
    ],
    recovery: "Fail closed on high-risk ambiguity and expose a human review route.",
  }),
  workflow({
    id: "W14",
    key: "suspicious-activity",
    title: "Security and suspicious activity",
    outcome: "Move from signal to verified response options with explicit approval and audit.",
    entry: { environment: "cybersecurity", view: "incidents" },
    capability: "cybersecurity-events",
    releaseState: "planned",
    externalEffect: "consequential",
    requiresApproval: true,
    stages: [
      "Signal",
      "Risk",
      "Verification",
      "Response options",
      "Session or credential action",
      "Audit",
    ],
    recovery: "Keep containment reversible and preserve evidence for post-incident review.",
  }),
  workflow({
    id: "W15",
    key: "account-recovery",
    title: "Account recovery",
    outcome: "Restore identity while handling sessions and security notification safely.",
    entry: { environment: "settings", view: "security" },
    capability: "identity",
    releaseState: "beta",
    externalEffect: "consequential",
    requiresApproval: false,
    stages: [
      "Recovery request",
      "Verification state",
      "Reset",
      "Session handling",
      "Security notification",
    ],
    recovery: "Explain expiration and restart verification without disclosing account state.",
  }),
  workflow({
    id: "W16",
    key: "creator-publish",
    title: "Creator publish",
    outcome: "Carry rights, moderation, pricing and version state into publishing.",
    entry: { environment: "creator-economy", view: "listings" },
    capability: "database",
    releaseState: "planned",
    externalEffect: "consequential",
    requiresApproval: true,
    stages: [
      "Artifact",
      "Metadata",
      "Rights and license",
      "Preview",
      "Moderation",
      "Pricing",
      "Publish and version",
    ],
    recovery: "Preserve the draft and explain which review or dependency blocks publishing.",
  }),
  workflow({
    id: "W17",
    key: "purchase-library",
    title: "Purchase to entitlement and library",
    outcome: "Make a confirmed purchase available in library and project context.",
    entry: { environment: "marketplace", view: "purchases" },
    capability: "entitlements",
    releaseState: "planned",
    externalEffect: "consequential",
    requiresApproval: false,
    stages: [
      "Purchase",
      "Payment confirmation",
      "Entitlement",
      "Library",
      "Project availability",
      "Lifecycle",
    ],
    recovery: "Hold access pending and offer payment recovery without fabricating entitlement.",
  }),
  workflow({
    id: "W18",
    key: "knowledge-ingestion",
    title: "Knowledge ingestion",
    outcome: "Carry permissions and citation metadata from source to authorized retrieval.",
    entry: { environment: "knowledge", view: "sources" },
    capability: "storage",
    releaseState: "planned",
    externalEffect: "reversible",
    requiresApproval: false,
    stages: [
      "Source",
      "Parse",
      "Process",
      "Index contract",
      "Permissions",
      "Citation metadata",
      "Collection",
      "Availability",
    ],
    recovery: "Expose parse or indexing failure without making incomplete content searchable.",
  }),
  workflow({
    id: "W19",
    key: "provider-failover",
    title: "Provider health and failover",
    outcome: "Retry or fail over without duplicate cost or a fabricated provider-health claim.",
    entry: { environment: "models", view: "providers" },
    capability: "telemetry",
    releaseState: "planned",
    externalEffect: "reversible",
    requiresApproval: false,
    stages: [
      "Request",
      "Provider health",
      "Execute",
      "Timeout or error",
      "Retry or fallback",
      "Cost guard",
      "Result",
    ],
    recovery: "Require an idempotency reference before retrying a chargeable provider action.",
  }),
  workflow({
    id: "W20",
    key: "audit-event",
    title: "Audit and event",
    outcome: "Record actor, target, policy context and result for important actions.",
    entry: { environment: "enterprise", view: "audit" },
    capability: "audit-events",
    releaseState: "preview",
    externalEffect: "none",
    requiresApproval: false,
    stages: [
      "Important action",
      "Event",
      "Actor",
      "Target",
      "Policy context",
      "Timestamp",
      "Result",
      "Query",
    ],
    recovery: "Block consequential execution when an immutable audit event cannot be recorded.",
  }),
] as const;

export const ROUTING_MODES = ["auto", "manual", "pro"] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];

export type ProviderCandidate = {
  id: string;
  capabilities: readonly string[];
  verifiedAvailable: boolean;
  evidenceReference?: string;
};

export type ProviderRouteDecision =
  | { state: "ready"; candidateId: string; mode: RoutingMode }
  | { state: "unavailable"; reason: "NO_VERIFIED_CANDIDATE" | "MANUAL_SELECTION_UNAVAILABLE" };

export function routeProviderCandidate(input: {
  mode: RoutingMode;
  requiredCapabilities: readonly string[];
  candidates: readonly ProviderCandidate[];
  manualCandidateId?: string;
}): ProviderRouteDecision {
  const supportsTask = (candidate: ProviderCandidate) =>
    candidate.verifiedAvailable &&
    Boolean(candidate.evidenceReference) &&
    input.requiredCapabilities.every((capability) => candidate.capabilities.includes(capability));

  if (input.mode === "manual") {
    const selected = input.candidates.find((candidate) => candidate.id === input.manualCandidateId);
    return selected && supportsTask(selected)
      ? { state: "ready", candidateId: selected.id, mode: input.mode }
      : { state: "unavailable", reason: "MANUAL_SELECTION_UNAVAILABLE" };
  }

  const candidate = input.candidates.find(supportsTask);
  return candidate
    ? { state: "ready", candidateId: candidate.id, mode: input.mode }
    : { state: "unavailable", reason: "NO_VERIFIED_CANDIDATE" };
}

export const EVIDENCE_SOURCE_CLASSES = [
  "official-benchmark",
  "xeomx-evaluation",
  "community-evaluation",
  "user-preference",
] as const;

export type EvidenceSourceClass = (typeof EVIDENCE_SOURCE_CLASSES)[number];

export type UniversalAssetReference = {
  id: string;
  projectId: string;
  origin: { environment: ProductEnvironmentId; reference: string };
  creatorReference?: string;
  providerReference?: string;
  modelReference?: string;
  generationSettingsReference?: string;
  version: number;
  rightsReference?: string;
  parentAssetIds: readonly string[];
  status: "pending" | "available" | "failed" | "unavailable";
};
