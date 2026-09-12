import type { ModelGateway } from "../model-gateway/gateway.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import { defaultApprovalPolicy, type ApprovalStore } from "./approval.ts";
import type { DurableApprovalAuthority } from "./durable-approval.ts";
import type {
  AgentContext,
  AgentExecution,
  AgentRuntime,
  AgentTask,
  AgentTaskStatus,
  AgentTraceEvent,
  ToolResult,
} from "./contracts.ts";
import { AgentRegistry } from "./registry.ts";
import { DEFAULT_AGENTS, selectAgent } from "./runtimes.ts";

export interface OrchestratorLimits {
  maxSteps: number;
  maxToolCalls: number;
  maxRetries: number;
  maxContextCharacters: number;
  timeoutMs: number;
}
const DEFAULT_LIMITS: OrchestratorLimits = {
  maxSteps: 8,
  maxToolCalls: 8,
  maxRetries: 2,
  maxContextCharacters: 24_000,
  timeoutMs: 30_000,
};
const cleanError = (code: string, retryable = false) => ({ code, message: code, retryable });
export class TaskOrchestrator {
  private readonly agents = new Map(DEFAULT_AGENTS.map((a) => [a.definition.id, a]));
  private readonly limits: OrchestratorLimits;
  private readonly deps: {
    registry: AgentRegistry;
    approvals: ApprovalStore;
    durableApprovals?: DurableApprovalAuthority;
    brain: ProjectBrainService;
    gateway: ModelGateway;
    now?: () => string;
    id?: () => string;
  };
  constructor(
    deps: {
      registry: AgentRegistry;
      approvals: ApprovalStore;
      durableApprovals?: DurableApprovalAuthority;
      brain: ProjectBrainService;
      gateway: ModelGateway;
      now?: () => string;
      id?: () => string;
    },
    limits: Partial<OrchestratorLimits> = {},
  ) {
    this.deps = deps;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    if (
      this.limits.maxSteps < 1 ||
      this.limits.maxSteps > 20 ||
      this.limits.maxToolCalls < 1 ||
      this.limits.maxToolCalls > 20 ||
      this.limits.maxRetries < 0 ||
      this.limits.maxRetries > 5 ||
      this.limits.maxContextCharacters < 1000 ||
      this.limits.timeoutMs < 100
    )
      throw new Error("INVALID_ORCHESTRATOR_LIMITS");
  }
  registerAgent(agent: AgentRuntime) {
    if (this.agents.has(agent.definition.id)) throw new Error("DUPLICATE_AGENT");
    this.agents.set(agent.definition.id, agent);
  }
  private now() {
    return this.deps.now?.() ?? new Date().toISOString();
  }
  private id() {
    return this.deps.id?.() ?? crypto.randomUUID();
  }
  async execute(
    task: AgentTask,
    options: { signal?: AbortSignal; resumeApprovalId?: string } = {},
  ): Promise<AgentExecution> {
    const startedAt = this.now(),
      events: AgentTraceEvent[] = [],
      steps: AgentExecution["trace"]["steps"] extends readonly (infer T)[] ? T[] : never = [];
    let status: AgentTaskStatus = "queued",
      retries = 0;
    const event = (
      type: AgentTraceEvent["type"],
      metadata: AgentTraceEvent["metadata"],
      stepId?: string,
    ) =>
      events.push({ id: this.id(), at: this.now(), type, metadata, ...(stepId ? { stepId } : {}) });
    const setStatus = (next: AgentTaskStatus) => {
      status = next;
      event("status", { status: next });
    };
    const agent = task.requestedAgent
      ? this.agents.get(task.requestedAgent)
      : selectAgent(task.goal);
    const finish = (extra: Partial<AgentExecution>): AgentExecution => ({
      trace: {
        taskId: task.id,
        agentId: agent?.definition.id ?? "research",
        userId: task.userId,
        projectId: task.projectId,
        status,
        steps,
        events,
        retries,
        startedAt,
        ...(["completed", "failed", "cancelled"].includes(status)
          ? { completedAt: this.now() }
          : {}),
      },
      ...extra,
    });
    if (!agent?.definition.enabled) {
      setStatus("failed");
      return finish({ error: cleanError("AGENT_UNAVAILABLE") });
    }
    if (options.signal?.aborted) {
      setStatus("cancelled");
      return finish({ error: cleanError("CANCELLED") });
    }
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.limits.timeoutMs);
    options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      setStatus("planning");
      const snapshot = await this.deps.brain.snapshot(task.projectId, task.conversationId);
      const raw = [
        snapshot.summary.text,
        ...snapshot.instructions.map((x) => x.text),
        ...snapshot.decisions.map((x) => x.text),
        ...snapshot.constraints.map((x) => x.text),
        ...snapshot.memories.map((x) => x.content),
      ].join("\n");
      const bounded = raw.slice(0, this.limits.maxContextCharacters);
      const context: AgentContext = {
        task,
        projectSummary: snapshot.summary.text,
        instructions: snapshot.instructions.map((x) => x.text),
        decisions: snapshot.decisions.map((x) => x.text),
        constraints: snapshot.constraints.map((x) => x.text),
        memories: snapshot.memories.map((x) => ({ id: x.id, type: x.type, content: x.content })),
        maxCharacters: this.limits.maxContextCharacters,
        truncated: bounded.length < raw.length,
      };
      const plan = await agent.plan(context);
      if (plan.steps.length > this.limits.maxSteps) throw new Error("STEP_LIMIT_EXCEEDED");
      const outputs: ToolResult[] = [];
      let calls = 0;
      setStatus("running");
      for (const planned of plan.steps) {
        if (controller.signal.aborted) {
          setStatus(options.signal?.aborted ? "cancelled" : "failed");
          return finish({
            error: cleanError(options.signal?.aborted ? "CANCELLED" : "DEADLINE_EXCEEDED"),
          });
        }
        if (++calls > this.limits.maxToolCalls) throw new Error("TOOL_CALL_LIMIT_EXCEEDED");
        const tool = planned.toolId ? this.deps.registry.tool(planned.toolId) : undefined;
        if (!tool) throw new Error("TOOL_NOT_FOUND");
        const approvalRequired = defaultApprovalPolicy.requiresApproval(tool.risk),
          approvalId = `${task.id}:${planned.id}:${tool.id}`;
        let approved = false;
        if (approvalRequired && options.resumeApprovalId) {
          if (!this.deps.durableApprovals) throw new Error("DURABLE_APPROVAL_REQUIRED");
          await this.deps.durableApprovals.authorizeContinuation({
            approvalId: options.resumeApprovalId,
            taskId: task.id,
            executionId: task.id,
            stepId: planned.id,
            toolId: tool.id,
            projectId: task.projectId,
          });
          approved = true;
          event(
            "approval",
            { approvalId: options.resumeApprovalId, decision: "approved" },
            planned.id,
          );
        }
        if (approvalRequired && !approved) {
          if (this.deps.durableApprovals) {
            await this.deps.durableApprovals.request({
              id: approvalId,
              taskId: task.id,
              executionId: task.id,
              stepId: planned.id,
              toolId: tool.id,
              risk: tool.risk,
              requestedBy: task.userId,
              projectId: task.projectId,
            });
          } else
            await this.deps.approvals.create({
              id: approvalId,
              taskId: task.id,
              stepId: planned.id,
              toolId: tool.id,
              risk: tool.risk,
              requestedBy: task.userId,
              projectId: task.projectId,
              status: "pending",
              createdAt: this.now(),
            });
          steps.push({ id: planned.id, toolId: tool.id, status: "waiting_approval" });
          event("approval", { approvalId, risk: tool.risk }, planned.id);
          setStatus("waiting_approval");
          return finish({});
        }
        const step = {
          id: planned.id,
          toolId: tool.id,
          status: "running" as const,
          startedAt: this.now(),
        };
        steps.push(step);
        event("tool", { toolId: tool.id, risk: tool.risk }, planned.id);
        let output: ToolResult = { ok: false, error: cleanError("TOOL_EXECUTION_FAILED") };
        do {
          output = await this.deps.registry.invoke(
            { id: tool.id, taskId: task.id, stepId: planned.id, input: planned.input },
            {
              policy: defaultApprovalPolicy,
              approved: !approvalRequired || approved,
              signal: controller.signal,
            },
          );
          if (output.ok || !output.error?.retryable) break;
          retries++;
        } while (retries <= this.limits.maxRetries);
        outputs.push(output);
        Object.assign(step, {
          status: output.ok ? "completed" : "failed",
          completedAt: this.now(),
          ...(output.error ? { error: output.error } : {}),
        });
        if (!output.ok) {
          setStatus("failed");
          return finish({ error: output.error });
        }
      }
      const result = await agent.finish(context, outputs);
      setStatus("completed");
      return finish({ result });
    } catch (error) {
      setStatus(controller.signal.aborted && options.signal?.aborted ? "cancelled" : "failed");
      return finish({
        error: cleanError(
          error instanceof Error &&
            ["STEP_LIMIT_EXCEEDED", "TOOL_CALL_LIMIT_EXCEEDED"].includes(error.message)
            ? error.message
            : "ORCHESTRATION_FAILED",
        ),
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
