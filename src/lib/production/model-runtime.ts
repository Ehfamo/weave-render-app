import type { ModelRequest, ModelResponse } from "../model-gateway/contracts.ts";
import type { ModelGateway } from "../model-gateway/gateway.ts";
import type { CostPolicy, CostRouteDecision, ProviderSignal } from "./contracts.ts";
import { routeByCost } from "./cost-router.ts";

/** Production composition boundary: cost/health authorization happens before the canonical gateway. */
export class CostAwareModelRuntime {
  private readonly gateway: Pick<ModelGateway, "execute">;
  constructor(gateway: Pick<ModelGateway, "execute">) {
    this.gateway = gateway;
  }
  async execute(
    input: {
      request: ModelRequest;
      signals: readonly ProviderSignal[];
      policy: CostPolicy;
      expectedUsage?: { inputTokens: number; outputTokens: number };
    },
    signal?: AbortSignal,
  ): Promise<{ route: CostRouteDecision; response?: ModelResponse }> {
    const route = routeByCost(input.signals, input.policy, input.expectedUsage);
    if (route.status !== "selected") return { route };
    return { route, response: await this.gateway.execute(input.request, signal) };
  }
}
