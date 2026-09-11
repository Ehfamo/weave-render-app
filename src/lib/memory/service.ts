import { z } from "zod";
import { MEMORY_TYPES } from "./contracts.ts";
import type {
  MemoryAdapter,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryRecord,
  MemoryScope,
  MemorySettings,
  MemoryMatch,
} from "./contracts.ts";

export const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user") }).strict(),
  z.object({ kind: z.literal("project"), projectId: z.string().uuid() }).strict(),
  z
    .object({
      kind: z.literal("conversation"),
      projectId: z.string().uuid(),
      conversationId: z.string().uuid(),
    })
    .strict(),
]);
export const draftSchema = z
  .object({
    type: z.enum(MEMORY_TYPES),
    scope: scopeSchema,
    content: z.string().trim().min(1).max(8000),
    importance: z.number().finite().min(0).max(1),
    source: z
      .object({
        kind: z.enum(["user", "conversation", "import"]),
        reference: z.string().max(500).optional(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (d) => d.type !== "ProjectMemory" || d.scope.kind === "project",
    "ProjectMemory requires project scope",
  )
  .refine(
    (d) => d.type !== "ConversationMemory" || d.scope.kind === "conversation",
    "ConversationMemory requires conversation scope",
  );
export const settingsSchema = z
  .object({ enabled: z.boolean(), disabledTypes: z.array(z.enum(MEMORY_TYPES)).max(8) })
  .strict();
const querySchema = z
  .object({
    scope: scopeSchema,
    types: z.array(z.enum(MEMORY_TYPES)).max(8).optional(),
    query: z.string().max(500).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    updatedSince: z.string().datetime().optional(),
    minimumImportance: z.number().finite().min(0).max(1).optional(),
  })
  .strict();
export function sameScope(a: MemoryScope, b: MemoryScope): boolean {
  return (
    a.kind === b.kind &&
    (a.kind === "user" ||
      (b.kind !== "user" &&
        a.projectId === b.projectId &&
        (a.kind !== "conversation" ||
          (b.kind === "conversation" && a.conversationId === b.conversationId))))
  );
}

export class MemoryService {
  private adapter: MemoryAdapter;
  constructor(adapter: MemoryAdapter) {
    z.string().uuid().parse(adapter.userId);
    this.adapter = adapter;
  }
  private owned(record: MemoryRecord): MemoryRecord {
    if (record.userId !== this.adapter.userId) throw new Error("MEMORY_ACCESS_DENIED");
    draftSchema.parse({
      type: record.type,
      scope: record.scope,
      content: record.content,
      importance: record.importance,
      source: record.source,
    });
    z.enum(["active", "archived"]).parse(record.status);
    return structuredClone(record);
  }
  async settings(): Promise<MemorySettings> {
    return settingsSchema.parse(await this.adapter.settings());
  }
  async setSettings(settings: MemorySettings): Promise<MemorySettings> {
    return settingsSchema.parse(await this.adapter.setSettings(settingsSchema.parse(settings)));
  }
  async create(input: MemoryDraft): Promise<MemoryRecord> {
    const draft = draftSchema.parse(input);
    const settings = await this.settings();
    if (!settings.enabled || settings.disabledTypes.includes(draft.type))
      throw new Error("MEMORY_DISABLED");
    const result = this.owned(await this.adapter.create(draft));
    if (!sameScope(result.scope, draft.scope)) throw new Error("MEMORY_SCOPE_MISMATCH");
    return result;
  }
  /** Inspection remains available when memory is disabled; automatic retrieval uses relevant(). */
  async get(id: string): Promise<MemoryRecord | null> {
    z.string().uuid().parse(id);
    const r = await this.adapter.get(id);
    return r ? this.owned(r) : null;
  }
  async list(input: MemoryQuery): Promise<MemoryRecord[]> {
    const query = querySchema.parse(input);
    const rows = await this.adapter.list(query);
    return rows
      .map((r) => this.owned(r))
      .filter(
        (r) =>
          sameScope(r.scope, query.scope) &&
          (!query.types || query.types.includes(r.type)) &&
          (!query.updatedSince || r.updatedAt >= query.updatedSince) &&
          r.importance >= (query.minimumImportance ?? 0) &&
          (!query.query ||
            r.content.toLocaleLowerCase("en").includes(query.query.toLocaleLowerCase("en"))),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, query.limit);
  }
  async relevant(input: MemoryQuery): Promise<MemoryMatch[]> {
    const query = querySchema.parse(input);
    const settings = await this.settings();
    if (!settings.enabled) return [];
    const types = (query.types ?? [...MEMORY_TYPES]).filter(
      (t) => !settings.disabledTypes.includes(t),
    );
    if (!types.length) return [];
    const rows = await this.list({ ...query, types, limit: 100 });
    // Bounded lexical retrieval; future semantic adapters must preserve actor/scope enforcement.
    return rows
      .filter((r) => r.status === "active")
      .map((memory) => ({
        memory,
        relevance: (query.query ? 0.7 : 0) + memory.importance * 0.3,
        method: "lexical" as const,
      }))
      .sort(
        (a, b) =>
          b.relevance - a.relevance ||
          b.memory.updatedAt.localeCompare(a.memory.updatedAt) ||
          a.memory.id.localeCompare(b.memory.id),
      )
      .slice(0, query.limit);
  }
  async update(id: string, input: MemoryPatch): Promise<MemoryRecord | null> {
    z.string().uuid().parse(id);
    const patch = z
      .object({
        content: z.string().trim().min(1).max(8000).optional(),
        importance: z.number().finite().min(0).max(1).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .strict()
      .parse(input);
    if (!Object.keys(patch).length) throw new Error("EMPTY_MEMORY_PATCH");
    const r = await this.adapter.update(id, patch);
    return r ? this.owned(r) : null;
  }
  archive(id: string) {
    return this.update(id, { status: "archived" });
  }
  async delete(id: string): Promise<void> {
    z.string().uuid().parse(id);
    await this.adapter.delete(id);
  }
}
