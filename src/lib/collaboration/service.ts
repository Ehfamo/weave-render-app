import { requirePermission } from "./permissions.ts";
import type {
  ActivityEntry,
  Assignment,
  CollaborationComment,
  Permission,
  TeamMember,
  WorkspaceRole,
} from "./contracts.ts";
export interface CollaborationStore {
  actorId: string;
  member(projectId: string, userId: string): Promise<TeamMember | null>;
  saveAssignment(v: Assignment): Promise<void>;
  assignments(projectId: string): Promise<Assignment[]>;
  appendActivity(v: ActivityEntry): Promise<void>;
  activity(projectId: string): Promise<ActivityEntry[]>;
  saveComment(v: CollaborationComment): Promise<void>;
}
export class CollaborationService {
  private store: CollaborationStore;
  constructor(store: CollaborationStore) {
    this.store = store;
  }
  private async auth(projectId: string, p: Permission) {
    const m = await this.store.member(projectId, this.store.actorId);
    if (!m) throw Error("COLLABORATION_FORBIDDEN");
    requirePermission(m.role, p);
  }
  async assign(v: Assignment) {
    await this.auth(v.projectId, "assign");
    if (v.creatorId !== this.store.actorId) throw Error("COLLABORATION_FORBIDDEN");
    if (v.assigneeType === "human" && !(await this.store.member(v.projectId, v.assigneeId)))
      throw Error("ASSIGNEE_FORBIDDEN");
    await this.store.saveAssignment(v);
    await this.store.appendActivity({
      id: `activity:${v.id}`,
      projectId: v.projectId,
      actorId: this.store.actorId,
      kind: "assignment",
      subjectId: v.id,
      summary: "assignment.created",
      createdAt: v.createdAt,
    });
    return v;
  }
  async complete(projectId: string, id: string, resultReference: string) {
    await this.auth(projectId, "edit");
    const a = (await this.store.assignments(projectId)).find((x) => x.id === id);
    if (!a) throw Error("ASSIGNMENT_NOT_FOUND");
    a.status = "completed";
    a.resultReference = resultReference;
    await this.store.saveAssignment(a);
    return a;
  }
  async comment(v: CollaborationComment) {
    await this.auth(v.projectId, "view");
    if (v.authorId !== this.store.actorId || !v.body.trim() || v.body.length > 4000)
      throw Error("INVALID_COMMENT");
    await this.store.saveComment(v);
  }
  async listActivity(projectId: string) {
    await this.auth(projectId, "view");
    return this.store.activity(projectId);
  }
  async changeRole(projectId: string, userId: string, role: WorkspaceRole) {
    await this.auth(projectId, "manage_members");
    if (userId === this.store.actorId && role !== "owner") throw Error("OWNER_ROLE_IMMUTABLE");
    return role;
  }
}
