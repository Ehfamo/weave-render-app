import type { GatewayGovernance } from "../model-gateway/runtime.ts";
import type { ModelDescriptor, ModelRequest } from "../model-gateway/contracts.ts";
import type { AgentGovernance } from "../agents/orchestrator.ts";
import type { GovernanceService, GovernancePort } from "./service.ts";
import { policyAllows, requirePolicy } from "./policy.ts";

/** A conservative token estimate, never provider-reconciled actual cost. Media pricing stays UNKNOWN. */
export function estimateMicrounits(model: ModelDescriptor, request: ModelRequest): number | null {
  const price = model.estimatedCostPer1kTokensUsd;
  if (
    price === undefined ||
    !Number.isFinite(price) ||
    price < 0 ||
    !["text", "structured"].includes(request.capability) ||
    !request.maxOutputTokens
  )
    return null;
  const estimate = Math.ceil(
    (new TextEncoder().encode(request.input).length + request.maxOutputTokens) * price * 1000,
  );
  return Number.isSafeInteger(estimate) ? estimate : null;
}
/** Policy integration only: execution, approvals, usage and routing remain in their canonical systems. */
export function runtimeGovernance(input: {
  policy: Pick<GovernanceService, "policy">;
  meter: GovernancePort;
  projectId: string;
  userId: string;
  runId: string;
  providerHosts: Readonly<Record<string, string | undefined>>;
}): { gateway: GatewayGovernance; agent: AgentGovernance } {
  const load = () => input.policy.policy(input.projectId);
  const permitted = (p: Awaited<ReturnType<typeof load>>, m: ModelDescriptor) =>
    policyAllows(p, "providers", m.identity.providerId) &&
    policyAllows(p, "models", `${m.identity.providerId}/${m.identity.modelId}`) &&
    policyAllows(p, "network", input.providerHosts[m.identity.providerId] ?? "UNKNOWN");
  const fields = (m: ModelDescriptor, r: ModelRequest, n: number) => ({
    projectId: input.projectId,
    runId: input.runId,
    // Request keys contain no prompt/context. Server composition is the only caller of meter.
    requestKey: `${r.requestId}:${n}`,
    provider: m.identity.providerId,
    model: m.identity.modelId,
    destination: input.providerHosts[m.identity.providerId] ?? "UNKNOWN",
    estimatedMicrounits: estimateMicrounits(m, r),
  });
  return {
    gateway: {
      async filter(models, request) {
        const p = await load();
        if (request.input.length > (p.limits?.contextChars ?? Infinity))
          throw Error("GOVERNANCE_BLOCKED");
        return models.filter((m) => permitted(p, m));
      },
      async before(model, request, attempt) {
        const p = await load();
        if (!permitted(p, model) || request.input.length > (p.limits?.contextChars ?? Infinity))
          throw Error("GOVERNANCE_BLOCKED");
        await input.meter.command("reserve", fields(model, request, attempt));
      },
      async after(model, request, attempt, response) {
        await input.meter.command("record", {
          ...fields(model, request, attempt),
          outcome: response.ok ? "SUCCESS" : response.error.code,
          latencyMs: Math.min(600000, Math.ceil(response.latencyMs)),
          inputUnits: response.ok ? (response.usage?.inputTokens ?? null) : null,
          outputUnits: response.ok ? (response.usage?.outputTokens ?? null) : null,
        });
      },
    },
    agent: {
      async authorize(task, agentId, step, tool) {
        if (task.userId !== input.userId || task.projectId !== input.projectId)
          throw Error("GOVERNANCE_BLOCKED");
        const p = await load();
        requirePolicy(p, "agents", agentId);
        if (tool) {
          requirePolicy(p, "tools", tool.id);
          if (tool.id.startsWith("mcp.")) requirePolicy(p, "mcp", tool.id);
          if (tool.risk !== "SAFE_READ") requirePolicy(p, "actions", tool.id);
          // A browser operation can never hide its destination from the policy boundary.
          if (tool.id.startsWith("browser.")) {
            const v = step?.input;
            const url =
              v && typeof v === "object" && !Array.isArray(v) && typeof v.url === "string"
                ? v.url
                : undefined;
            requirePolicy(p, "network", url ? new URL(url).hostname : "UNKNOWN");
          }
        }
        return { requireApproval: p.requireApproval, contextChars: p.limits?.contextChars };
      },
    },
  };
}
