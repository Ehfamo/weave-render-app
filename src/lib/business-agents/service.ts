import type { TaskOrchestrator } from "../agents/orchestrator.ts";
import type { AgentExecution } from "../agents/contracts.ts";
import type {
  BusinessArtifact,
  BusinessRunContext,
  BusinessRunResult,
  HumanReviewAction,
} from "./contracts.ts";
import { BusinessPackRegistry, defaultHumanReviewPolicy } from "./registry.ts";
import { createBusinessAgentRuntime } from "./runtime.ts";

export interface BusinessAuthorization {
  canUse(projectId: string, userId: string): Promise<boolean>;
}
export class BusinessAgentService {
  private readonly registered = new Set<string>();
  private readonly orchestrator: TaskOrchestrator;
  private readonly packs: BusinessPackRegistry;
  private readonly authorization: BusinessAuthorization;
  constructor(
    orchestrator: TaskOrchestrator,
    packs: BusinessPackRegistry,
    authorization: BusinessAuthorization,
  ) {
    this.orchestrator = orchestrator;
    this.packs = packs;
    this.authorization = authorization;
  }
  async run(
    context: BusinessRunContext,
    requestedAction?: HumanReviewAction,
  ): Promise<BusinessRunResult> {
    if (!(await this.authorization.canUse(context.projectId, context.userId)))
      throw Error("PROJECT_ACCESS_DENIED");
    const definition = this.packs.agent(context.projectId, context.agentId);
    if (!definition) throw Error("BUSINESS_AGENT_DISABLED");
    const runtimeId = `business.${definition.id}` as const;
    if (!this.registered.has(runtimeId)) {
      this.orchestrator.registerAgent(createBusinessAgentRuntime(definition));
      this.registered.add(runtimeId);
    }
    const execution: AgentExecution = await this.orchestrator.execute({
      id: context.taskId,
      userId: context.userId,
      projectId: context.projectId,
      goal: context.goal,
      requestedAgent: runtimeId,
      routingMode: context.routingMode,
      createdAt: new Date().toISOString(),
    });
    const requiresReview = requestedAction
      ? defaultHumanReviewPolicy.requiresReview(requestedAction)
      : false;
    const sources = (execution.result?.sources ?? []).map((x) => ({
      ...x,
      provenance: x.provenance,
    }));
    const artifact: BusinessArtifact = {
      id: `${context.id}:artifact`,
      type: artifactType(definition.pack),
      title: definition.name,
      data: execution.result?.data ?? {},
      sources,
      review: requiresReview ? "waiting_approval" : "not_required",
    };
    return {
      runId: context.id,
      taskId: context.taskId,
      projectId: context.projectId,
      pack: definition.pack,
      agentId: definition.id,
      status: requiresReview ? "waiting_approval" : execution.trace.status,
      artifacts: [artifact],
      sources,
      toolUsage: execution.trace.steps.flatMap((x) => (x.toolId ? [x.toolId] : [])),
      modelRoute: execution.trace.events.find((x) => x.type === "model")?.metadata.route as
        string | undefined,
      approvalStatus: requiresReview ? "waiting_approval" : "not_required",
      startedAt: execution.trace.startedAt,
      completedAt: execution.trace.completedAt,
      execution,
    };
  }
}
function artifactType(pack: string): BusinessArtifact["type"] {
  return pack === "research"
    ? "research"
    : pack === "marketing"
      ? "campaign"
      : pack === "sales"
        ? "lead-list"
        : pack === "support"
          ? "support-draft"
          : "analysis";
}
