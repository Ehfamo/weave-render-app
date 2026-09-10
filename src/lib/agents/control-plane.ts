import { canonicalJson, hasSensitiveJson } from "../stage53-json.ts";

/** Pure admission/lifecycle model of the existing Stage5.3 SQL triggers.
 * Never executes a tool. Actor/approval facts must be established server-side;
 * SQL remains the ownership and persistence authority.
 */
export const CONTROL_PLANE_ACTIONS = {
  R0: ["project.read", "dataset.read", "search.read", "evidence.read"],
  R1: ["sandbox.echo", "sandbox.transform", "draft.write", "temporary.create"],
  R2: ["credential.use", "external.write", "member.change", "billing.change"],
  R3: ["external.irreversible", "production.deploy", "payment.charge", "data.delete"],
} as const;
type Risk = keyof typeof CONTROL_PLANE_ACTIONS;
type State =
  | "awaiting_approval"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "unavailable"
  | "denied";
export const canonicalizeControlPlaneValue = canonicalJson;
export const containsSensitiveKey = hasSensitiveJson;
export function validateOpaqueCredentialReferences(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every((ref) => typeof ref === "string" && /^cred_[a-zA-Z0-9_-]{8,120}$/.test(ref))
  );
}
export function validateIdempotencyEnvelope(value: {
  idempotencyKey?: unknown;
  requestHash?: unknown;
}): boolean {
  return (
    typeof value.idempotencyKey === "string" &&
    value.idempotencyKey.length >= 16 &&
    value.idempotencyKey.length <= 200 &&
    typeof value.requestHash === "string" &&
    /^[a-f0-9]{64}$/.test(value.requestHash)
  );
}
export function evaluateRunAdmission(input: {
  riskTier: Risk;
  maxRiskTier: Risk;
  actionKey: string;
  payload?: unknown;
  credentialRefs?: unknown;
}) {
  const deny = (failureCode: string) => ({
    admitted: false,
    initialState: "denied" as const,
    approvalRequired: false,
    failureCode,
  });
  const risks: readonly string[] = ["R0", "R1", "R2", "R3"];
  if (!risks.includes(input.riskTier) || !risks.includes(input.maxRiskTier))
    return deny("INVALID_RISK_TIER");
  if (risks.indexOf(input.riskTier) > risks.indexOf(input.maxRiskTier))
    return deny("RISK_EXCEEDS_DEFINITION");
  if (input.riskTier === "R3") return deny("R3_DEFAULT_DENY");
  if (!(CONTROL_PLANE_ACTIONS[input.riskTier] as readonly string[]).includes(input.actionKey))
    return deny("ACTION_NOT_ALLOWLISTED");
  if (
    hasSensitiveJson(input.payload ?? {}) ||
    !validateOpaqueCredentialReferences(input.credentialRefs ?? [])
  )
    return deny("SENSITIVE_VALUE_REJECTED");
  return {
    admitted: true,
    initialState: input.riskTier === "R2" ? ("awaiting_approval" as const) : ("queued" as const),
    approvalRequired: input.riskTier === "R2",
    failureCode: null,
  };
}
export function transitionControlledRun(
  run: { riskTier: Risk; state: State; attemptCount: number; maxAttempts: number },
  nextState: State,
  context: {
    actor: "service" | "requester" | "project-owner" | "approval-sync";
    exactOwnerApproval?: "approved" | "denied";
  },
) {
  const deny = (reason: string) => ({ allowed: false as const, reason });
  const allow = (attempt = run.attemptCount) => ({
    allowed: true as const,
    nextState,
    nextAttemptCount: attempt,
  });
  if (!Object.hasOwn(CONTROL_PLANE_ACTIONS, run.riskTier)) return deny("INVALID_RISK_TIER");
  if (run.riskTier === "R3" || run.state === "denied") return deny("R3_DEFAULT_DENY");
  if (
    !Number.isSafeInteger(run.attemptCount) ||
    !Number.isSafeInteger(run.maxAttempts) ||
    run.attemptCount < 1 ||
    run.maxAttempts < run.attemptCount ||
    run.maxAttempts > 10
  )
    return deny("INVALID_ATTEMPTS");
  if (run.riskTier === "R2" && run.state === "awaiting_approval" && nextState !== "cancelled") {
    if (context.actor !== "approval-sync") return deny("EXACT_OWNER_APPROVAL_REQUIRED");
    if (
      (nextState === "queued" && context.exactOwnerApproval === "approved") ||
      (nextState === "denied" && context.exactOwnerApproval === "denied")
    )
      return allow();
    return deny("EXACT_OWNER_APPROVAL_REQUIRED");
  }
  const user = context.actor === "requester" || context.actor === "project-owner";
  if (
    nextState === "cancelled" &&
    ["awaiting_approval", "queued", "running"].includes(run.state) &&
    (user || (context.actor === "service" && run.state !== "awaiting_approval"))
  )
    return allow();
  if (nextState === "queued" && ["failed", "cancelled", "unavailable"].includes(run.state)) {
    if (context.actor !== "service" && !(user && run.riskTier !== "R2")) return deny("FORBIDDEN");
    if (run.riskTier === "R2" && context.exactOwnerApproval !== "approved")
      return deny("EXACT_OWNER_APPROVAL_REQUIRED");
    if (run.attemptCount >= run.maxAttempts) return deny("ATTEMPTS_EXHAUSTED");
    return allow(run.attemptCount + 1);
  }
  if (context.actor !== "service") return deny("FORBIDDEN");
  if (run.state === "queued" && nextState === "running") return allow();
  if (run.state === "running" && ["succeeded", "failed", "unavailable"].includes(nextState))
    return allow();
  return deny("INVALID_TRANSITION");
}
