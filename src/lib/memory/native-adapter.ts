import type {
  MemoryAdapter,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryRecord,
  MemorySettings,
} from "./contracts.ts";
import { settingsSchema, draftSchema, uuid, object } from "./service.ts";

export interface MemoryRpcClient {
  rpc(
    name: "xeomx_memory",
    args: { operation: string; payload: Record<string, unknown> },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}
/** Pass only a user-token Supabase client, never a service-role client. Database RPC is SECURITY INVOKER. */
export class NativeMemoryAdapter implements MemoryAdapter {
  readonly userId: string;
  private client: MemoryRpcClient;
  constructor(userId: string, client: MemoryRpcClient) {
    this.userId = uuid(userId);
    this.client = client;
  }
  private async call(operation: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await this.client.rpc("xeomx_memory", { operation, payload });
    if (error) throw new Error("MEMORY_STORAGE_ERROR");
    return data;
  }
  private row(value: unknown): MemoryRecord {
    const r = object(value);
    if (r.user_id !== this.userId) throw new Error("MEMORY_ACCESS_DENIED");
    const scope =
      r.conversation_id && r.project_id
        ? { kind: "conversation", projectId: r.project_id, conversationId: r.conversation_id }
        : r.project_id
          ? { kind: "project", projectId: r.project_id }
          : { kind: "user" };
    const draft = draftSchema.parse({
      type: r.type,
      content: r.content,
      importance: r.importance,
      source: r.source,
      scope,
    });
    if (
      (r.status !== "active" && r.status !== "archived") ||
      typeof r.created_at !== "string" ||
      typeof r.updated_at !== "string" ||
      !Number.isFinite(Date.parse(r.created_at)) ||
      !Number.isFinite(Date.parse(r.updated_at))
    )
      throw new Error("INVALID_MEMORY_ROW");
    return {
      ...draft,
      id: uuid(r.id),
      userId: this.userId,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  async create(d: MemoryDraft) {
    return this.row(await this.call("create", { ...d }));
  }
  async get(id: string) {
    const r = await this.call("get", { id });
    return r === null ? null : this.row(r);
  }
  async list(q: MemoryQuery) {
    const r = await this.call("list", { ...q });
    if (!Array.isArray(r)) throw new Error("INVALID_MEMORY_ROWS");
    return r.map((v) => this.row(v));
  }
  async update(id: string, patch: MemoryPatch) {
    const r = await this.call("update", { ...patch, id });
    return r === null ? null : this.row(r);
  }
  async delete(id: string) {
    await this.call("delete", { id });
  }
  async settings() {
    return settingsSchema.parse(await this.call("settings"));
  }
  async setSettings(settings: MemorySettings) {
    return settingsSchema.parse(await this.call("setSettings", { ...settings }));
  }
}
