import type { AgentTaskStatus } from "../agents/contracts.ts";
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export interface TeamMember {
  userId: string;
  projectId: string;
  role: WorkspaceRole;
  joinedAt: string;
}
export type Permission =
  | "view"
  | "edit"
  | "execute_workflow"
  | "manage_automation"
  | "approve"
  | "assign"
  | "edit_creative"
  | "manage_members";
export interface Assignment {
  id: string;
  projectId: string;
  creatorId: string;
  assigneeId: string;
  assigneeType: "human" | "agent";
  description: string;
  priority: "low" | "normal" | "high";
  status: AgentTaskStatus;
  requiredApproval: boolean;
  resultReference?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface ActivityEntry {
  id: string;
  projectId: string;
  actorId: string;
  kind: "assignment" | "comment" | "approval" | "agent_result" | "workflow";
  subjectId: string;
  summary: string;
  traceId?: string;
  createdAt: string;
}
export interface CollaborationComment {
  id: string;
  projectId: string;
  authorId: string;
  subjectId: string;
  body: string;
  createdAt: string;
}
