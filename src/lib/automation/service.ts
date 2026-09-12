import type {
  AutomationAction,
  AutomationEvent,
  AutomationExecution,
  AutomationResult,
  AutomationWorkflow,
} from "./contracts.ts";
import type { DurableApprovalAuthority } from "../agents/durable-approval.ts";
export interface AutomationStore {
  actorId: string;
  role(projectId: string): Promise<"owner" | "admin" | "editor" | "viewer" | null>;
  saveWorkflow(v: AutomationWorkflow): Promise<void>;
  workflow(id: string): Promise<AutomationWorkflow | null>;
  workflows(projectId: string): Promise<AutomationWorkflow[]>;
  saveExecution(v: AutomationExecution): Promise<void>;
  executions(workflowId: string): Promise<AutomationExecution[]>;
  execution?(id: string): Promise<AutomationExecution | null>;
  seenEvent(workflowId: string, eventId: string): Promise<boolean>;
}
export class AutomationService {
  private store: AutomationStore;
  private actions: Map<string, AutomationAction>;
  private now: () => string;
  private approvals?: DurableApprovalAuthority;
  constructor(
    store: AutomationStore,
    actions: AutomationAction[],
    now = () => new Date().toISOString(),
    approvals?: DurableApprovalAuthority,
  ) {
    this.store = store;
    this.actions = new Map(actions.map((a) => [a.id, a]));
    this.now = now;
    this.approvals = approvals;
  }
  private async auth(projectId: string, write = true) {
    const role = await this.store.role(projectId);
    if (!role || (role === "viewer" && write)) throw Error("AUTOMATION_FORBIDDEN");
  }
  validate(w: AutomationWorkflow) {
    if (
      !w.name.trim() ||
      w.steps.length < 1 ||
      w.steps.length > 12 ||
      new Set(w.steps.map((s) => s.id)).size !== w.steps.length ||
      w.steps.some((s, i) => s.order !== i || !this.actions.has(s.actionId) || (s.retries ?? 0) > 2)
    )
      throw Error("INVALID_WORKFLOW");
    return w;
  }
  async create(w: AutomationWorkflow) {
    await this.auth(w.projectId);
    if (w.ownerId !== this.store.actorId) throw Error("AUTOMATION_FORBIDDEN");
    this.validate(w);
    await this.store.saveWorkflow(w);
    return w;
  }
  async setEnabled(id: string, enabled: boolean) {
    const w = await this.need(id);
    w.status = enabled ? "enabled" : "disabled";
    w.updatedAt = this.now();
    await this.store.saveWorkflow(w);
    return w;
  }
  private async need(id: string) {
    const w = await this.store.workflow(id);
    if (!w) throw Error("WORKFLOW_NOT_FOUND");
    await this.auth(w.projectId);
    return structuredClone(w);
  }
  async trigger(
    id: string,
    event: AutomationEvent,
    signal?: AbortSignal,
  ): Promise<AutomationResult> {
    const w = await this.need(id);
    if (w.status !== "enabled") throw Error("WORKFLOW_DISABLED");
    if (event.projectId !== w.projectId || event.sourceWorkflowId === w.id)
      throw Error("AUTOMATION_RECURSION");
    if (await this.store.seenEvent(w.id, event.id)) throw Error("DUPLICATE_EVENT");
    const x: AutomationExecution = {
        id: `${w.id}:${event.id}`,
        workflowId: w.id,
        projectId: w.projectId,
        eventId: event.id,
        correlationId: event.correlationId,
        status: "running",
        completedStepIds: [],
        createdAt: this.now(),
        updatedAt: this.now(),
      },
      outputs = [];
    await this.store.saveExecution(x);
    for (const step of [...w.steps].sort((a, b) => a.order - b.order)) {
      if (signal?.aborted) {
        x.status = "cancelled";
        break;
      }
      const a = this.actions.get(step.actionId)!;
      if (step.requiresApproval || a.risk !== "SAFE_READ") {
        x.status = "waiting_approval";
        x.approvalId = `${x.id}:${step.id}`;
        await this.approvals?.request({
          id: x.approvalId,
          taskId: w.id,
          executionId: x.id,
          stepId: step.id,
          toolId: a.id,
          risk: a.risk,
          requestedBy: this.store.actorId,
          projectId: w.projectId,
        });
        break;
      }
      let attempts = 0;
      while (true)
        try {
          outputs.push(await a.execute(step.input, signal));
          break;
        } catch {
          if (attempts++ >= (step.retries ?? 0)) {
            x.status = "failed";
            x.errorCode = "ACTION_FAILED";
            break;
          }
        }
      if (x.status === "failed") break;
      x.completedStepIds.push(step.id);
    }
    if (x.status === "running") x.status = "completed";
    x.updatedAt = this.now();
    await this.store.saveExecution(x);
    return { execution: x, outputs };
  }
  async manual(id: string, event: AutomationEvent, signal?: AbortSignal) {
    if (event.kind !== "manual") throw Error("INVALID_TRIGGER");
    return this.trigger(id, event, signal);
  }
  async history(id: string) {
    const w = await this.need(id);
    return this.store.executions(w.id);
  }
  async resume(executionId: string, approvalId: string, signal?: AbortSignal) {
    if (!this.store.execution || !this.approvals) throw Error("DURABLE_RESUME_UNAVAILABLE");
    const x = await this.store.execution(executionId);
    if (!x || x.status !== "waiting_approval" || x.approvalId !== approvalId)
      throw Error("EXECUTION_NOT_RESUMABLE");
    const w = await this.need(x.workflowId),
      step = [...w.steps]
        .sort((a, b) => a.order - b.order)
        .find((s) => !x.completedStepIds.includes(s.id));
    if (!step) throw Error("STEP_NOT_FOUND");
    const action = this.actions.get(step.actionId)!;
    await this.approvals.authorizeContinuation({
      approvalId,
      taskId: w.id,
      executionId: x.id,
      stepId: step.id,
      toolId: action.id,
      projectId: w.projectId,
    });
    const output = await action.execute(step.input, signal);
    x.completedStepIds.push(step.id);
    x.status = "completed";
    x.updatedAt = this.now();
    await this.store.saveExecution(x);
    return { execution: x, outputs: [output] };
  }
}
