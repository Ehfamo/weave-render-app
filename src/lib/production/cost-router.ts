import type { ActualCost, CostEstimate, CostLedgerEntry, CostPolicy, CostRouteDecision, ProviderSignal } from "./contracts.ts";

const known = (minorUnits: number, currency: string, units?: number): CostEstimate => ({ availability: "known", minorUnits, currency, ...(units === undefined ? {} : { units }) });
export function estimateCost(signal: ProviderSignal, inputTokens?: number, outputTokens?: number): CostEstimate {
  const { inputPerMillionMinor, outputPerMillionMinor, currency } = signal.cost;
  if (inputTokens === undefined || outputTokens === undefined || inputPerMillionMinor === undefined || outputPerMillionMinor === undefined)
    return { availability: "unavailable", currency };
  return known(Math.ceil((inputTokens * inputPerMillionMinor + outputTokens * outputPerMillionMinor) / 1_000_000), currency, inputTokens + outputTokens);
}
export function routeByCost(signals: readonly ProviderSignal[], policy: CostPolicy, usage?: { inputTokens: number; outputTokens: number }): CostRouteDecision {
  const eligible = signals.filter((x) => x.enabled && x.health !== "unavailable" && x.successRate >= .5);
  const weighted = eligible.map((signal) => {
    const estimate = estimateCost(signal, usage?.inputTokens, usage?.outputTokens);
    const cost = estimate.availability === "known" ? estimate.minorUnits! : Number.MAX_SAFE_INTEGER;
    const score = policy.mode === "FAST" ? signal.latencyMs * .7 + cost * .1 - signal.successRate * 100 : policy.mode === "BEST" ? (1 - signal.quality) * 1000 + signal.latencyMs * .05 + cost * .05 : signal.latencyMs * .25 + cost * .35 + (1 - signal.quality) * 400;
    return { signal, estimate, score };
  }).filter(({ estimate }) => estimate.availability === "known" || policy.budget.allowUnknown)
    .sort((a, b) => a.score - b.score || `${a.signal.model.providerId}/${a.signal.model.modelId}`.localeCompare(`${b.signal.model.providerId}/${b.signal.model.modelId}`, "en"));
  const within = weighted.find(({ estimate }) => estimate.availability !== "known" || policy.budget.maxRunMinor === undefined || estimate.minorUnits! <= policy.budget.maxRunMinor);
  if (!within) return { status: weighted.length ? "budget_exceeded" : "unavailable", estimate: { availability: "unavailable", currency: signals[0]?.cost.currency ?? "USD" }, reason: weighted.length ? "RUN_BUDGET_EXCEEDED" : "NO_HEALTHY_COMPATIBLE_ROUTE", considered: eligible.length };
  return { status: "selected", model: within.signal.model, estimate: within.estimate, reason: within.signal.health === "degraded" ? "DEGRADED_FALLBACK" : `MODE_${policy.mode}`, considered: eligible.length };
}
export function normalizeActualCost(value: { minorUnits?: number; currency: string; providerReported?: boolean }): ActualCost {
  return Number.isSafeInteger(value.minorUnits) && value.minorUnits! >= 0 ? { availability: "known", minorUnits: value.minorUnits, currency: value.currency, providerReported: value.providerReported === true } : { availability: "unavailable", currency: value.currency, providerReported: false };
}
export function createCostLedgerEntry(input: Omit<CostLedgerEntry, "varianceMinor">): CostLedgerEntry {
  const varianceMinor = input.estimate.availability === "known" && input.actual.availability === "known" ? input.actual.minorUnits! - input.estimate.minorUnits! : undefined;
  return { ...input, ...(varianceMinor === undefined ? {} : { varianceMinor }) };
}
