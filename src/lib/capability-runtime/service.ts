import type { AgentExecution } from "../agents/contracts.ts";
import type { TaskOrchestrator } from "../agents/orchestrator.ts";
import type { BusinessAgentService } from "../business-agents/service.ts";
import type { RuntimeRequest, RuntimeStore } from "./contracts.ts";
import { uuid } from "../memory/service.ts";
import { generateEvaluateRepair } from "../intelligence/quality.ts";

/** Durable lifecycle around the existing orchestrator. No model/tool execution engine here. */
export class RuntimeJobService {
  readonly store: RuntimeStore;
  private orchestrator: TaskOrchestrator;
  private business: BusinessAgentService;
  constructor(store: RuntimeStore, orchestrator: TaskOrchestrator, business: BusinessAgentService) {
    this.store = store;
    this.orchestrator = orchestrator;
    this.business = business;
  }
  async submit(request: RuntimeRequest) {
    uuid(request.task.id);
    uuid(request.task.projectId);
    if (
      request.task.userId !== this.store.actorId ||
      !request.task.goal.trim() ||
      request.task.goal.length > 20000 ||
      request.idempotencyKey.length < 16 ||
      request.idempotencyKey.length > 200
    )
      throw Error("INVALID_RUNTIME_REQUEST");
    await this.store.authorize(request.task.projectId, true);
    return this.store.submit(request);
  }
  async run(id: string, signal?: AbortSignal) {
    const existing = await this.store.get(uuid(id));
    await this.store.authorize(existing.projectId, true);
    if (existing.userId !== this.store.actorId) throw Error("RUNTIME_ACCESS_DENIED");
    const lease = crypto.randomUUID();
    const job = await this.store.claim(id, lease);
    if (!job) return this.store.get(id);
    const options = {
      signal,
      resumeApprovalId: job.resumeApprovalId,
      checkpoint: {
        load: async () => job.checkpoint ?? null,
        save: (value: NonNullable<typeof job.checkpoint>) =>
          this.store.checkpoint(id, lease, value),
        cancelled: async () => (await this.store.get(id)).state === "cancelled",
      },
    };
    let execution: AgentExecution;
    try {
      execution =
        job.request.capability.kind === "business"
          ? (
              await this.business.run(
                {
                  id,
                  taskId: id,
                  userId: job.userId,
                  projectId: job.projectId,
                  goal: job.request.task.goal,
                  agentId: job.request.capability.agentId,
                  routingMode: job.request.task.routingMode,
                },
                undefined,
                options,
              )
            ).execution
          : await this.orchestrator.execute(job.request.task, options);
      if (execution.result && execution.trace.status === "completed") {
        const quality = await generateEvaluateRepair({
          vertical: job.request.capability.kind === "creative" ? "CREATIVE" : "BUSINESS",
          generate: async () => execution.result!.summary,
          evaluators: [],
          repair: async (value) => value,
          policy: {
            maxRepairAttempts: 0,
            maxCostMinor: 0,
            repairCostMinor: 0,
            timeoutMs: 30000,
            qualityThresholdRequired: false,
          },
          signal,
        });
        execution.result = {
          ...execution.result,
          data: {
            output: execution.result.data ?? null,
            quality: {
              confidence: quality.confidence,
              repairCount: quality.repairCount,
              findings: quality.findings.map((f) => ({
                evaluatorId: f.evaluatorId,
                status: f.status,
                code: f.code,
              })),
            },
          },
        };
      }
    } catch {
      execution = {
        trace: {
          taskId: id,
          userId: job.userId,
          projectId: job.projectId,
          agentId: job.request.task.requestedAgent ?? "research",
          status: signal?.aborted ? "cancelled" : "failed",
          steps: [],
          events: [],
          retries: 0,
          startedAt: job.createdAt,
        },
        error: { code: "RUNTIME_FAILED", message: "RUNTIME_FAILED", retryable: false },
      };
    }
    return this.store.finish(id, lease, execution);
  }
}
