import "@tanstack/react-start/server-only";
import { InMemoryApprovalStore } from "../agents/approval.ts";
import { TaskOrchestrator } from "../agents/orchestrator.ts";
import { AgentRegistry } from "../agents/registry.ts";
import { DEFAULT_AGENTS } from "../agents/runtimes.ts";
import { canonicalSkills, createCanonicalTools } from "../agents/tools.ts";
import { GlobalSearchService } from "../global-search/service.ts";
import type {
  MemoryAdapter,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryRecord,
  MemorySettings,
} from "../memory/contracts.ts";
import { MemoryService } from "../memory/service.ts";
import { createModelGatewayRuntime } from "../model-gateway/runtime.server.ts";
import type { ProviderSignal } from "../production/contracts.ts";
import { ProjectBrainService } from "../project-brain/service.ts";
import { createProjectBrainService } from "../project-brain/runtime.server.ts";
import { createSearchService } from "../global-search/runtime.server.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectsForClient } from "../projects/runtime.server.ts";
import type { CoreExecutionRequest } from "./contracts.ts";
import { runCoreExecution, type CoreExecutionDependencies } from "./service.ts";

class EmptyMemoryAdapter implements MemoryAdapter {
  readonly userId: string;
  private current: MemorySettings = { enabled: true, disabledTypes: [] };
  constructor(userId: string) {
    this.userId = userId;
  }
  async create(_draft: MemoryDraft): Promise<MemoryRecord> {
    throw new Error("EPHEMERAL_MEMORY_WRITE_DISABLED");
  }
  async get(_id: string) {
    return null;
  }
  async list(_query: MemoryQuery) {
    return [];
  }
  async update(_id: string, _patch: MemoryPatch) {
    return null;
  }
  async delete(_id: string) {}
  async settings() {
    return structuredClone(this.current);
  }
  async setSettings(settings: MemorySettings) {
    this.current = structuredClone(settings);
    return structuredClone(this.current);
  }
}

export function ephemeralServices(userId: string, projectId: string) {
  const now = new Date().toISOString();
  const memory = new MemoryService(new EmptyMemoryAdapter(userId));
  const brain = new ProjectBrainService(memory, {
    userId,
    async getAuthorizedProject(id) {
      return id === projectId
        ? { id, name: "XEOMX session", description: null, updatedAt: now }
        : null;
    },
    async recentConversations() {
      return [];
    },
    async authorizeConversation() {
      return false;
    },
  });
  const search = new GlobalSearchService([], {
    userId,
    async canReadProject(id) {
      return id === projectId;
    },
  });
  return { brain, search };
}

export function providerSignals(
  snapshot: Awaited<
    ReturnType<ReturnType<typeof createModelGatewayRuntime>["registry"]["snapshot"]>
  >,
): ProviderSignal[] {
  return snapshot.flatMap((provider) =>
    provider.models.map((model) => ({
      model: model.identity,
      capabilities: model.capabilities,
      enabled: provider.enabled,
      health:
        provider.health.availability === "AVAILABLE"
          ? ("healthy" as const)
          : provider.health.availability === "DEGRADED"
            ? ("degraded" as const)
            : ("unavailable" as const),
      latencyMs: model.estimatedLatencyMs,
      successRate: provider.health.availability === "AVAILABLE" ? 1 : 0,
      quality: model.quality,
      cost: {
        model: model.identity,
        currency: "USD",
        effectiveAt: provider.health.checkedAt,
      },
    })),
  );
}

export async function createCoreExecutionDependencies(input: {
  token: string;
  userId: string;
  request: CoreExecutionRequest;
  client?: SupabaseClient;
}): Promise<CoreExecutionDependencies> {
  const projectId = input.request.projectId ?? input.userId;
  const projects =
    input.request.projectId && input.client
      ? projectsForClient(input.userId, input.client)
      : undefined;
  const contextual = input.request.projectId
    ? {
        brain: projects?.brain ?? (await createProjectBrainService(input.token)),
        search: await createSearchService(input.token, {
          projectId,
          conversationId: input.request.conversationId,
        }),
      }
    : ephemeralServices(input.userId, projectId);
  const model = createModelGatewayRuntime();
  const registry = new AgentRegistry();
  for (const tool of createCanonicalTools({
    search: contextual.search,
    brain: contextual.brain,
    gateway: model.gateway,
  }))
    registry.registerTool(tool);
  for (const skill of canonicalSkills()) registry.registerSkill(skill);
  const enabledTools = registry.listTools().filter((tool) => tool.enabled);
  const enabledToolIds = new Set(enabledTools.map((tool) => tool.id));
  const inventory = {
    agents: DEFAULT_AGENTS.map((agent) => agent.definition).filter((agent) => agent.enabled),
    tools: enabledTools,
    skills: registry
      .listSkills()
      .filter((skill) => skill.enabled && skill.toolIds.every((id) => enabledToolIds.has(id))),
    providers: providerSignals(await model.registry.snapshot()),
    budget: { allowUnknown: true },
    allowedToolIds: enabledToolIds,
  };
  const orchestrator = new TaskOrchestrator({
    registry,
    approvals: new InMemoryApprovalStore(),
    brain: contextual.brain,
    gateway: model.gateway,
  });
  return {
    registry,
    inventory,
    projects,
    executeTask: (task, signal) => orchestrator.execute(task, { signal }),
  };
}

export async function executeCoreRequest(input: {
  token: string;
  userId: string;
  request: CoreExecutionRequest;
  signal?: AbortSignal;
  client?: SupabaseClient;
}) {
  const deps = await createCoreExecutionDependencies(input);
  return runCoreExecution(input.userId, input.request, deps, input.signal);
}
