import "@tanstack/react-start/server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AutomationExecution, AutomationWorkflow } from "./contracts.ts";
import type { AutomationStore } from "./service.ts";
import type {
  ActivityEntry,
  Assignment,
  CollaborationComment,
  TeamMember,
} from "../collaboration/contracts.ts";
import type { CollaborationStore } from "../collaboration/service.ts";

type Row = Record<string, unknown>;
const fail = (error: unknown) => {
  if (error) throw new Error("P4_DATABASE_FAILED");
};
async function authenticated(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("P4_AUTH_REQUIRED");
  return data.user;
}
const role = (value: unknown) =>
  value === "owner" || value === "editor" || value === "viewer" ? value : null;

export class SupabaseP4Store implements AutomationStore, CollaborationStore {
  readonly actorId: string;
  private client: SupabaseClient;
  private constructor(client: SupabaseClient, user: User) {
    this.client = client;
    this.actorId = user.id;
  }
  static async create(client: SupabaseClient) {
    return new SupabaseP4Store(client, await authenticated(client));
  }
  async role(projectId: string) {
    const { data, error } = await this.client
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", this.actorId)
      .maybeSingle();
    fail(error);
    return role(data?.role);
  }
  async member(projectId: string, userId: string): Promise<TeamMember | null> {
    const { data, error } = await this.client
      .from("project_members")
      .select("user_id,project_id,role,created_at")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    fail(error);
    return data
      ? {
          userId: data.user_id,
          projectId: data.project_id,
          role: role(data.role) ?? "viewer",
          joinedAt: data.created_at,
        }
      : null;
  }
  async saveWorkflow(v: AutomationWorkflow) {
    if (v.ownerId !== this.actorId) throw Error("AUTOMATION_FORBIDDEN");
    const { error } = await this.client.from("workflow_definitions").upsert({
      id: v.id,
      project_id: v.projectId,
      owner_id: this.actorId,
      name: v.name,
      status: v.status === "enabled" ? "active" : "disabled",
    });
    fail(error);
    const { error: e } = await this.client.from("workflow_versions").upsert({
      workflow_id: v.id,
      created_by: this.actorId,
      version: v.version,
      max_risk_tier: "R2",
      definition: v,
    });
    fail(e);
  }
  async workflow(id: string): Promise<AutomationWorkflow | null> {
    const { data, error } = await this.client
      .from("workflow_versions")
      .select("definition")
      .eq("workflow_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    fail(error);
    return (data?.definition as AutomationWorkflow) ?? null;
  }
  async workflows(projectId: string) {
    const { data, error } = await this.client
      .from("workflow_definitions")
      .select("id,workflow_versions(definition,version)")
      .eq("project_id", projectId);
    fail(error);
    return (data ?? []).flatMap((x: Row) => {
      const versions = x.workflow_versions as Row[] | undefined;
      return versions?.length
        ? [
            versions.sort((a, b) => Number(b.version) - Number(a.version))[0]
              .definition as AutomationWorkflow,
          ]
        : [];
    });
  }
  async saveExecution(v: AutomationExecution) {
    const existing = await this.execution(v.id);
    if (existing) {
      const { error } = await this.client
        .from("controlled_runs")
        .update({
          state: v.status === "completed" ? "succeeded" : v.status,
          result: { canonicalExecution: v },
        })
        .contains("input", { executionId: v.id });
      fail(error);
      return;
    }
    const { data: version, error: ve } = await this.client
      .from("workflow_versions")
      .select("id")
      .eq("workflow_id", v.workflowId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    fail(ve);
    if (!version) throw new Error("P4_DATABASE_FAILED");
    const { error } = await this.client.from("controlled_runs").insert({
      project_id: v.projectId,
      requested_by: this.actorId,
      subject_type: "workflow",
      workflow_version_id: version.id,
      risk_tier: v.status === "waiting_approval" ? "R2" : "R0",
      action_key: "workflow.execute",
      input: { executionId: v.id, eventId: v.eventId, correlationId: v.correlationId },
      credential_refs: [],
      state:
        v.status === "waiting_approval"
          ? "awaiting_approval"
          : v.status === "completed"
            ? "succeeded"
            : v.status,
      approval_required: v.status === "waiting_approval",
      idempotency_key: `p4:${v.workflowId}:${v.eventId}`,
      request_hash: "0".repeat(64),
      result: { canonicalExecution: v },
    });
    fail(error);
  }
  async execution(id: string) {
    const { data, error } = await this.client
      .from("controlled_runs")
      .select("result")
      .contains("input", { executionId: id })
      .maybeSingle();
    fail(error);
    return ((data?.result as Row | undefined)?.canonicalExecution as AutomationExecution) ?? null;
  }
  async executions(workflowId: string) {
    const { data, error } = await this.client
      .from("controlled_runs")
      .select("result,workflow_versions!inner(workflow_id)")
      .eq("workflow_versions.workflow_id", workflowId)
      .order("created_at", { ascending: false })
      .limit(100);
    fail(error);
    return (data ?? []).map(
      (x: Row) => (x.result as Row).canonicalExecution as AutomationExecution,
    );
  }
  async seenEvent(workflowId: string, eventId: string) {
    const { count, error } = await this.client
      .from("automation_events")
      .select("id", { count: "exact", head: true })
      .eq("workflow_id", workflowId)
      .eq("event_key", eventId);
    fail(error);
    return Boolean(count);
  }
  async saveAssignment(v: Assignment) {
    if (v.creatorId !== this.actorId) throw Error("COLLABORATION_FORBIDDEN");
    const { error } = await this.client.from("project_assignments").upsert({
      id: v.id,
      project_id: v.projectId,
      creator_id: this.actorId,
      assignee_type: v.assigneeType,
      assignee_user_id: v.assigneeType === "human" ? v.assigneeId : null,
      assignee_agent_key: v.assigneeType === "agent" ? v.assigneeId : null,
      description: v.description,
      priority: v.priority,
      status: v.status,
      result_reference: v.resultReference,
      due_at: v.dueAt,
    });
    fail(error);
  }
  async assignments(projectId: string) {
    const { data, error } = await this.client
      .from("project_assignments")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(100);
    fail(error);
    return (data ?? []).map(
      (x: Row) =>
        ({
          id: x.id,
          projectId: x.project_id,
          creatorId: x.creator_id,
          assigneeId: x.assignee_user_id ?? x.assignee_agent_key,
          assigneeType: x.assignee_type,
          description: x.description,
          priority: x.priority,
          status: x.status,
          requiredApproval: x.status === "waiting_approval",
          resultReference: x.result_reference,
          dueAt: x.due_at,
          createdAt: x.created_at,
          updatedAt: x.updated_at,
        }) as Assignment,
    );
  }
  async appendActivity(v: ActivityEntry) {
    if (v.actorId !== this.actorId) throw Error("COLLABORATION_FORBIDDEN");
    const { error } = await this.client.from("project_collaboration_activity").insert({
      id: v.id,
      project_id: v.projectId,
      actor_id: this.actorId,
      kind: v.kind,
      subject_id: v.subjectId,
      summary: v.summary,
      trace_id: v.traceId,
    });
    fail(error);
  }
  async activity(projectId: string) {
    const { data, error } = await this.client
      .from("project_collaboration_activity")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);
    fail(error);
    return (data ?? []).map(
      (x: Row) =>
        ({
          id: x.id,
          projectId: x.project_id,
          actorId: x.actor_id,
          kind: x.kind,
          subjectId: x.subject_id,
          summary: x.summary,
          traceId: x.trace_id,
          createdAt: x.created_at,
        }) as ActivityEntry,
    );
  }
  async saveComment(v: CollaborationComment) {
    if (v.authorId !== this.actorId) throw Error("COLLABORATION_FORBIDDEN");
    const { error } = await this.client.from("project_collaboration_comments").insert({
      id: v.id,
      project_id: v.projectId,
      author_id: this.actorId,
      subject_id: v.subjectId,
      body: v.body,
    });
    fail(error);
  }
}
