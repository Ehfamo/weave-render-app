import { defaultApprovalPolicy } from "../agents/approval.ts";
import type {
  AgentDefinition,
  RiskClass,
  SkillDefinition,
  ToolDefinition,
} from "../agents/contracts.ts";
import { routeByCost } from "../production/cost-router.ts";
import type { CostBudget, ProviderSignal } from "../production/contracts.ts";
import type {
  CapabilityRequirement,
  ExecutionPlan,
  IntelligenceCapability,
  StructuredBrief,
} from "./contracts.ts";

const AGENT_CAPABILITY: Partial<Record<IntelligenceCapability, AgentDefinition["id"]>> = {
  research: "research",
  synthesis: "research",
  "code.inspect": "coding",
  "code.patch": "coding",
  "code.validate": "coding",
};
const MODEL_CAPABILITY = (capability: IntelligenceCapability) =>
  capability === "marketplace.search" || capability === "code.inspect"
    ? ("structured" as const)
    : ("text" as const);
const toolCapability = (capability: IntelligenceCapability) =>
  capability.startsWith("code.")
    ? capability === "code.inspect"
      ? "code.read"
      : capability === "code.validate"
        ? "code.validate"
        : "code.propose"
    : capability === "research"
      ? "workspace.search"
      : "model.reason";
export interface PlanningInventory {
  agents: readonly AgentDefinition[];
  skills: readonly SkillDefinition[];
  tools: readonly ToolDefinition[];
  providers: readonly ProviderSignal[];
  budget: CostBudget;
  usage?: { inputTokens: number; outputTokens: number };
  allowedToolIds?: ReadonlySet<string>;
}

export function planCapabilities(
  brief: StructuredBrief,
  capabilities: readonly IntelligenceCapability[],
  inventory: PlanningInventory,
): ExecutionPlan {
  if (brief.confidence.state === "BLOCKED_MISSING_CRITICAL_CONTEXT")
    throw Error("BLOCKED_MISSING_CRITICAL_CONTEXT");
  const unique = [...new Set(capabilities)].slice(0, 8);
  const requirements: CapabilityRequirement[] = unique.map((capability) => ({
    capability,
    required: true,
    modality: MODEL_CAPABILITY(capability),
  }));
  const steps: ExecutionPlan["steps"][number][] = requirements.map((requirement, index) => {
    const preferred = AGENT_CAPABILITY[requirement.capability];
    const agent =
      inventory.agents.find((x) => x.enabled && x.id === preferred) ??
      inventory.agents.find((x) => x.enabled);
    const neededToolCapability = toolCapability(requirement.capability);
    const tools = inventory.tools.filter(
      (x) =>
        x.enabled &&
        x.capability === neededToolCapability &&
        (!inventory.allowedToolIds || inventory.allowedToolIds.has(x.id)),
    );
    const skills = inventory.skills.filter(
      (x) =>
        x.enabled &&
        x.capabilities.includes(neededToolCapability) &&
        x.toolIds.every((id) => tools.some((tool) => tool.id === id)),
    );
    const route = routeByCost(
      inventory.providers,
      { mode: brief.quality, budget: inventory.budget, capability: requirement.modality },
      inventory.usage,
    );
    const risk: RiskClass | undefined = tools.find((x) =>
      defaultApprovalPolicy.requiresApproval(x.risk),
    )?.risk;
    return {
      id: `step:${index + 1}`,
      capability: requirement.capability,
      agent: {
        id: agent?.id ?? "generic",
        reasonCodes: [
          agent ? `CAPABILITY_${requirement.capability}` : "GENERIC_SUPPORTED_FALLBACK",
        ],
      },
      skills: skills.map((x) => ({
        id: x.id,
        reasonCode: "DECLARED_CAPABILITY_AND_TOOLS_COMPATIBLE",
      })),
      tools: tools.map((x) => ({
        id: x.id,
        risk: x.risk,
        approvalRequired: defaultApprovalPolicy.requiresApproval(x.risk),
      })),
      modelRoute: {
        mode: brief.quality,
        ...(route.model ? { model: route.model } : {}),
        status:
          route.status === "selected"
            ? ("SELECTED" as const)
            : route.status === "budget_exceeded"
              ? ("BUDGET_EXCEEDED" as const)
              : ("UNAVAILABLE" as const),
        reasonCode: route.reason,
      },
      ...(risk ? { approval: { stepId: `step:${index + 1}`, risk, required: true } } : {}),
      expectedArtifact: requirement.capability,
      fallbackRouteIds: inventory.providers
        .filter(
          (x) =>
            x.enabled &&
            x.health !== "unavailable" &&
            x.capabilities.includes(requirement.modality),
        )
        .map((x) => `${x.model.providerId}/${x.model.modelId}`)
        .filter(
          (x) => x !== (route.model ? `${route.model.providerId}/${route.model.modelId}` : ""),
        )
        .slice(0, 2),
    };
  });
  return {
    id: `plan:${brief.id}`,
    briefId: brief.id,
    steps,
    maxSteps: 8,
    maxDepth: 2,
    constraints: ["AUTHORIZED_CANDIDATES_ONLY", "APPROVAL_AUTHORITATIVE", "NO_RECURSIVE_EXPANSION"],
  };
}

export function selectCompatibleFallback(
  step: ExecutionPlan["steps"][number],
  providers: readonly ProviderSignal[],
  budget: CostBudget,
) {
  const allowed = new Set(step.fallbackRouteIds);
  return routeByCost(
    providers.filter((x) => allowed.has(`${x.model.providerId}/${x.model.modelId}`)),
    { mode: step.modelRoute.mode, budget, capability: MODEL_CAPABILITY(step.capability) },
    { inputTokens: 0, outputTokens: 0 },
  );
}
