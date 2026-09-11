import type {
  AdapterResult,
  ModelDescriptor,
  ModelIdentity,
  ModelRequest,
  ProviderAdapter,
  ProviderHealth,
  ModelErrorCode,
} from "../contracts.ts";
import { normalizeModelError } from "../gateway.ts";

const record = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const tokenCount = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** REST formats stay private here. The server composition root injects secrets; no environment reads. */
export class GroqAdapter implements ProviderAdapter {
  readonly provider = Object.freeze({ id: "groq", displayName: "Groq" });
  #key: string;
  #transport: typeof fetch;
  #models: readonly ModelDescriptor[];
  #health: ProviderHealth;
  #system: string;
  constructor(options: {
    apiKey?: string;
    models: readonly ModelDescriptor[];
    fetch?: typeof fetch;
    systemInstruction?: string;
  }) {
    this.#key = options.apiKey?.trim() ?? "";
    this.#transport = options.fetch ?? fetch;
    if (
      options.models.some(
        (m) =>
          m.identity.providerId !== "groq" ||
          !m.identity.modelId.trim() ||
          m.capabilities.some((c) => c !== "text"),
      )
    )
      throw new Error("Groq adapter supports configured text models only");
    this.#models = structuredClone(options.models);
    this.#system =
      options.systemInstruction ??
      "You are the XEOMX text generation provider. Follow the user instruction precisely.";
    this.#health = {
      availability: this.#key ? "AVAILABLE" : "UNAVAILABLE",
      checkedAt: new Date().toISOString(),
    };
  }
  async getHealth(): Promise<ProviderHealth> {
    return { ...this.#health };
  }
  async discoverModels(): Promise<readonly ModelDescriptor[]> {
    return this.#key ? structuredClone(this.#models) : [];
  }
  async execute(
    request: Readonly<ModelRequest>,
    model: Readonly<ModelIdentity>,
    signal?: AbortSignal,
  ): Promise<AdapterResult> {
    const fail = (code: ModelErrorCode): AdapterResult => {
      this.#health = {
        availability: code === "AUTH_ERROR" ? "UNAVAILABLE" : "DEGRADED",
        checkedAt: new Date().toISOString(),
      };
      return { ok: false, error: normalizeModelError({ code }) };
    };
    if (!this.#key) return { ok: false, error: normalizeModelError({ code: "AUTH_ERROR" }) };
    if (
      request.capability !== "text" ||
      model.providerId !== "groq" ||
      !this.#models.some((m) => m.identity.modelId === model.modelId)
    )
      return fail("INVALID_REQUEST");
    try {
      const response = await this.#transport("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        redirect: "error",
        signal,
        headers: { Authorization: `Bearer ${this.#key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.modelId,
          messages: [
            { role: "system", content: this.#system },
            { role: "user", content: request.input },
          ],
          max_completion_tokens: request.maxOutputTokens ?? 512,
          temperature: 0,
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return fail(
          response.status === 401 || response.status === 403
            ? "AUTH_ERROR"
            : response.status === 429
              ? "RATE_LIMIT"
              : response.status === 408 || response.status === 504
                ? "TIMEOUT"
                : response.status === 404 || response.status >= 500
                  ? "PROVIDER_UNAVAILABLE"
                  : "INVALID_REQUEST",
        );
      }
      const body = record(await response.json());
      const choice = record(Array.isArray(body.choices) ? body.choices[0] : undefined);
      if (choice.finish_reason === "content_filter" || record(choice.message).refusal)
        return fail("CONTENT_REJECTED");
      const text = record(choice.message).content;
      if (typeof text !== "string" || !text.trim()) return fail("UNKNOWN_PROVIDER_ERROR");
      const usage = record(body.usage);
      this.#health = { availability: "AVAILABLE", checkedAt: new Date().toISOString() };
      return {
        ok: true,
        output: { kind: "text", text },
        completion: {
          ...(typeof body.id === "string" ? { requestId: body.id } : {}),
          ...(typeof choice.finish_reason === "string"
            ? { finishReason: choice.finish_reason }
            : {}),
        },
        ...([usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].some(tokenCount)
          ? {
              usage: {
                ...(tokenCount(usage.prompt_tokens) ? { inputTokens: usage.prompt_tokens } : {}),
                ...(tokenCount(usage.completion_tokens)
                  ? { outputTokens: usage.completion_tokens }
                  : {}),
                ...(tokenCount(usage.total_tokens) ? { totalTokens: usage.total_tokens } : {}),
              },
            }
          : {}),
      };
    } catch (error) {
      return fail(
        signal?.aborted
          ? "TIMEOUT"
          : error instanceof TypeError
            ? "PROVIDER_UNAVAILABLE"
            : "UNKNOWN_PROVIDER_ERROR",
      );
    }
  }
}
