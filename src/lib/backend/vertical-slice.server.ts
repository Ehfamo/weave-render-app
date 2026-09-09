import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetSummary,
  ConversationSummary,
  CreditLedgerEntrySummary,
  GenerationJobSummary,
  GenerationExecutionResult,
  GenerationSubmissionInput,
  ProjectAuditEvent,
  ProjectMessage,
  ProjectSnapshot,
  ProjectSummary,
  UsageEventSummary,
  VerticalSliceErrorCode,
  VerticalSliceRoutingMode,
} from "@/lib/backend/vertical-slice";
import {
  REQUEST_7_LIVE_TEXT_PROVIDER,
  VerticalSliceError,
  safeVerticalSliceError,
} from "@/lib/backend/vertical-slice";
import type {
  Request7AssetRow,
  Request7AuditEventRow,
  Request7ConversationRow,
  Request7CreditLedgerRow,
  Request7Database,
  Request7GenerationJobRow,
  Request7MessageRow,
  Request7ProjectRow,
  Request7UsageEventRow,
} from "@/lib/backend/vertical-slice.database";

type Request7Client = SupabaseClient<Request7Database>;
type ProjectSummaryRow = Omit<Request7ProjectRow, "owner_id">;

function request7Client(client: unknown): Request7Client {
  return client as Request7Client;
}

function projectSummary(row: ProjectSummaryRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    defaultRoutingMode: row.default_routing_mode,
    defaultModel: row.default_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function conversationSummary(row: Request7ConversationRow): ConversationSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    routingMode: row.routing_mode,
    selectedProvider: row.selected_provider,
    selectedModel: row.selected_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messageSummary(row: Request7MessageRow): ProjectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    generationJobId: row.generation_job_id,
    createdAt: row.created_at,
  };
}

const VERTICAL_ERROR_SET = new Set<string>([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "PROJECT_NOT_FOUND",
  "CONVERSATION_NOT_FOUND",
  "JOB_NOT_FOUND",
  "INSUFFICIENT_CREDITS",
  "PROVIDER_UNAVAILABLE",
  "MODEL_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "GENERATION_FAILED",
  "STORAGE_FAILED",
  "DATABASE_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "VALIDATION_FAILED",
]);

function jobErrorCode(value: string | null): VerticalSliceErrorCode | null {
  return value && VERTICAL_ERROR_SET.has(value)
    ? (value as VerticalSliceErrorCode)
    : value
      ? "GENERATION_FAILED"
      : null;
}

function jobSummary(row: Request7GenerationJobRow): GenerationJobSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    status: row.status,
    routingMode: row.routing_mode,
    selectedProvider: row.selected_provider,
    selectedModel: row.selected_model,
    errorCode: jobErrorCode(row.error_category),
    errorMessage: row.error_message,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function assetSummary(row: Request7AssetRow): AssetSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    generationJobId: row.generation_job_id,
    kind: row.kind,
    mimeType: row.mime_type,
    status: row.status,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

function auditSummary(row: Request7AuditEventRow): ProjectAuditEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    result: row.result,
    jobId: row.job_id,
    errorCategory: row.error_category,
    createdAt: row.created_at,
  };
}

function usageSummary(row: Request7UsageEventRow): UsageEventSummary {
  return {
    id: row.id,
    jobId: row.job_id,
    provider: row.provider,
    model: row.model,
    inputUnits: row.input_units,
    outputUnits: row.output_units,
    usageUnavailable: row.usage_unavailable,
    createdAt: row.created_at,
  };
}

function creditSummary(row: Request7CreditLedgerRow): CreditLedgerEntrySummary {
  return {
    id: row.id,
    jobId: row.job_id,
    delta: row.delta,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function throwDatabaseError(error: { message: string } | null): never {
  throw safeVerticalSliceError(error ? new Error(error.message) : new Error("DATABASE_FAILED"));
}

function firstRow<T>(value: T[] | null, error: { message: string } | null): T {
  if (error || !value?.[0]) throwDatabaseError(error);
  return value[0];
}

export async function listProjects(client: unknown): Promise<ProjectSummary[]> {
  const { data, error } = await request7Client(client)
    .from("projects")
    .select(
      "id,owner_id,name,description,status,default_routing_mode,default_model,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throwDatabaseError(error);
  return (data ?? []).map(projectSummary);
}

export async function createProject(
  client: unknown,
  input: { name: string; description?: string },
): Promise<ProjectSummary> {
  const { data, error } = await request7Client(client).rpc("xeomx_create_project", {
    p_name: input.name,
    p_description: input.description || null,
  });
  return projectSummary(firstRow(data, error));
}

export async function updateProject(
  client: unknown,
  input: {
    projectId: string;
    name: string;
    description?: string;
    routingMode: VerticalSliceRoutingMode;
    defaultModel?: string;
  },
): Promise<ProjectSummary> {
  const { data, error } = await request7Client(client)
    .from("projects")
    .update({
      name: input.name,
      description: input.description || null,
      default_routing_mode: input.routingMode,
      default_model: input.defaultModel || null,
    })
    .eq("id", input.projectId)
    .select(
      "id,owner_id,name,description,status,default_routing_mode,default_model,created_at,updated_at",
    )
    .single();
  if (error || !data) throwDatabaseError(error);
  return projectSummary(data);
}

export async function cancelGenerationJob(client: unknown, jobId: string): Promise<boolean> {
  const { data, error } = await request7Client(client).rpc("xeomx_cancel_generation_job", {
    p_job_id: jobId,
  });
  if (error) throwDatabaseError(error);
  return Boolean(data);
}

export async function loadProjectSnapshot(
  client: unknown,
  projectId: string,
): Promise<ProjectSnapshot> {
  const db = request7Client(client);
  const projectRequest = db
    .from("projects")
    .select(
      "id,owner_id,name,description,status,default_routing_mode,default_model,created_at,updated_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  const conversationsRequest = db
    .from("conversations")
    .select(
      "id,project_id,created_by,title,routing_mode,selected_provider,selected_model,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(100);
  const messagesRequest = db
    .from("messages")
    .select(
      "id,project_id,conversation_id,author_id,role,content,provider,model,metadata,generation_job_id,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(500);
  const jobsRequest = db
    .from("generation_jobs")
    .select(
      "id,user_id,project_id,conversation_id,input_message_id,capability,routing_mode,requested_provider,requested_model,selected_provider,selected_model,status,idempotency_key,request_hash,reserved_credit_units,attempt_count,max_attempts,error_category,error_message,request_metadata,queued_at,started_at,completed_at,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  const assetsRequest = db
    .from("assets")
    .select(
      "id,owner_id,project_id,generation_job_id,kind,origin,mime_type,status,storage_bucket,storage_path,version,parent_asset_id,metadata,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  const usageRequest = db
    .from("usage_events")
    .select(
      "id,user_id,project_id,job_id,provider_request_id,provider,model,input_units,output_units,estimated_cost_microunits,actual_cost_microunits,currency,usage_unavailable,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  const creditRequest = db
    .from("credit_ledger")
    .select(
      "id,user_id,project_id,job_id,usage_event_id,delta,reason,idempotency_key,metadata,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  const auditRequest = db
    .from("audit_events")
    .select(
      "id,actor_id,project_id,job_id,event_type,target_type,target_id,result,error_category,policy_context,metadata,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  const balanceRequest = db.rpc("xeomx_credit_balance", {});

  const [project, conversations, messages, jobs, assets, usage, credit, audit, balance] =
    await Promise.all([
      projectRequest,
      conversationsRequest,
      messagesRequest,
      jobsRequest,
      assetsRequest,
      usageRequest,
      creditRequest,
      auditRequest,
      balanceRequest,
    ]);

  if (project.error) throwDatabaseError(project.error);
  if (!project.data) throw new VerticalSliceError("PROJECT_NOT_FOUND");
  for (const response of [conversations, messages, jobs, assets, usage, credit, audit, balance]) {
    if (response.error) throwDatabaseError(response.error);
  }

  return {
    project: projectSummary(project.data),
    conversations: (conversations.data ?? []).map(conversationSummary),
    messages: (messages.data ?? []).map(messageSummary),
    jobs: (jobs.data ?? []).map(jobSummary),
    assets: (assets.data ?? []).map(assetSummary),
    usageEvents: (usage.data ?? []).map(usageSummary),
    creditLedger: (credit.data ?? []).map(creditSummary),
    auditEvents: (audit.data ?? []).map(auditSummary),
    creditBalance: Number(balance.data ?? 0),
  };
}

function generationRequestHash(input: {
  actorId: string;
  projectId: string;
  conversationId?: string;
  prompt: string;
  routingMode: VerticalSliceRoutingMode;
  requestedProvider?: string;
  requestedModel?: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        actorId: input.actorId,
        projectId: input.projectId,
        conversationId: input.conversationId ?? null,
        prompt: input.prompt,
        routingMode: input.routingMode,
        requestedProvider: input.requestedProvider ?? null,
        requestedModel: input.requestedModel ?? null,
      }),
    )
    .digest("hex");
}

export async function submitTextGeneration(
  client: unknown,
  input: {
    actorId: string;
    projectId: string;
    conversationId?: string;
    prompt: string;
    routingMode: VerticalSliceRoutingMode;
    requestedProvider?: string;
    requestedModel?: string;
    idempotencyKey: string;
  },
): Promise<GenerationExecutionResult> {
  if (!input.actorId) throw new VerticalSliceError("UNAUTHENTICATED");

  const route = REQUEST_7_LIVE_TEXT_PROVIDER;
  if (input.routingMode === "manual") {
    if (input.requestedProvider !== route.id) throw new VerticalSliceError("PROVIDER_UNAVAILABLE");
    if (input.requestedModel !== route.model) throw new VerticalSliceError("MODEL_UNAVAILABLE");
  }

  const request: GenerationSubmissionInput = {
    ...input,
    requestHash: generationRequestHash(input),
  };

  try {
    const { data, error } = await request7Client(client).rpc("xeomx_submit_generation_job", {
      p_project_id: request.projectId,
      p_conversation_id: request.conversationId ?? null,
      p_prompt: request.prompt,
      p_routing_mode: request.routingMode,
      p_requested_provider: request.requestedProvider ?? null,
      p_requested_model: request.requestedModel ?? null,
      p_idempotency_key: request.idempotencyKey,
      p_request_hash: request.requestHash,
    });
    const row = firstRow(data, error);
    return {
      jobId: row.job_id,
      conversationId: row.conversation_id,
      created: row.created,
      status: row.status,
    };
  } catch (error) {
    const safe = safeVerticalSliceError(error);
    console.error("[request7] generation submission failed", {
      code: safe.code,
      projectId: input.projectId,
      retryable: safe.retryable,
    });
    throw safe;
  }
}
