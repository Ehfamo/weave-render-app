import "@tanstack/react-start/server-only";
import type { ModelDescriptor } from "./contracts.ts";
import { CreativeHttpAdapter, creativeCapabilities } from "./providers/creative-http.ts";
import { GroqAdapter } from "./providers/groq.ts";
import { ProviderRegistry } from "./registry.ts";
import { GatewayRuntime } from "./runtime.ts";

/** Import only inside an authenticated server handler/tool. No public unauthenticated endpoint. */
export function createModelGatewayRuntime(
  env: {
    GROQ_API_KEY?: string;
    XEOMX_CREATIVE_ENDPOINT?: string;
    XEOMX_CREATIVE_KEY?: string;
  } = process.env,
) {
  const registry = new ProviderRegistry();
  // Model ID reused from existing generation worker. Scores are routing configuration,
  // not measured performance or a billing price; with one model they do not affect selection.
  const models: ModelDescriptor[] = [
    {
      identity: { providerId: "groq", modelId: "llama-3.1-8b-instant" },
      capabilities: ["text"],
      quality: 0.5,
      estimatedLatencyMs: 1000,
      estimatedCostPer1kTokensUsd: 1,
    },
  ];
  registry.register(new GroqAdapter({ apiKey: env.GROQ_API_KEY, models }));
  registry.register(
    new CreativeHttpAdapter({
      endpoint: env.XEOMX_CREATIVE_ENDPOINT,
      key: env.XEOMX_CREATIVE_KEY,
      models: creativeCapabilities.map((capability) => ({
        identity: { providerId: "creative-http", modelId: capability },
        capabilities: [capability],
        quality: 0.5,
        estimatedLatencyMs: 1000,
      })),
    }),
  );
  return { registry, gateway: new GatewayRuntime(registry) };
}
