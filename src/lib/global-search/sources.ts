import type { MemoryService } from "../memory/service.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type {
  GlobalSearchSource,
  GlobalSearchResultType,
  SearchCandidate,
  SearchAccess,
} from "./contracts.ts";
import { object, uuid } from "../memory/service.ts";
export interface SearchReads {
  rows(type: Exclude<GlobalSearchResultType, "memory">, projectId?: string): Promise<unknown>;
}
function str(v: unknown, max = 4000): string {
  if (typeof v !== "string") throw new Error("INVALID_SOURCE_ROW");
  return v.slice(0, max);
}
export function nativeSources(
  reads: SearchReads,
  memory: MemoryService,
  brain: ProjectBrainService,
  access: SearchAccess,
): GlobalSearchSource[] {
  const rows = async (type: Exclude<GlobalSearchResultType, "memory">, projectId?: string) => {
    const value = await reads.rows(type, projectId);
    if (!Array.isArray(value) || value.length > 100) throw new Error("INVALID_SOURCE_ROWS");
    return value.map(object);
  };
  const native: GlobalSearchSource[] = [
    "project",
    "conversation",
    "prompt",
    "asset",
    "generation",
  ].map((t) => {
    const type = t as Exclude<GlobalSearchResultType, "memory">;
    return {
      id: type,
      type,
      async read(q) {
        return (await rows(type, q.filters?.projectId)).map((r) => {
          const id = uuid(r.id),
            projectId =
              type === "project"
                ? id
                : typeof r.project_id === "string"
                  ? uuid(r.project_id)
                  : undefined;
          const ownerId =
            type === "prompt"
              ? str(r.author_id)
              : type === "asset"
                ? str(r.owner_id)
                : type === "generation"
                  ? str(r.user_id)
                  : undefined;
          const metadata =
            type === "asset" && r.metadata && typeof r.metadata === "object"
              ? object(r.metadata)
              : {};
          const title =
            type === "project"
              ? str(r.name)
              : type === "asset"
                ? str(metadata.name ?? r.kind)
                : type === "generation"
                  ? str(r.capability)
                  : str(r.title);
          const snippet =
            type === "asset"
              ? str(metadata.description ?? r.mime_type)
              : type === "generation"
                ? str(r.status)
                : type === "conversation"
                  ? ""
                  : str(r.description ?? "");
          return {
            id,
            type,
            title,
            snippet,
            projectId,
            ownerId,
            createdAt: str(r.created_at),
            updatedAt: str(r.updated_at ?? r.created_at),
          };
        });
      },
    };
  });
  native.push({
    id: "memory",
    type: "memory",
    async read(q) {
      const settings = await memory.settings();
      if (!settings.enabled) return [];
      const projectRows = await rows("project", q.filters?.projectId);
      const projects = projectRows.slice(0, 5).map((r) => uuid(r.id));
      const conversations = (await rows("conversation", q.filters?.projectId)).slice(0, 5);
      const scopes: Parameters<MemoryService["relevant"]>[0]["scope"][] = [];
      if (!q.filters?.projectId) scopes.push({ kind: "user" });
      for (const projectId of projects)
        if (await access.canReadProject(projectId)) scopes.push({ kind: "project", projectId });
      for (const r of conversations) {
        const projectId = uuid(r.project_id);
        if (await access.canReadProject(projectId))
          scopes.push({ kind: "conversation", projectId, conversationId: uuid(r.id) });
      }
      const groups = await Promise.all(
        scopes.map((scope) => memory.relevant({ scope, limit: 50 })),
      );
      return groups
        .flat()
        .filter(({ memory: r }) => r.source.reference !== "xeomx.project-brain.v1")
        .map(({ memory: r }) => ({
          id: r.id,
          type: "memory" as const,
          title: r.content.slice(0, 80),
          snippet: r.content,
          ownerId: r.userId,
          projectId: r.scope.kind === "user" ? undefined : r.scope.projectId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          importance: r.importance,
        }));
    },
  });
  native.push({
    id: "project-brain",
    type: "memory",
    async read(q) {
      const projectId = q.filters?.projectId;
      if (!projectId) return [];
      const s = await brain.snapshot(projectId);
      return s.entries
        .filter((e) => !e.resolved)
        .map((e) => ({
          id: `brain-${e.id}`,
          type: "memory" as const,
          title: e.text.slice(0, 80),
          snippet: e.text,
          projectId,
          ownerId: access.userId,
          createdAt: s.updatedAt,
          updatedAt: s.updatedAt,
          importance: 1,
        }));
    },
  });
  return native;
}
