import type { ModelCapability, ModelIdentity, RoutingMode } from "../model-gateway/contracts.ts";

export type MoneyMinor = number;
export type CostAvailability = "known" | "unavailable";
export interface CostEstimate { availability: CostAvailability; minorUnits?: MoneyMinor; currency: string; units?: number }
export interface ActualCost extends CostEstimate { providerReported: boolean }
export interface CostBudget { maxRunMinor?: MoneyMinor; warningAtMinor?: MoneyMinor; allowUnknown: boolean }
export interface CostPolicy { mode: RoutingMode; budget: CostBudget; capability: ModelCapability }
export interface ProviderCostMetadata { model: ModelIdentity; inputPerMillionMinor?: MoneyMinor; outputPerMillionMinor?: MoneyMinor; currency: string; effectiveAt: string }
export interface ProviderSignal { model: ModelIdentity; enabled: boolean; health: "healthy" | "degraded" | "unavailable"; latencyMs: number; successRate: number; quality: number; cost: ProviderCostMetadata }
export interface CostRouteDecision { status: "selected" | "budget_exceeded" | "unavailable"; model?: ModelIdentity; estimate: CostEstimate; reason: string; considered: number }
export interface CostLedgerEntry { id: string; taskId: string; userId: string; projectId: string; estimate: CostEstimate; actual: ActualCost; varianceMinor?: number; model: ModelIdentity; createdAt: string }

export type QualityDimension = "structure" | "provenance" | "continuity" | "brand" | "code" | "security" | "cost" | "contract";
export interface EvaluationCase { id: string; vertical: string; input: unknown; expected: Readonly<Record<string, unknown>>; dimensions: readonly QualityDimension[] }
export interface EvaluationDataset { id: string; version: string; cases: readonly EvaluationCase[] }
export interface EvaluationFinding { code: string; message: string; severity: "info" | "warning" | "error" }
export interface EvaluationResult { caseId: string; scores: Partial<Record<QualityDimension, number>>; score: number; findings: readonly EvaluationFinding[]; passed: boolean }
export interface QualityGate { minimumScore: number; required: readonly QualityDimension[]; minimumDimensionScore: number }
export interface RegressionResult { status: "pass" | "warn" | "blocked"; scoreDelta: number; failureDelta: number; latencyDeltaMs: number; costDeltaMinor?: number }

export type OperationalErrorCode = "PROVIDER_UNAVAILABLE" | "TIMEOUT" | "RATE_LIMIT" | "BUDGET_EXCEEDED" | "PERMISSION_DENIED" | "INVALID_INPUT" | "DEPENDENCY_UNAVAILABLE" | "CANCELLED" | "INTERNAL_SAFE_FAILURE";
export interface OperationalError { code: OperationalErrorCode; message: string; retryable: boolean }
export type EvidenceStatus = "SOURCE_PASS" | "LIVE_VERIFIED" | "DEFERRED_EXTERNAL" | "BLOCKED_BY_CREDENTIAL" | "NOT_CONFIGURED";
export type GateStatus = "PASS" | "WARN" | "BLOCKED";
export interface ReleaseGateResult { status: GateStatus; dimensions: Readonly<Record<string, GateStatus>>; external: Readonly<Record<string, EvidenceStatus>>; reasons: readonly string[] }
