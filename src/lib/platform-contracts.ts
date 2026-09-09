/**
 * Frontend contracts for platform capabilities that are not yet backed by a
 * production service. These contracts deliberately fail closed: an adapter
 * without a verified backend can only return `unavailable`, never a fabricated
 * success payload.
 */

export const CAPABILITY_RELEASE_STATES = [
  "live",
  "beta",
  "preview",
  "mock",
  "planned",
  "unavailable",
] as const;

export type CapabilityReleaseState = (typeof CAPABILITY_RELEASE_STATES)[number];

export const OPERATION_STATES = [
  "idle",
  "queued",
  "running",
  "partial",
  "success",
  "failed",
  "cancelled",
  "retrying",
  "unavailable",
] as const;

export type OperationState = (typeof OPERATION_STATES)[number];

export const BACKEND_CAPABILITY_IDS = [
  "ai-provider",
  "generation-jobs",
  "research-jobs",
  "model-benchmarks",
  "evidence-datasets",
  "payments",
  "entitlements",
  "credentials",
  "policy-decisions",
  "approvals",
  "audit-events",
  "telemetry",
  "storage",
  "realtime",
  "deployment",
  "cybersecurity-events",
  "identity",
  "database",
  "collaboration",
  "frontend-shell",
] as const;

export type BackendCapabilityId = (typeof BACKEND_CAPABILITY_IDS)[number];

export type BackendCapabilityContract = {
  id: BackendCapabilityId;
  label: string;
  releaseState: CapabilityReleaseState;
  operationState: OperationState;
  simulated: boolean;
  missingDependency: string;
  availableNow: string;
};

type CapabilityDefinition = Pick<
  BackendCapabilityContract,
  "id" | "label" | "missingDependency" | "availableNow"
>;

function unavailableCapability(definition: CapabilityDefinition): BackendCapabilityContract {
  return {
    ...definition,
    releaseState: "unavailable",
    operationState: "unavailable",
    simulated: false,
  };
}

const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    id: "ai-provider",
    label: "AI provider execution",
    missingDependency: "Verified provider API, credential vault and usage policy",
    availableNow: "Review the input, model choice, citations contract and save gate.",
  },
  {
    id: "generation-jobs",
    label: "Generation jobs",
    missingDependency: "Durable queue, provider execution and resumable artifact storage",
    availableNow: "Configure a generation and inspect its resumable job lifecycle.",
  },
  {
    id: "research-jobs",
    label: "Research jobs",
    missingDependency: "Durable research runner, source ingestion and cited artifact storage",
    availableNow: "Define the question, evidence boundary and report handoff.",
  },
  {
    id: "model-benchmarks",
    label: "Model benchmark data",
    missingDependency: "Versioned benchmark dataset with methodology and provenance",
    availableNow: "Inspect comparison dimensions without invented benchmark values.",
  },
  {
    id: "evidence-datasets",
    label: "Evidence datasets",
    missingDependency: "Authorized source dataset, provenance and reproducibility records",
    availableNow: "Inspect the evidence schema and empty-state behavior.",
  },
  {
    id: "payments",
    label: "Payments",
    missingDependency: "Payment provider session and confirmed server webhook",
    availableNow: "Review checkout states and recovery without creating a charge.",
  },
  {
    id: "entitlements",
    label: "Entitlements",
    missingDependency: "Server-owned entitlement ledger linked to confirmed payment events",
    availableNow: "Inspect the access boundary; no entitlement is granted in preview.",
  },
  {
    id: "credentials",
    label: "Credentials vault",
    missingDependency: "Encrypted credential vault with opaque references and scoped access",
    availableNow: "Review required scopes without entering or exposing a secret.",
  },
  {
    id: "policy-decisions",
    label: "Policy decisions",
    missingDependency: "Server-side RBAC/ABAC policy evaluation",
    availableNow: "Inspect the effective-permission preview and blocked reasons.",
  },
  {
    id: "approvals",
    label: "Approvals",
    missingDependency: "Durable approval queue with authenticated decisions",
    availableNow: "Review the approval packet; execution remains blocked.",
  },
  {
    id: "audit-events",
    label: "Audit events",
    missingDependency: "Immutable server-side audit event store",
    availableNow: "Inspect which events must be recorded before execution.",
  },
  {
    id: "telemetry",
    label: "Telemetry",
    missingDependency: "Server-side logs, usage and observability pipeline",
    availableNow: "Review telemetry fields without fabricated health or uptime.",
  },
  {
    id: "storage",
    label: "Universal storage",
    missingDependency: "Verified private buckets, policies and signed object access",
    availableNow: "Keep opaque file references attached to local context.",
  },
  {
    id: "realtime",
    label: "Realtime collaboration",
    missingDependency: "Authorized realtime channels and presence policy",
    availableNow: "Review collaboration states without fake presence.",
  },
  {
    id: "deployment",
    label: "Deployment",
    missingDependency: "Verified deployment provider, environment policy and rollback service",
    availableNow: "Inspect the deployment gate; no production action is sent.",
  },
  {
    id: "cybersecurity-events",
    label: "Cybersecurity events",
    missingDependency: "Authorized security event feed and response control plane",
    availableNow: "Review evidence, containment impact and approval requirements.",
  },
  {
    id: "identity",
    label: "Identity",
    missingDependency: "Verified authenticated identity and organization membership",
    availableNow: "Use public routes or sign in before persisted work.",
  },
  {
    id: "database",
    label: "Application data",
    missingDependency: "Verified database records and row-level access policy",
    availableNow: "Use live public discovery where connected; private records stay empty.",
  },
  {
    id: "collaboration",
    label: "Collaboration",
    missingDependency: "Organization membership, roles and realtime collaboration services",
    availableNow: "Inspect role and review boundaries without fake teammates.",
  },
  {
    id: "frontend-shell",
    label: "Repository interface",
    missingDependency: "No additional backend is required for this read-only interface",
    availableNow: "Navigate, inspect states and continue through the product contract.",
  },
] as const;

export const BACKEND_CAPABILITIES = Object.fromEntries(
  CAPABILITY_DEFINITIONS.map((definition) => [definition.id, unavailableCapability(definition)]),
) as Record<BackendCapabilityId, BackendCapabilityContract>;

// The repository interface is implemented locally even when the feature it
// describes depends on an unavailable service.
BACKEND_CAPABILITIES["frontend-shell"] = {
  ...BACKEND_CAPABILITIES["frontend-shell"],
  releaseState: "live",
  operationState: "success",
};

export type AdapterFailure = {
  code: "DEPENDENCY_UNAVAILABLE" | "OPERATION_FAILED" | "CANCELLED";
  message: string;
  retryable: boolean;
};

export const FRONTEND_ERROR_CATEGORIES = [
  "network",
  "authentication",
  "permission",
  "provider",
  "job",
  "payment",
  "validation",
  "route",
  "unexpected",
] as const;

export type FrontendErrorCategory = (typeof FRONTEND_ERROR_CATEGORIES)[number];

/**
 * Privacy-safe metadata for a future telemetry adapter. References must be
 * opaque IDs; raw prompts, files, credentials, authorization values and error
 * payloads are deliberately not part of this contract.
 */
export type FrontendErrorMetadata = {
  route: string;
  feature: string;
  category: FrontendErrorCategory;
  recoverable: boolean;
  occurredAt: string;
  projectReference?: string;
  providerReference?: string;
  jobReference?: string;
};

export function createPrivacySafeErrorMetadata(
  input: FrontendErrorMetadata,
): FrontendErrorMetadata {
  return {
    route: input.route,
    feature: input.feature,
    category: input.category,
    recoverable: input.recoverable,
    occurredAt: input.occurredAt,
    ...(input.projectReference ? { projectReference: input.projectReference } : {}),
    ...(input.providerReference ? { providerReference: input.providerReference } : {}),
    ...(input.jobReference ? { jobReference: input.jobReference } : {}),
  };
}

export type AdapterExecutionResult<TOutput> = {
  state: OperationState;
  data?: TOutput;
  error?: AdapterFailure;
};

export interface BackendAdapter<TInput = unknown, TOutput = unknown> {
  readonly capability: BackendCapabilityContract;
  execute(input: TInput): Promise<AdapterExecutionResult<TOutput>>;
}

export function createUnavailableAdapter<TInput = unknown, TOutput = never>(
  capability: BackendCapabilityContract,
): BackendAdapter<TInput, TOutput> {
  return {
    capability,
    async execute(_input: TInput) {
      return {
        state: "unavailable",
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: capability.missingDependency,
          retryable: false,
        },
      };
    },
  };
}

function createLocalInterfaceAdapter(): BackendAdapter<unknown, unknown> {
  return {
    capability: BACKEND_CAPABILITIES["frontend-shell"],
    async execute(input) {
      return { state: "success", data: input };
    },
  };
}

export const BACKEND_ADAPTERS = Object.fromEntries(
  BACKEND_CAPABILITY_IDS.map((id) => [
    id,
    id === "frontend-shell"
      ? createLocalInterfaceAdapter()
      : createUnavailableAdapter(BACKEND_CAPABILITIES[id]),
  ]),
) as Record<BackendCapabilityId, BackendAdapter>;

export function getBackendCapability(id: BackendCapabilityId): BackendCapabilityContract {
  return BACKEND_CAPABILITIES[id];
}

export function getBackendAdapter(id: BackendCapabilityId): BackendAdapter {
  return BACKEND_ADAPTERS[id];
}

export const JOB_STATES = [...OPERATION_STATES, "paused"] as const;
export type JobState = (typeof JOB_STATES)[number];

export type JobHistoryEntry = {
  state: JobState;
  at: string;
  note?: string;
};

export type JobSnapshot<TPartial = unknown, TResult = unknown> = {
  id: string;
  capability: BackendCapabilityId;
  state: JobState;
  progress: number | null;
  partialResult?: TPartial;
  result?: TResult;
  failureReason?: string;
  attempt: number;
  history: readonly JobHistoryEntry[];
};

export type JobEvent<TPartial = unknown, TResult = unknown> =
  | { type: "QUEUE"; at: string }
  | { type: "START"; at: string }
  | { type: "PROGRESS"; at: string; progress: number; partialResult?: TPartial }
  | { type: "PAUSE"; at: string }
  | { type: "RESUME"; at: string }
  | { type: "SUCCEED"; at: string; result: TResult }
  | { type: "FAIL"; at: string; reason: string }
  | { type: "CANCEL"; at: string; reason?: string }
  | { type: "RETRY"; at: string }
  | { type: "MARK_UNAVAILABLE"; at: string; reason: string };

const JOB_TRANSITIONS: Record<JobState, readonly JobEvent["type"][]> = {
  idle: ["QUEUE", "MARK_UNAVAILABLE"],
  queued: ["START", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  running: ["PROGRESS", "PAUSE", "SUCCEED", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  partial: ["PROGRESS", "PAUSE", "SUCCEED", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  paused: ["RESUME", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  success: [],
  failed: ["RETRY", "CANCEL", "MARK_UNAVAILABLE"],
  cancelled: ["RETRY"],
  retrying: ["QUEUE", "START", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  unavailable: ["RETRY"],
};

export function createJobSnapshot(
  id: string,
  capability: BackendCapabilityId,
  at: string,
): JobSnapshot {
  return {
    id,
    capability,
    state: "idle",
    progress: null,
    attempt: 0,
    history: [{ state: "idle", at }],
  };
}

export function canTransitionJob(state: JobState, event: JobEvent["type"]): boolean {
  return JOB_TRANSITIONS[state].includes(event);
}

export function transitionJob<TPartial = unknown, TResult = unknown>(
  current: JobSnapshot<TPartial, TResult>,
  event: JobEvent<TPartial, TResult>,
): JobSnapshot<TPartial, TResult> {
  if (!canTransitionJob(current.state, event.type)) {
    throw new Error(`Invalid job transition: ${current.state} -> ${event.type}`);
  }

  let state: JobState = current.state;
  let progress = current.progress;
  let partialResult = current.partialResult;
  let result = current.result;
  let failureReason = current.failureReason;
  let attempt = current.attempt;

  switch (event.type) {
    case "QUEUE":
      state = "queued";
      progress = 0;
      failureReason = undefined;
      break;
    case "START":
    case "RESUME":
      state = "running";
      progress ??= 0;
      failureReason = undefined;
      break;
    case "PROGRESS":
      progress = Math.max(0, Math.min(99, event.progress));
      partialResult = event.partialResult ?? partialResult;
      state = event.partialResult === undefined ? "running" : "partial";
      break;
    case "PAUSE":
      state = "paused";
      break;
    case "SUCCEED":
      state = "success";
      progress = 100;
      result = event.result;
      failureReason = undefined;
      break;
    case "FAIL":
      state = "failed";
      failureReason = event.reason;
      break;
    case "CANCEL":
      state = "cancelled";
      failureReason = event.reason;
      break;
    case "RETRY":
      state = "retrying";
      attempt += 1;
      failureReason = undefined;
      break;
    case "MARK_UNAVAILABLE":
      state = "unavailable";
      failureReason = event.reason;
      break;
  }

  return {
    ...current,
    state,
    progress,
    partialResult,
    result,
    failureReason,
    attempt,
    history: [...current.history, { state, at: event.at, note: failureReason }],
  };
}

export function availableJobActions(state: JobState): readonly JobEvent["type"][] {
  return JOB_TRANSITIONS[state];
}

export const PAYMENT_STATES = [
  "checkout-start",
  "awaiting-provider",
  "payment-failed",
  "payment-cancelled",
  "payment-confirming",
  "payment-confirmed",
  "entitlement-pending",
  "entitlement-active",
  "refund-pending",
  "unavailable",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

export type PaymentHistoryEntry = {
  state: PaymentState;
  at: string;
};

export type PaymentSession = {
  orderReference: string;
  state: PaymentState;
  paymentConfirmed: boolean;
  entitlementActive: boolean;
  submitLocked: boolean;
  attempts: number;
  history: readonly PaymentHistoryEntry[];
};

export type PaymentEvent =
  | { type: "AWAIT_PROVIDER"; at: string }
  | { type: "CONFIRMING"; at: string }
  | { type: "CONFIRMED"; at: string; providerReference: string }
  | { type: "ENTITLEMENT_PENDING"; at: string }
  | { type: "ACTIVATE_ENTITLEMENT"; at: string }
  | { type: "FAIL"; at: string }
  | { type: "CANCEL"; at: string }
  | { type: "RETRY"; at: string }
  | { type: "REQUEST_REFUND"; at: string }
  | { type: "MARK_UNAVAILABLE"; at: string };

const PAYMENT_TRANSITIONS: Record<PaymentState, readonly PaymentEvent["type"][]> = {
  "checkout-start": ["AWAIT_PROVIDER", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  "awaiting-provider": ["CONFIRMING", "FAIL", "CANCEL", "MARK_UNAVAILABLE"],
  "payment-failed": ["RETRY", "CANCEL", "MARK_UNAVAILABLE"],
  "payment-cancelled": ["RETRY"],
  "payment-confirming": ["CONFIRMED", "FAIL", "MARK_UNAVAILABLE"],
  "payment-confirmed": ["ENTITLEMENT_PENDING", "REQUEST_REFUND"],
  "entitlement-pending": ["ACTIVATE_ENTITLEMENT", "REQUEST_REFUND", "MARK_UNAVAILABLE"],
  "entitlement-active": ["REQUEST_REFUND"],
  "refund-pending": [],
  unavailable: ["RETRY"],
};

export function createPaymentSession(orderReference: string, at: string): PaymentSession {
  return {
    orderReference,
    state: "checkout-start",
    paymentConfirmed: false,
    entitlementActive: false,
    submitLocked: false,
    attempts: 0,
    history: [{ state: "checkout-start", at }],
  };
}

export function canTransitionPayment(state: PaymentState, event: PaymentEvent["type"]): boolean {
  return PAYMENT_TRANSITIONS[state].includes(event);
}

export function isCheckoutSubmissionLocked(session: PaymentSession): boolean {
  return session.submitLocked;
}

export function transitionPayment(current: PaymentSession, event: PaymentEvent): PaymentSession {
  if (!canTransitionPayment(current.state, event.type)) {
    throw new Error(`Invalid payment transition: ${current.state} -> ${event.type}`);
  }

  let state = current.state;
  let paymentConfirmed = current.paymentConfirmed;
  let entitlementActive = current.entitlementActive;
  let submitLocked = current.submitLocked;
  let attempts = current.attempts;

  switch (event.type) {
    case "AWAIT_PROVIDER":
      state = "awaiting-provider";
      submitLocked = true;
      attempts += 1;
      break;
    case "CONFIRMING":
      state = "payment-confirming";
      submitLocked = true;
      break;
    case "CONFIRMED":
      if (!event.providerReference.trim())
        throw new Error("Missing provider confirmation reference");
      state = "payment-confirmed";
      paymentConfirmed = true;
      submitLocked = true;
      break;
    case "ENTITLEMENT_PENDING":
      if (!paymentConfirmed) throw new Error("Entitlement cannot follow an unconfirmed payment");
      state = "entitlement-pending";
      break;
    case "ACTIVATE_ENTITLEMENT":
      if (!paymentConfirmed)
        throw new Error("Entitlement cannot activate before payment confirmation");
      state = "entitlement-active";
      entitlementActive = true;
      break;
    case "FAIL":
      state = "payment-failed";
      submitLocked = false;
      break;
    case "CANCEL":
      state = "payment-cancelled";
      submitLocked = false;
      break;
    case "RETRY":
      state = "checkout-start";
      submitLocked = false;
      entitlementActive = false;
      break;
    case "REQUEST_REFUND":
      state = "refund-pending";
      submitLocked = true;
      break;
    case "MARK_UNAVAILABLE":
      state = "unavailable";
      submitLocked = false;
      break;
  }

  return {
    ...current,
    state,
    paymentConfirmed,
    entitlementActive,
    submitLocked,
    attempts,
    history: [...current.history, { state, at: event.at }],
  };
}

export type ExternalEffect = "none" | "reversible" | "consequential" | "destructive";

export type PermissionServiceAvailability = {
  credentials: boolean;
  policy: boolean;
  approvals: boolean;
  audit: boolean;
};

export type PermissionPreviewInput = {
  target: string;
  action: string;
  requestedScopes: readonly string[];
  grantedScopes: readonly string[];
  credentialReference?: string;
  credentialRequired: boolean;
  budgetLimit?: string;
  timeLimitMinutes?: number;
  dataAccess: string;
  consequence: string;
  reversible: boolean;
  externalEffect: ExternalEffect;
  services: PermissionServiceAvailability;
};

export type EffectivePermissionDecision =
  "allowed" | "blocked" | "approval-required" | "unavailable";

export type PermissionReason =
  | "missing-scopes"
  | "missing-credential-reference"
  | "missing-time-limit"
  | "missing-budget-limit"
  | "approval-service-unavailable"
  | "audit-service-unavailable"
  | "policy-service-unavailable"
  | "credential-service-unavailable"
  | "human-approval-required";

export type EffectivePermissionPreview = {
  decision: EffectivePermissionDecision;
  effectiveScopes: readonly string[];
  missingScopes: readonly string[];
  reasons: readonly PermissionReason[];
  requiresHumanApproval: boolean;
  canExecute: boolean;
};

export function evaluateEffectivePermissions(
  input: PermissionPreviewInput,
): EffectivePermissionPreview {
  const granted = new Set(input.grantedScopes);
  const effectiveScopes = input.requestedScopes.filter((scope) => granted.has(scope));
  const missingScopes = input.requestedScopes.filter((scope) => !granted.has(scope));
  const reasons: PermissionReason[] = [];

  if (missingScopes.length > 0) reasons.push("missing-scopes");
  if (input.credentialRequired && !input.credentialReference) {
    reasons.push("missing-credential-reference");
  }
  if (!input.timeLimitMinutes || input.timeLimitMinutes <= 0) {
    reasons.push("missing-time-limit");
  }
  if (!input.budgetLimit) reasons.push("missing-budget-limit");

  const requiresHumanApproval =
    input.externalEffect === "consequential" || input.externalEffect === "destructive";
  if (requiresHumanApproval && !input.services.approvals) {
    reasons.push("approval-service-unavailable");
  }
  if (requiresHumanApproval && !input.services.audit) {
    reasons.push("audit-service-unavailable");
  }
  if (!input.services.policy) reasons.push("policy-service-unavailable");
  if (input.credentialRequired && !input.services.credentials) {
    reasons.push("credential-service-unavailable");
  }

  if (reasons.length > 0) {
    const dependencyUnavailable =
      !input.services.policy ||
      (input.credentialRequired && !input.services.credentials) ||
      (requiresHumanApproval && (!input.services.approvals || !input.services.audit));
    return {
      decision: dependencyUnavailable ? "unavailable" : "blocked",
      effectiveScopes,
      missingScopes,
      reasons,
      requiresHumanApproval,
      canExecute: false,
    };
  }

  if (requiresHumanApproval) {
    return {
      decision: "approval-required",
      effectiveScopes,
      missingScopes,
      reasons: ["human-approval-required"],
      requiresHumanApproval: true,
      canExecute: false,
    };
  }

  return {
    decision: "allowed",
    effectiveScopes,
    missingScopes,
    reasons,
    requiresHumanApproval: false,
    canExecute: true,
  };
}
