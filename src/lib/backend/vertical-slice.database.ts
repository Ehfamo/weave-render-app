import type { Json } from "@/integrations/supabase/types";

type TableDefinition<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown> = Partial<Row>,
  Update extends Record<string, unknown> = Partial<Insert>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Request7ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  default_routing_mode: "auto" | "manual";
  default_model: string | null;
  created_at: string;
  updated_at: string;
};

export type Request7ConversationRow = {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  routing_mode: "auto" | "manual";
  selected_provider: string | null;
  selected_model: string | null;
  created_at: string;
  updated_at: string;
};

export type Request7MessageRow = {
  id: string;
  project_id: string;
  conversation_id: string;
  author_id: string | null;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  provider: string | null;
  model: string | null;
  metadata: Json;
  generation_job_id: string | null;
  created_at: string;
};

export type Request7GenerationJobRow = {
  id: string;
  user_id: string;
  project_id: string;
  conversation_id: string;
  input_message_id: string;
  capability: "text-generation";
  routing_mode: "auto" | "manual";
  requested_provider: string | null;
  requested_model: string | null;
  selected_provider: string | null;
  selected_model: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  idempotency_key: string;
  request_hash: string;
  reserved_credit_units: number;
  attempt_count: number;
  max_attempts: number;
  error_category: string | null;
  error_message: string | null;
  request_metadata: Json;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Request7AssetRow = {
  id: string;
  owner_id: string;
  project_id: string;
  generation_job_id: string | null;
  kind: "text" | "image" | "video" | "audio" | "document" | "code" | "file";
  origin: "upload" | "generation" | "import" | "marketplace";
  mime_type: string;
  status: "pending" | "processing" | "ready" | "failed" | "deleted";
  storage_bucket: string | null;
  storage_path: string | null;
  version: number;
  parent_asset_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type Request7AuditEventRow = {
  id: string;
  actor_id: string | null;
  project_id: string | null;
  job_id: string | null;
  event_type: string;
  target_type: string;
  target_id: string | null;
  result: "submitted" | "allowed" | "succeeded" | "failed" | "cancelled";
  error_category: string | null;
  policy_context: Json;
  metadata: Json;
  created_at: string;
};

export type Request7UsageEventRow = {
  id: string;
  user_id: string;
  project_id: string;
  job_id: string;
  provider_request_id: string | null;
  provider: string;
  model: string;
  input_units: number | null;
  output_units: number | null;
  estimated_cost_microunits: number | null;
  actual_cost_microunits: number | null;
  currency: string;
  usage_unavailable: boolean;
  created_at: string;
};

export type Request7CreditLedgerRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  job_id: string | null;
  usage_event_id: string | null;
  delta: number;
  reason: "grant" | "reservation" | "consume" | "release" | "refund" | "adjustment";
  idempotency_key: string;
  metadata: Json;
  created_at: string;
};

type SubmissionRpcRow = {
  job_id: string;
  conversation_id: string;
  created: boolean;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
};

export type Request7Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      projects: TableDefinition<
        Request7ProjectRow,
        {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          status?: "active" | "archived";
          default_routing_mode?: "auto" | "manual";
          default_model?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      project_members: TableDefinition<{
        project_id: string;
        user_id: string;
        role: "owner" | "editor" | "viewer";
        created_at: string;
      }>;
      conversations: TableDefinition<Request7ConversationRow>;
      messages: TableDefinition<Request7MessageRow>;
      generation_jobs: TableDefinition<Request7GenerationJobRow>;
      assets: TableDefinition<Request7AssetRow>;
      usage_events: TableDefinition<Request7UsageEventRow>;
      credit_ledger: TableDefinition<Request7CreditLedgerRow>;
      audit_events: TableDefinition<Request7AuditEventRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      xeomx_create_project: {
        Args: { p_name: string; p_description?: string | null };
        Returns: Array<
          Pick<
            Request7ProjectRow,
            | "id"
            | "name"
            | "description"
            | "status"
            | "default_routing_mode"
            | "default_model"
            | "created_at"
            | "updated_at"
          >
        >;
      };
      xeomx_credit_balance: { Args: Record<never, never>; Returns: number };
      xeomx_submit_generation_job: {
        Args: {
          p_project_id: string;
          p_conversation_id: string | null;
          p_prompt: string;
          p_routing_mode: "auto" | "manual";
          p_requested_provider: string | null;
          p_requested_model: string | null;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: SubmissionRpcRow[];
      };
      xeomx_create_generation_job: {
        Args: {
          p_actor_id: string;
          p_project_id: string;
          p_conversation_id: string | null;
          p_prompt: string;
          p_routing_mode: "auto" | "manual";
          p_requested_provider: string | null;
          p_requested_model: string | null;
          p_selected_provider: string;
          p_selected_model: string;
          p_idempotency_key: string;
          p_request_hash: string;
          p_reserved_credit_units: number;
        };
        Returns: SubmissionRpcRow[];
      };
      xeomx_record_unavailable_generation: {
        Args: {
          p_actor_id: string;
          p_project_id: string;
          p_conversation_id: string | null;
          p_prompt: string;
          p_routing_mode: "auto" | "manual";
          p_requested_provider: string | null;
          p_requested_model: string | null;
          p_idempotency_key: string;
          p_request_hash: string;
          p_error_category: "PROVIDER_UNAVAILABLE" | "MODEL_UNAVAILABLE";
        };
        Returns: SubmissionRpcRow[];
      };
      xeomx_start_generation_job: { Args: { p_job_id: string }; Returns: boolean };
      xeomx_cancel_generation_job: { Args: { p_job_id: string }; Returns: boolean };
      xeomx_complete_generation_job: {
        Args: {
          p_job_id: string;
          p_output_text: string;
          p_provider_request_identifier: string | null;
          p_input_units: number | null;
          p_output_units: number | null;
          p_estimated_cost_microunits: number | null;
          p_actual_cost_microunits: number | null;
          p_actual_credit_units: number;
          p_usage_unavailable: boolean;
          p_finish_reason: string | null;
        };
        Returns: Array<{ output_id: string; asset_id: string; message_id: string }>;
      };
      xeomx_fail_generation_job: {
        Args: {
          p_job_id: string;
          p_error_category: string;
          p_safe_error_message: string;
          p_provider_request_identifier?: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
