import { object, uuid } from "../memory/service.ts";
import type { ProjectDomain, ProjectActivity } from "./contracts.ts";
/** All reads use a verified user-token client. These callbacks must retain database RLS. */
export interface ProjectReads {
  role(projectId: string): Promise<unknown>;
  project(projectId: string): Promise<unknown>;
  conversations(projectId: string, conversationId?: string): Promise<unknown>;
}
function text(v: unknown, max: number): string {
  if (typeof v !== "string" || v.length > max) throw new Error("INVALID_PROJECT_DATA");
  return v;
}
function date(v: unknown) {
  const t = text(v, 64);
  if (!Number.isFinite(Date.parse(t))) throw new Error("INVALID_PROJECT_DATE");
  return new Date(t).toISOString();
}
export function createProjectDomain(userId: string, reads: ProjectReads): ProjectDomain {
  uuid(userId);
  async function authorized(id: string) {
    uuid(id);
    const role = await reads.role(id);
    if (role !== "owner" && role !== "editor" && role !== "viewer")
      throw new Error("PROJECT_ACCESS_DENIED");
  }
  async function activities(id: string, conversationId?: string): Promise<ProjectActivity[]> {
    await authorized(id);
    const rows = await reads.conversations(id, conversationId);
    if (!Array.isArray(rows) || rows.length > 10) throw new Error("INVALID_PROJECT_ACTIVITY");
    return rows.map((v: unknown) => {
      const r = object(v);
      if (r.project_id !== id || (conversationId && r.id !== conversationId))
        throw new Error("PROJECT_ACCESS_DENIED");
      return {
        id: uuid(r.id),
        projectId: id,
        title: text(r.title, 200),
        updatedAt: date(r.updated_at),
      };
    });
  }
  return {
    userId,
    async getAuthorizedProject(id) {
      await authorized(id);
      const raw = await reads.project(id);
      if (raw === null) return null;
      const p = object(raw);
      if (p.id !== id) throw new Error("PROJECT_ACCESS_DENIED");
      return {
        id,
        name: text(p.name, 120),
        description: p.description === null ? null : text(p.description, 4000),
        updatedAt: date(p.updated_at),
      };
    },
    recentConversations: (id) => activities(id),
    authorizeConversation: async (id, cid) => (await activities(id, uuid(cid))).length === 1,
  };
}
