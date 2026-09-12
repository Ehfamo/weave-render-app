import type { ApprovalDecision, ApprovalRequest } from "./contracts.ts";

export type DurableTaskState =
  "waiting_approval" | "queued" | "running" | "completed" | "failed" | "cancelled";
export interface DurableApprovalRecord extends ApprovalRequest {
  executionId: string;
  expiresAt?: string;
  consumedAt?: string;
}
/** Server-bound adapter. Implementations use caller-authenticated RLS for decisions and a
 * service transaction for consume; clients never provide authorization facts. */
export interface DurableApprovalAdapter {
  createExact(input: DurableApprovalRecord): Promise<DurableApprovalRecord>;
  decideExact(
    input: ApprovalDecision,
    actor: { userId: string; projectId: string },
  ): Promise<DurableApprovalRecord>;
  consumeApproved(input: {
    approvalId: string;
    taskId: string;
    executionId: string;
    stepId: string;
    toolId: string;
    projectId: string;
    now: string;
  }): Promise<DurableApprovalRecord | null>;
  taskState(taskId: string, executionId: string): Promise<DurableTaskState | null>;
}

export class DurableApprovalAuthority {
  private readonly adapter: DurableApprovalAdapter;
  private readonly now: () => string;
  constructor(adapter: DurableApprovalAdapter, now = () => new Date().toISOString()) {
    this.adapter = adapter;
    this.now = now;
  }
  async request(input: Omit<DurableApprovalRecord, "status" | "createdAt">) {
    return this.adapter.createExact({ ...input, status: "pending", createdAt: this.now() });
  }
  async decide(decision: ApprovalDecision, actor: { userId: string; projectId: string }) {
    if (decision.decidedBy !== actor.userId) throw new Error("APPROVAL_ACTOR_MISMATCH");
    return this.adapter.decideExact(decision, actor);
  }
  async authorizeContinuation(
    input: Omit<Parameters<DurableApprovalAdapter["consumeApproved"]>[0], "now">,
  ) {
    const state = await this.adapter.taskState(input.taskId, input.executionId);
    if (state !== "queued")
      throw new Error(state === "cancelled" ? "TASK_CANCELLED" : "TASK_NOT_RESUMABLE");
    const approval = await this.adapter.consumeApproved({ ...input, now: this.now() });
    if (!approval) throw new Error("APPROVAL_INVALID_EXPIRED_OR_CONSUMED");
    return approval;
  }
}
