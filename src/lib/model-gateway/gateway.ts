import type {
  ModelDescriptor,
  ModelError,
  ModelErrorCode,
  ModelRequest,
  ModelResponse,
  ProviderAdapter,
  RoutingMode,
  AdapterResult,
} from "./contracts.ts";

const messages: Record<ModelErrorCode, string> = {
  AUTH_ERROR: "Provider authentication failed",
  RATE_LIMIT: "Provider rate limit reached",
  PROVIDER_UNAVAILABLE: "No eligible provider is available",
  INVALID_REQUEST: "Invalid model request",
  TIMEOUT: "Model request timed out",
  CONTENT_REJECTED: "Content was rejected",
  UNKNOWN_PROVIDER_ERROR: "Provider request failed",
};
/** Never return raw exception messages, response bodies, headers or credentials. */
export function normalizeModelError(value: unknown): ModelError {
  const candidate =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const code: ModelErrorCode =
    typeof candidate.code === "string" && Object.hasOwn(messages, candidate.code)
      ? (candidate.code as ModelErrorCode)
      : candidate.name === "AbortError"
        ? "TIMEOUT"
        : "UNKNOWN_PROVIDER_ERROR";
  return {
    code,
    message: messages[code],
    retryable: ["RATE_LIMIT", "TIMEOUT", "PROVIDER_UNAVAILABLE"].includes(code),
  };
}

/** Deterministic product policy, independent of provider names. Smaller scores win. */
export const ROUTING_POLICY: Readonly<
  Record<RoutingMode, Readonly<{ latency: number; quality: number; cost: number }>>
> = Object.freeze({
  FAST: Object.freeze({ latency: 0.8, quality: 0.1, cost: 0.1 }),
  BALANCED: Object.freeze({ latency: 0.3, quality: 0.4, cost: 0.3 }),
  BEST: Object.freeze({ latency: 0.05, quality: 0.9, cost: 0.05 }),
});
const finiteNonnegative = (n: number) => Number.isFinite(n) && n >= 0;
export function rankModels(
  models: readonly ModelDescriptor[],
  request: ModelRequest,
): ModelDescriptor[] {
  const weights = ROUTING_POLICY[request.mode];
  if (!weights) return [];
  return models
    .filter(
      (m) =>
        m.capabilities.includes(request.capability) &&
        m.identity.providerId.length > 0 &&
        m.identity.modelId.length > 0 &&
        finiteNonnegative(m.quality) &&
        m.quality <= 1 &&
        finiteNonnegative(m.estimatedLatencyMs) &&
        finiteNonnegative(m.estimatedCostPer1kTokensUsd),
    )
    .map((m) => ({
      model: m,
      score:
        (weights.latency * m.estimatedLatencyMs) / (m.estimatedLatencyMs + 1000) +
        (weights.cost * m.estimatedCostPer1kTokensUsd) / (m.estimatedCostPer1kTokensUsd + 1) +
        weights.quality * (1 - m.quality),
    }))
    .sort(
      (a, b) =>
        a.score - b.score ||
        `${a.model.identity.providerId}/${a.model.identity.modelId}`.localeCompare(
          `${b.model.identity.providerId}/${b.model.identity.modelId}`,
          "en",
        ),
    )
    .map((item) => item.model);
}

function validRequest(r: ModelRequest): boolean {
  return (
    typeof r.requestId === "string" &&
    r.requestId.trim().length > 0 &&
    typeof r.task === "string" &&
    r.task.trim().length > 0 &&
    typeof r.input === "string" &&
    r.input.trim().length > 0 &&
    r.input.length <= 1_000_000 &&
    Object.hasOwn(ROUTING_POLICY, r.mode) &&
    ["text", "structured", "embedding"].includes(r.capability) &&
    (r.maxOutputTokens === undefined ||
      (Number.isSafeInteger(r.maxOutputTokens) && r.maxOutputTokens > 0))
  );
}

function cleanResult(result: AdapterResult, request: ModelRequest): AdapterResult {
  if (!result.ok) return { ok: false, error: normalizeModelError(result.error) };
  const out = result.output;
  if (out.kind !== request.capability) throw new Error("Invalid output capability");
  let output;
  if (out.kind === "text") {
    if (typeof out.text !== "string") throw new Error("Invalid text");
    output = { kind: "text" as const, text: out.text };
  } else if (out.kind === "embedding") {
    if (!Array.isArray(out.values) || !out.values.length || !out.values.every(Number.isFinite))
      throw new Error("Invalid embedding");
    output = { kind: "embedding" as const, values: [...out.values] };
  } else {
    // JSON serialization rejects cycles and isolates adapter-owned references.
    output = { kind: "structured" as const, value: JSON.parse(JSON.stringify(out.value)) };
  }
  const usage = result.usage;
  if (
    usage &&
    (!Number.isSafeInteger(usage.inputTokens) ||
      usage.inputTokens < 0 ||
      !Number.isSafeInteger(usage.outputTokens) ||
      usage.outputTokens < 0 ||
      (usage.totalTokens !== undefined &&
        (!Number.isSafeInteger(usage.totalTokens) || usage.totalTokens < 0)))
  )
    throw new Error("Invalid usage");
  return {
    ok: true,
    output,
    ...(usage
      ? {
          usage: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            ...(usage.totalTokens === undefined ? {} : { totalTokens: usage.totalTokens }),
          },
        }
      : {}),
  };
}

/** Server-side composition root supplies adapters; this module reads no environment or user store. */
export class ModelGateway {
  private readonly adapters: readonly ProviderAdapter[];
  constructor(adapters: readonly ProviderAdapter[]) {
    if (new Set(adapters.map((a) => a.provider.id)).size !== adapters.length)
      throw new Error("Duplicate provider identity");
    this.adapters = [...adapters];
  }
  async execute(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> {
    const start = performance.now();
    const elapsed = () => Math.max(0, performance.now() - start);
    const fail = (code: ModelErrorCode): ModelResponse => ({
      ok: false,
      requestId: request.requestId,
      latencyMs: elapsed(),
      error: normalizeModelError({ code }),
    });
    if (!validRequest(request)) return fail("INVALID_REQUEST");
    if (signal?.aborted) return fail("TIMEOUT");
    // Copy only XEOMX request fields; extra caller properties never reach providers.
    const input: ModelRequest = {
      requestId: request.requestId,
      task: request.task,
      mode: request.mode,
      capability: request.capability,
      input: request.input,
      ...(request.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: request.maxOutputTokens }),
    };
    const discovered = await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          const health = await adapter.getHealth();
          if (!["AVAILABLE", "DEGRADED"].includes(health.availability)) return [];
          return (await adapter.discoverModels()).filter(
            (m) => m.identity.providerId === adapter.provider.id,
          );
        } catch {
          return [];
        } // Failed discovery means unavailable, never a successful execution.
      }),
    );
    const selected = rankModels(discovered.flat(), input)[0];
    if (!selected) return fail("PROVIDER_UNAVAILABLE");
    if (signal?.aborted) return fail("TIMEOUT");
    const model = { providerId: selected.identity.providerId, modelId: selected.identity.modelId };
    const adapter = this.adapters.find((a) => a.provider.id === model.providerId)!;
    try {
      const result = cleanResult(
        await adapter.execute(Object.freeze(input), Object.freeze(model), signal),
        input,
      );
      if (signal?.aborted) return fail("TIMEOUT");
      return { ...result, requestId: input.requestId, model, latencyMs: elapsed() };
    } catch (error) {
      return {
        ok: false,
        requestId: input.requestId,
        model,
        latencyMs: elapsed(),
        error: normalizeModelError(error),
      };
    }
  }
}
