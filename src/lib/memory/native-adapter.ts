import { z } from "zod";
import { MEMORY_TYPES } from "./contracts.ts";
import type {
  MemoryAdapter,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryRecord,
  MemorySettings,
} from "./contracts.ts";
import { settingsSchema } from "./service.ts";

export interface MemoryRpcClient {
  rpc(
    name: "xeomx_memory",
    args: { operation: string; payload: Record<string, unknown> },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}
const rowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  conversation_id: z.string().uuid().nullable(),
  type: z.enum(MEMORY_TYPES),
  content: z.string(),
  importance: z.number(),
  source: z.object({
    kind: z.enum(["user", "conversation", "import"]),
    reference: z.string().optional(),
  }),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
  updated_at: z.string(),
});

/** Pass only a user-token Supabase client, never a service-role client. Database RPC is SECURITY INVOKER. */
export class NativeMemoryAdapter implements MemoryAdapter {
  readonly userId: string;
  private client: MemoryRpcClient;
  constructor(userId: string, client: MemoryRpcClient) {
    this.userId = z.string().uuid().parse(userId);
    this.client = client;
  }
  private async call(operation: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await this.client.rpc("xeomx_memory", { operation, payload });
    if (error) throw new Error("MEMORY_STORAGE_ERROR");
    return data;
  }
  private row(value: unknown): MemoryRecord {
    const r = rowSchema.parse(value);
    if (r.user_id !== this.userId) throw new Error("MEMORY_ACCESS_DENIED");
    return {
      id: r.id,
      userId: r.user_id,
      type: r.type,
      content: r.content,
      importance: r.importance,
      source: r.source,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      scope:
        r.conversation_id && r.project_id
          ? { kind: "conversation", projectId: r.project_id, conversationId: r.conversation_id }
          : r.project_id
            ? { kind: "project", projectId: r.project_id }
            : { kind: "user" },
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
    return z
      .array(z.unknown())
      .parse(r)
      .map((v) => this.row(v));
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
