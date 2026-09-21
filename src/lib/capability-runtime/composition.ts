import { createExecutionIntent } from "../intelligence/brief.ts";
import { planCapabilities } from "../intelligence/planner.ts";
import type { ProviderSignal } from "../production/contracts.ts";
import type { IntelligenceCapability } from "../intelligence/contracts.ts";
import { TaskOrchestrator } from "../agents/orchestrator.ts";
import { AgentRegistry } from "../agents/registry.ts";
import { canonicalSkills, createCanonicalTools } from "../agents/tools.ts";
import { InMemoryApprovalStore } from "../agents/approval.ts";
import type { DurableApprovalAuthority } from "../agents/durable-approval.ts";
import type { ModelGateway } from "../model-gateway/gateway.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type { MemoryService } from "../memory/service.ts";
import type { GlobalSearchService } from "../global-search/service.ts";
import type { CreativeWorkspaceService } from "../creative/workspace.ts";
import { canonicalAutomationActions } from "../automation/actions.ts";
import { BusinessAgentService } from "../business-agents/service.ts";
import { BusinessPackRegistry } from "../business-agents/registry.ts";
import type { RuntimeRequest, RuntimeStore } from "./contracts.ts";
import { RuntimeJobService } from "./service.ts";

export function composeCapabilityRuntime(d: {
  store: RuntimeStore;
  request: RuntimeRequest;
  brain: ProjectBrainService;
  memory: MemoryService;
  search: GlobalSearchService;
  gateway: Pick<ModelGateway, "execute">;
  providers?: readonly ProviderSignal[];
  approvals: DurableApprovalAuthority;
  creative: CreativeWorkspaceService;
}) {
  const registry = new AgentRegistry();
  for (const tool of createCanonicalTools(d)) registry.registerTool(tool);
  for (const skill of canonicalSkills()) registry.registerSkill(skill);
  const orchestrator = new TaskOrchestrator({
    registry,
    approvals: new InMemoryApprovalStore(),
    durableApprovals: d.approvals,
    brain: d.brain,
    gateway: d.gateway,
    async prepareContext(context) {
      const intent = createExecutionIntent({
        id: context.task.id,
        userId: context.task.userId,
        projectId: context.task.projectId,
        goal: context.task.goal,
        explicitQuality: context.task.routingMode,
        context: [
          {
            id: context.task.projectId,
            ownerId: context.task.userId,
            projectId: context.task.projectId,
            kind: "project",
            value: context.boundedContext ?? "",
            relevant: true,
          },
        ],
        selectedReferences:
          context.task.conversationId || context.task.id !== d.request.task.id
            ? [{ id: context.task.conversationId ?? d.request.task.id, kind: "result" }]
            : [],
      });
      const key: IntelligenceCapability =
        d.request.capability.kind === "creative"
          ? "creative.generate"
          : d.request.capability.kind === "automation"
            ? "automation.propose"
            : "general";
      const definition =
        d.request.capability.kind === "creative"
          ? {
              id: "creative" as const,
              name: "Creative",
              capabilities: ["creative.generate" as const],
              enabled: true,
            }
          : d.request.capability.kind === "automation"
            ? {
                id: "automation" as const,
                name: "Automation",
                capabilities: ["automation.action" as const],
                enabled: true,
              }
            : {
                id: `business.${d.request.capability.agentId}` as const,
                name: "Business",
                capabilities: ["model.reason" as const],
                enabled: true,
              };
      const plan = planCapabilities(intent.brief, [key], {
        agents: [definition],
        tools: registry.listTools(),
        skills: registry.listSkills(),
        providers: d.providers ?? [],
        budget: { allowUnknown: true },
        capabilityOverrides: {
          [key]: {
            agentId: definition.id,
            toolCapability: definition.capabilities[0],
            modality:
              d.request.capability.kind === "creative"
                ? d.request.capability.generation.intent
                : "text",
          },
        },
      });
      return {
        ...context,
        task: { ...context.task, routingMode: intent.brief.quality },
        intelligence: { intent, plan },
      };
    },
  });
  const capability = d.request.capability;
  registry.registerTool({
    id: "creative.generate",
    description: "Configured creative capability through Model Gateway",
    capability: "creative.generate",
    risk: "SAFE_READ",
    enabled: true,
    validate: (v) =>
      !!v && typeof v === "object" && !Array.isArray(v) && typeof v.prompt === "string",
    async execute(v, signal) {
      if (capability.kind !== "creative") throw Error("INVALID_CREATIVE_REQUEST");
      const response = await d.gateway.execute(
        {
          requestId: d.request.task.id,
          task: "creative.generate",
          input: (v as { prompt: string }).prompt,
          mode: capability.generation.quality,
          capability: capability.generation.intent,
        },
        signal,
      );
      if (!response.ok)
        throw Error(
          response.error.code === "PROVIDER_UNAVAILABLE" ? "NOT_CONFIGURED" : response.error.code,
        );
      if (!("url" in response.output)) throw Error("CREATIVE_OUTPUT_INVALID");
      return {
        ...response.output,
        ...(response.model
          ? { provider: response.model.providerId, model: response.model.modelId }
          : {}),
      };
    },
  });
  orchestrator.registerAgent({
    definition: {
      id: "creative",
      name: "Creative",
      capabilities: ["creative.generate"],
      enabled: true,
    },
    async plan(context) {
      return {
        objective: context.task.goal,
        steps: [
          {
            id: "generate",
            toolId: "creative.generate",
            capability: "creative.generate",
            input: {
              prompt: `${context.task.goal}\nAuthorized project context:\n${context.boundedContext ?? ""}`,
            },
          },
        ],
      };
    },
    async finish(_context, outputs) {
      const value = outputs.at(-1)?.value;
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        typeof value.url !== "string"
      )
        throw Error("CREATIVE_OUTPUT_INVALID");
      return { summary: value.url, data: value };
    },
  });
  const actions = canonicalAutomationActions({
    orchestrator,
    brain: d.brain,
    memory: d.memory,
    creative: d.creative,
  });
  for (const action of actions)
    registry.registerTool({
      id: `automation.${action.id}`,
      description: action.id,
      capability: "automation.action",
      risk:
        capability.kind === "automation" &&
        capability.workflow.steps.some((s) => s.actionId === action.id && s.requiresApproval)
          ? "LOW_RISK_WRITE"
          : action.risk,
      enabled: true,
      validate: (v) => !!v && typeof v === "object" && !Array.isArray(v),
      async execute(v, signal) {
        const x = v as Record<string, unknown>;
        if (x.projectId && x.projectId !== d.request.task.projectId)
          throw Error("AUTOMATION_SCOPE_MISMATCH");
        if (action.id === "agent.run") {
          const task = {
            ...d.request.task,
            id: `${d.request.task.id}:agent`,
            requestedAgent: "research" as const,
            goal: typeof x.goal === "string" ? x.goal : d.request.task.goal,
          };
          const result = await orchestrator.execute(task, { signal });
          if (result.trace.status !== "completed" || !result.result)
            throw Error(result.error?.code ?? "AUTOMATION_ACTION_FAILED");
          return result.result.summary;
        }
        return action.execute(
          { ...(v as object), projectId: d.request.task.projectId } as never,
          signal,
        );
      },
    });
  orchestrator.registerAgent({
    definition: {
      id: "automation",
      name: "Automation",
      capabilities: ["automation.action"],
      enabled: true,
    },
    async plan(context) {
      if (capability.kind !== "automation") throw Error("INVALID_WORKFLOW");
      return {
        objective: context.task.goal,
        steps: capability.workflow.steps.map((s) => ({
          id: s.id,
          toolId: `automation.${s.actionId}`,
          capability: "automation.action",
          input: s.input,
        })),
      };
    },
    async finish(_context, outputs) {
      return {
        summary: JSON.stringify(outputs.map((x) => x.value)),
        data: outputs.map((x) => x.value ?? null),
      };
    },
  });
  const business = new BusinessAgentService(orchestrator, new BusinessPackRegistry(), {
    async canUse(projectId, userId) {
      if (userId !== d.store.actorId) return false;
      await d.store.authorize(projectId, true);
      return true;
    },
  });
  return {
    orchestrator,
    business,
    registry,
    jobs: new RuntimeJobService(d.store, orchestrator, business),
  };
}
