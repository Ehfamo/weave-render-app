import { uuid } from "../memory/service.ts";
import { SEARCH_TYPES } from "./contracts.ts";
import type {
  GlobalSearchQuery,
  GlobalSearchSource,
  SearchAccess,
  GlobalSearchPage,
  SearchCandidate,
} from "./contracts.ts";
export function normalize(text: string) {
  return text.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}
export function validateQuery(value: unknown): GlobalSearchQuery {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_SEARCH_QUERY");
  const q = value as Record<string, unknown>;
  if (typeof q.text !== "string" || q.text.length > 300) throw new Error("INVALID_SEARCH_QUERY");
  const offset = q.offset ?? 0,
    limit = q.limit ?? 20,
    sort = q.sort ?? "relevance";
  if (
    typeof offset !== "number" ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 5000 ||
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !["relevance", "recent"].includes(String(sort))
  )
    throw new Error("INVALID_SEARCH_QUERY");
  const f = q.filters ?? {};
  if (!f || typeof f !== "object" || Array.isArray(f)) throw new Error("INVALID_SEARCH_FILTER");
  const filters = f as Record<string, unknown>;
  if (
    filters.types !== undefined &&
    (!Array.isArray(filters.types) ||
      filters.types.length > 6 ||
      filters.types.some((t) => !SEARCH_TYPES.includes(t)))
  )
    throw new Error("INVALID_SEARCH_FILTER");
  return {
    text: normalize(q.text),
    offset,
    limit,
    sort: sort as GlobalSearchQuery["sort"],
    filters: {
      ...(filters.projectId === undefined ? {} : { projectId: uuid(filters.projectId) }),
      ...(filters.types === undefined
        ? {}
        : { types: filters.types as NonNullable<GlobalSearchQuery["filters"]>["types"] }),
    },
  };
}
export function targetFor(c: Pick<SearchCandidate, "type" | "id" | "projectId">) {
  const params = new URLSearchParams({ type: c.type, id: c.id });
  if (c.projectId) params.set("projectId", c.projectId);
  return `/workspace?${params}`;
}
export class GlobalSearchService {
  private sources: GlobalSearchSource[];
  private access: SearchAccess;
  constructor(sources: GlobalSearchSource[], access: SearchAccess) {
    this.sources = sources;
    this.access = access;
    uuid(access.userId);
    if (new Set(sources.map((s) => s.id)).size !== sources.length)
      throw new Error("DUPLICATE_SEARCH_SOURCE");
  }
  async search(input: GlobalSearchQuery): Promise<GlobalSearchPage> {
    const q = validateQuery(input),
      project = q.filters?.projectId;
    const permissions = new Map<string, Promise<boolean>>();
    const allowed = (id: string) => {
      uuid(id);
      if (!permissions.has(id)) permissions.set(id, this.access.canReadProject(id));
      return permissions.get(id)!;
    };
    if (project && !(await allowed(project))) throw new Error("SEARCH_ACCESS_DENIED");
    const selected = this.sources.filter(
      (s) => !q.filters?.types || q.filters.types.includes(s.type),
    );
    const batches = await Promise.all(
      selected.map(async (s) => {
        try {
          const rows = await s.read(q);
          if (rows.length > 1000) throw new Error("SOURCE_LIMIT");
          const safe = [];
          for (const c of rows) {
            if (
              c.type !== s.type ||
              typeof c.id !== "string" ||
              !c.id ||
              c.id.length > 200 ||
              typeof c.title !== "string" ||
              typeof c.snippet !== "string" ||
              !Number.isFinite(Date.parse(c.createdAt)) ||
              !Number.isFinite(Date.parse(c.updatedAt))
            )
              throw new Error("INVALID_SEARCH_ROW");
            if (c.ownerId !== undefined && c.ownerId !== this.access.userId) continue;
            if (
              ["memory", "asset", "generation", "prompt"].includes(c.type) &&
              c.ownerId !== this.access.userId
            )
              continue;
            if (project && c.projectId !== project) continue;
            if ((c.type === "project" || c.type === "conversation") && !c.projectId) continue;
            if (c.projectId && !(await allowed(c.projectId))) continue;
            const title = normalize(c.title),
              body = normalize(c.snippet),
              tokens = q.text.split(" ").filter(Boolean);
            if (tokens.some((t) => !title.includes(t) && !body.includes(t))) continue;
            const importance = Number.isFinite(c.importance)
              ? Math.max(0, Math.min(1, c.importance!))
              : 0;
            const relevance =
              (q.text && title === q.text ? 100 : 0) +
              tokens.reduce(
                (score, t) =>
                  score + (title.split(/\W+/u).includes(t) ? 10 : title.includes(t) ? 5 : 1),
                0,
              ) +
              importance;
            safe.push({
              id: c.id,
              type: c.type,
              title: c.title.slice(0, 200),
              snippet: c.snippet.slice(0, 350),
              ...(c.projectId ? { projectId: c.projectId } : {}),
              createdAt: new Date(c.createdAt).toISOString(),
              updatedAt: new Date(c.updatedAt).toISOString(),
              relevance,
              target: targetFor(c),
              source: { id: s.id, method: "lexical" as const },
            });
          }
          return { id: s.id, status: "available" as const, rows: safe };
        } catch {
          return { id: s.id, status: "unavailable" as const, rows: [] };
        }
      }),
    );
    const unique = new Map<string, GlobalSearchPage["results"][number]>();
    for (const b of batches)
      for (const r of b.rows)
        if (!unique.has(`${r.type}:${r.id}`)) unique.set(`${r.type}:${r.id}`, r);
    const ranked = [...unique.values()].sort(
      (a, b) =>
        (q.sort === "recent" ? 0 : b.relevance - a.relevance) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.type.localeCompare(b.type) ||
        a.id.localeCompare(b.id),
    );
    const offset = q.offset ?? 0,
      limit = q.limit ?? 20;
    return {
      results: ranked.slice(offset, offset + limit),
      nextOffset: offset + limit < ranked.length ? offset + limit : null,
      totalInWindow: ranked.length,
      coverage: "bounded",
      sources: batches.map(({ id, status }) => ({ id, status })),
    };
  }
}
