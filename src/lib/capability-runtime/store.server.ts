import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentCheckpoint, AgentExecution } from "../agents/contracts.ts";
import type { DurableApprovalAdapter, DurableTaskState } from "../agents/durable-approval.ts";
import type { RuntimeArtifact, RuntimeJob, RuntimeRequest, RuntimeStore } from "./contracts.ts";

interface Row {
  id: string;
  project_id: string;
  requested_by: string;
  state: string;
  created_at: string;
  updated_at: string;
  attempt_count: number;
  failure_code?: string;
  runtime_data: {
    request: RuntimeRequest;
    checkpoint?: AgentCheckpoint;
    lease?: string;
    approvalId?: string;
    resumeApprovalId?: string;
    artifactIds?: string[];
  };
}
export async function database<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const r = await request;
  if (r.error) throw Error("RUNTIME_STORAGE_ERROR");
  return r.data;
}
export function runtimeRow(r: Row): RuntimeJob {
  const x = r.runtime_data;
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.requested_by,
    request: x.request,
    state: ((
      {
        succeeded: "completed",
        awaiting_approval: "waiting_approval",
        denied: "cancelled",
        unavailable: "failed",
      } as const
    )[r.state as "succeeded"] ?? r.state) as RuntimeJob["state"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    attempt: r.attempt_count,
    checkpoint: x.checkpoint,
    lease: x.lease,
    approvalId: x.approvalId,
    resumeApprovalId: x.resumeApprovalId,
    artifactIds: x.artifactIds ?? [],
    errorCode: r.failure_code ?? undefined,
  };
}
export class SupabaseRuntimeStore implements RuntimeStore {
  readonly actorId: string;
  readonly client: SupabaseClient;
  private admin: SupabaseClient;
  constructor(actorId: string, client: SupabaseClient, admin: SupabaseClient) {
    this.actorId = actorId;
    this.client = client;
    this.admin = admin;
  }
  async authorize(projectId: string, write = false) {
    const role = await database(this.client.rpc("xeomx_project_role", { p_project_id: projectId }));
    if (!(write ? ["owner", "editor"] : ["owner", "editor", "viewer"]).includes(role))
      throw Error("RUNTIME_ACCESS_DENIED");
  }
  async command(action: string, id: string, data: unknown = {}) {
    return database(
      this.admin.rpc("xeomx_runtime_command", {
        p_actor: this.actorId,
        p_action: action,
        p_id: id,
        p_data: data,
      }),
    ) as Promise<Row | null>;
  }
  async submit(request: RuntimeRequest) {
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          projectId: request.task.projectId,
          conversationId: request.task.conversationId,
          goal: request.task.goal,
          capability: request.capability,
          mode: request.task.routingMode,
        }),
      )
      .digest("hex");
    return runtimeRow((await this.command("submit", request.task.id, { request, hash }))!);
  }
  async get(id: string) {
    const row = await database(
      this.client
        .from("controlled_runs")
        .select("*")
        .eq("id", id)
        .not("runtime_data", "is", null)
        .maybeSingle(),
    );
    if (!row || row.requested_by !== this.actorId) throw Error("RUNTIME_ACCESS_DENIED");
    await this.authorize(row.project_id);
    return runtimeRow(row);
  }
  async list(projectId: string) {
    await this.authorize(projectId);
    const rows = await database(
      this.client
        .from("controlled_runs")
        .select("*")
        .eq("project_id", projectId)
        .eq("requested_by", this.actorId)
        .not("runtime_data", "is", null)
        .order("created_at", { ascending: false })
        .limit(30),
    );
    return (rows ?? []).map(runtimeRow);
  }
  async claim(id: string, lease: string) {
    const row = await this.command("claim", id, { lease });
    return row ? runtimeRow(row) : null;
  }
  async checkpoint(id: string, lease: string, checkpoint: AgentCheckpoint) {
    await this.command("checkpoint", id, { lease, checkpoint });
  }
  async finish(id: string, lease: string, execution: AgentExecution) {
    return runtimeRow((await this.command("finish", id, { lease, execution }))!);
  }
  async cancel(id: string) {
    return runtimeRow((await this.command("cancel", id))!);
  }
  async retry(id: string) {
    return runtimeRow((await this.command("retry", id))!);
  }
  async artifacts(projectId: string): Promise<RuntimeArtifact[]> {
    await this.authorize(projectId);
    const rows = await database(
      this.client
        .from("assets")
        .select("*")
        .eq("project_id", projectId)
        .eq("owner_id", this.actorId)
        .not("controlled_run_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50),
    );
    return (rows ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      ownerId: r.owner_id,
      jobId: r.controlled_run_id,
      type: r.kind,
      title: r.metadata.title,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      text: r.metadata.text,
      url: r.metadata.output?.url,
      mimeType: r.mime_type,
      provenance: r.metadata.provenance,
      provider: r.metadata.output?.provider,
      model: r.metadata.output?.model,
    }));
  }
  approvals(): DurableApprovalAdapter {
    return {
      createExact: async (input) =>
        (await this.command("request_approval", input.executionId, input)) as never,
      decideExact: async (decision, actor) => {
        if (actor.userId !== this.actorId) throw Error("APPROVAL_ACTOR_MISMATCH");
        const row = await database(
          this.client
            .from("approval_requests")
            .select("run_id,project_id,runtime_record")
            .eq("runtime_key", decision.requestId)
            .single(),
        );
        if (!row || row.project_id !== actor.projectId) throw Error("APPROVAL_SCOPE_MISMATCH");
        await this.command("decide", row.run_id, {
          approvalId: decision.requestId,
          decision: decision.decision,
          reason: decision.reason,
        });
        return { ...row.runtime_record, status: decision.decision, decidedBy: this.actorId };
      },
      consumeApproved: async (input) =>
        (await this.command("consume", input.executionId, input)) as never,
      taskState: async (taskId, executionId) => {
        if (taskId !== executionId) return null;
        return (await this.get(executionId)).state as DurableTaskState;
      },
    };
  }
}
