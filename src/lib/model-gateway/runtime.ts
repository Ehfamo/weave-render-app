import type {
  ModelIdentity,
  ModelRequest,
  ModelResponse,
  RoutingMode,
  ModelErrorCode,
} from "./contracts.ts";
import { ModelGateway, normalizeModelError, rankModels } from "./gateway.ts";
import { ProviderRegistry } from "./registry.ts";

export interface GatewayAttempt {
  model: ModelIdentity;
  latencyMs: number;
  outcome: "SUCCESS" | ModelErrorCode;
}
export type RuntimeResponse = ModelResponse & {
  mode: RoutingMode;
  attempts: GatewayAttempt[];
  fallbackOccurred: boolean;
};
export interface RuntimePolicy {
  maxAttempts?: number;
  attemptTimeoutMs?: number;
}

/** A timeout stops waiting even when an adapter ignores cancellation; the abort signal also stops cooperative transports. */
async function bounded<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeout: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => {
      controller.abort();
      reject({ code: "TIMEOUT" });
    };
    if (parent?.aborted) return abort();
    parent?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(abort, timeout);
  });
  try {
    return await Promise.race([
      deadline,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw { code: "TIMEOUT" };
        return run(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}

export class GatewayRuntime {
  private maxAttempts: number;
  private timeout: number;
  private registry: ProviderRegistry;
  constructor(registry: ProviderRegistry, policy: RuntimePolicy = {}) {
    this.registry = registry;
    this.maxAttempts = policy.maxAttempts ?? 3;
    this.timeout = policy.attemptTimeoutMs ?? 25000;
    if (
      !Number.isInteger(this.maxAttempts) ||
      this.maxAttempts < 1 ||
      this.maxAttempts > 3 ||
      !Number.isInteger(this.timeout) ||
      this.timeout < 1 ||
      this.timeout > 60000
    )
      throw new Error("Invalid retry policy");
  }
  async execute(request: ModelRequest, signal?: AbortSignal): Promise<RuntimeResponse> {
    const start = performance.now();
    const attempts: GatewayAttempt[] = [];
    const finish = (response: ModelResponse): RuntimeResponse => ({
      ...response,
      latencyMs: Math.max(0, performance.now() - start),
      mode: request.mode,
      attempts,
      fallbackOccurred:
        new Set(attempts.map((a) => `${a.model.providerId}/${a.model.modelId}`)).size > 1,
    });
    const fail = (code: ModelErrorCode) =>
      finish({
        ok: false,
        requestId: request.requestId,
        latencyMs: 0,
        error: normalizeModelError({ code }),
      });
    // Reuse the existing request validator before any discovery or network calls.
    const validation = await new ModelGateway([]).execute(request, signal);
    if (!validation.ok && validation.error.code !== "PROVIDER_UNAVAILABLE")
      return finish(validation);
    let snapshot;
    try {
      snapshot = await bounded(() => this.registry.snapshot(), this.timeout, signal);
    } catch {
      return fail("TIMEOUT");
    }
    const candidates = rankModels(
      snapshot.flatMap((p) => p.models),
      request,
    );
    if (!candidates.length) return fail("PROVIDER_UNAVAILABLE");
    // Try alternate eligible models first; retry the last eligible model only within the global attempt budget.
    let last: ModelResponse | undefined;
    for (let n = 0; n < this.maxAttempts; n++) {
      if (signal?.aborted) return fail("TIMEOUT");
      const selected = candidates[Math.min(n, candidates.length - 1)];
      const adapter = this.registry.getAdapter(selected.identity.providerId);
      if (!adapter) return fail("PROVIDER_UNAVAILABLE");
      const begin = performance.now();
      try {
        last = await bounded(
          (attemptSignal) =>
            new ModelGateway([
              {
                provider: adapter.provider,
                getHealth: async () => ({
                  availability: "AVAILABLE",
                  checkedAt: new Date().toISOString(),
                }),
                discoverModels: async () => [selected],
                execute: (r, m, s) => adapter.execute(r, m, s),
              },
            ]).execute(request, attemptSignal),
          this.timeout,
          signal,
        );
      } catch (error) {
        last = {
          ok: false,
          requestId: request.requestId,
          model: selected.identity,
          latencyMs: performance.now() - begin,
          error: normalizeModelError(error),
        };
      }
      attempts.push({
        model: { ...selected.identity },
        latencyMs: Math.max(0, performance.now() - begin),
        outcome: last.ok ? "SUCCESS" : last.error.code,
      });
      if (last.ok || !last.error.retryable || signal?.aborted) return finish(last);
    }
    return finish(last!);
  }
}
