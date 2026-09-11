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

function invalid(): never {
  throw new Error("INVALID_MEMORY_INPUT");
}
export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k))) invalid();
}
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    return invalid();
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) return invalid();
  return value.trim();
}
function importance(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return invalid();
  return v;
}
function types(v: unknown): import("./contracts.ts").MemoryType[] {
  if (!Array.isArray(v) || v.length > 8 || v.some((t) => !MEMORY_TYPES.includes(t)))
    return invalid();
  return [...new Set(v)] as import("./contracts.ts").MemoryType[];
}
export const scopeSchema = {
  parse(value: unknown): MemoryScope {
    const v = object(value);
    if (v.kind === "user") {
      keys(v, ["kind"]);
      return { kind: "user" };
    }
    if (v.kind === "project") {
      keys(v, ["kind", "projectId"]);
      return { kind: "project", projectId: uuid(v.projectId) };
    }
    if (v.kind === "conversation") {
      keys(v, ["kind", "projectId", "conversationId"]);
      return {
        kind: "conversation",
        projectId: uuid(v.projectId),
        conversationId: uuid(v.conversationId),
      };
    }
    return invalid();
  },
};
export const draftSchema = {
  parse(value: unknown): MemoryDraft {
    const v = object(value);
    keys(v, ["type", "scope", "content", "importance", "source"]);
    const type = types([v.type])[0];
    const scope = scopeSchema.parse(v.scope);
    const source = object(v.source);
    keys(source, ["kind", "reference"]);
    if (!["user", "conversation", "import"].includes(String(source.kind))) return invalid();
    if (
      (type === "ProjectMemory" && scope.kind !== "project") ||
      (type === "ConversationMemory" && scope.kind !== "conversation")
    )
      return invalid();
    return {
      type,
      scope,
      content: text(v.content, 8000),
      importance: importance(v.importance),
      source: {
        kind: source.kind as MemoryDraft["source"]["kind"],
        ...(source.reference === undefined ? {} : { reference: text(source.reference, 500) }),
      },
    };
  },
};
export const settingsSchema = {
  parse(value: unknown): MemorySettings {
    const v = object(value);
    keys(v, ["enabled", "disabledTypes"]);
    if (typeof v.enabled !== "boolean") return invalid();
    return { enabled: v.enabled, disabledTypes: types(v.disabledTypes) };
  },
};
const querySchema = {
  parse(value: unknown): MemoryQuery & { limit: number } {
    const v = object(value);
    keys(v, ["scope", "types", "query", "limit", "updatedSince", "minimumImportance"]);
    const limit = v.limit ?? 20;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100)
      return invalid();
    if (v.query !== undefined && (typeof v.query !== "string" || v.query.length > 500))
      return invalid();
    if (
      v.updatedSince !== undefined &&
      (typeof v.updatedSince !== "string" || !Number.isFinite(Date.parse(v.updatedSince)))
    )
      return invalid();
    return {
      scope: scopeSchema.parse(v.scope),
      limit,
      ...(v.types === undefined ? {} : { types: types(v.types) }),
      ...(v.query === undefined ? {} : { query: v.query as string }),
      ...(v.updatedSince === undefined
        ? {}
        : { updatedSince: new Date(v.updatedSince as string).toISOString() }),
      ...(v.minimumImportance === undefined
        ? {}
        : { minimumImportance: importance(v.minimumImportance) }),
    };
  },
};
function patchSchema(value: unknown): MemoryPatch {
  const v = object(value);
  keys(v, ["content", "importance", "status"]);
  if (v.status !== undefined && v.status !== "active" && v.status !== "archived") return invalid();
  return {
    ...(v.content === undefined ? {} : { content: text(v.content, 8000) }),
    ...(v.importance === undefined ? {} : { importance: importance(v.importance) }),
    ...(v.status === undefined ? {} : { status: v.status as MemoryRecord["status"] }),
  };
}
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
    uuid(adapter.userId);
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
    if (!["active", "archived"].includes(record.status)) invalid();
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
    uuid(id);
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
    uuid(id);
    const patch = patchSchema(input);
    if (!Object.keys(patch).length) throw new Error("EMPTY_MEMORY_PATCH");
    const r = await this.adapter.update(id, patch);
    return r ? this.owned(r) : null;
  }
  archive(id: string) {
    return this.update(id, { status: "archived" });
  }
  async delete(id: string): Promise<void> {
    uuid(id);
    await this.adapter.delete(id);
  }
}
