// Deno and Node-compatible worker bridge. Imports the single XEOMX implementation;
// no copied gateway, SDK, env lookup, queue or database authority here.
import { GroqAdapter } from "../../../src/lib/model-gateway/providers/groq.ts";
import { GatewayRuntime } from "../../../src/lib/model-gateway/runtime.ts";
import { ProviderRegistry } from "../../../src/lib/model-gateway/registry.ts";
import type { ModelDescriptor } from "../../../src/lib/model-gateway/contracts.ts";

export class GatewayRouteFailure extends Error {
  readonly code: "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "GENERATION_FAILED";
  readonly retryable: boolean;
  constructor(code: GatewayRouteFailure["code"], message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export function createGroqGatewayRoute(options: {
  getApiKey: () => string | undefined;
  systemInstruction: string;
  fetch?: typeof fetch;
}) {
  const model = "llama-3.1-8b-instant";
  return {
    id: "groq" as const,
    model,
    configured: () => Boolean(options.getApiKey()?.trim()),
    generate: async ({ prompt, maxTokens }: { prompt: string; maxTokens: number }) => {
      const models: ModelDescriptor[] = [
        {
          identity: { providerId: "groq", modelId: model },
          capabilities: ["text"],
          quality: 0.5,
          estimatedLatencyMs: 1000,
          estimatedCostPer1kTokensUsd: 1,
        },
      ];
      const registry = new ProviderRegistry();
      registry.register(
        new GroqAdapter({
          apiKey: options.getApiKey(),
          models,
          fetch: options.fetch,
          systemInstruction: options.systemInstruction,
        }),
      );
      // The authenticated worker owns outer provider transitions and citation retries.
      // One inner attempt avoids multiplying that existing retry budget.
      const response = await new GatewayRuntime(registry, { maxAttempts: 1 }).execute({
        requestId: crypto.randomUUID(),
        task: "queued-text-generation",
        capability: "text",
        mode: "BALANCED",
        input: prompt,
        maxOutputTokens: maxTokens,
      });
      if (!response.ok)
        throw new GatewayRouteFailure(
          response.error.code === "TIMEOUT"
            ? "PROVIDER_TIMEOUT"
            : response.error.code === "PROVIDER_UNAVAILABLE" || response.error.code === "RATE_LIMIT"
              ? "PROVIDER_UNAVAILABLE"
              : "GENERATION_FAILED",
          response.error.message,
          response.error.retryable,
        );
      if (response.output.kind !== "text")
        throw new GatewayRouteFailure("GENERATION_FAILED", "Unexpected output capability", false);
      return {
        text: response.output.text,
        providerRequestId: response.completion?.requestId ?? null,
        finishReason: response.completion?.finishReason ?? "unknown",
        usage: {
          inputUnits: response.usage?.inputTokens ?? null,
          outputUnits: response.usage?.outputTokens ?? null,
          actualCostMicrounits: null,
          unavailable:
            response.usage?.inputTokens === undefined || response.usage?.outputTokens === undefined,
        },
      };
    },
  };
}
