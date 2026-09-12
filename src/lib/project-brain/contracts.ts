import type { MemoryRecord } from "../memory/contracts.ts";
export interface ProjectIdentity {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
}
export const BRAIN_KINDS = [
  "goal",
  "instruction",
  "decision",
  "constraint",
  "entity",
  "openItem",
  "preference",
  "fact",
] as const;
export type BrainKind = (typeof BRAIN_KINDS)[number];
export interface BrainEntry {
  id: string;
  kind: BrainKind;
  text: string;
  resolved: boolean;
}
export type ProjectGoal = BrainEntry & { kind: "goal" };
export type ProjectInstruction = BrainEntry & { kind: "instruction" };
export type ProjectDecision = BrainEntry & { kind: "decision" };
export type ProjectConstraint = BrainEntry & { kind: "constraint" };
export type ProjectEntity = BrainEntry & { kind: "entity" };
export type ProjectOpenItem = BrainEntry & { kind: "openItem" };
export interface ProjectBrainState {
  project: ProjectIdentity;
  entries: BrainEntry[];
  updatedAt: string;
}
export interface ProjectActivity {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
}
/** Trusted caller-bound backend port; implementations must recheck membership, not trust supplied IDs. */
export interface ProjectDomain {
  readonly userId: string;
  getAuthorizedProject(id: string): Promise<ProjectIdentity | null>;
  recentConversations(id: string): Promise<ProjectActivity[]>;
  authorizeConversation(projectId: string, conversationId: string): Promise<boolean>;
}
export interface ProjectSummary {
  text: string;
  method: "deterministic" | "generated";
}
export interface ProjectBrainSnapshot extends ProjectBrainState {
  goal: ProjectGoal | null;
  instructions: ProjectInstruction[];
  decisions: ProjectDecision[];
  constraints: ProjectConstraint[];
  entities: ProjectEntity[];
  openItems: ProjectOpenItem[];
  memories: MemoryRecord[];
  recentActivity: ProjectActivity[];
  summary: ProjectSummary;
  memoryEnabled: boolean;
  candidateLimit: number;
}
export interface ProjectContext {
  projectId: string;
  text: string;
  maxCharacters: number;
  truncated: boolean;
  sourceCount: number;
  updatedAt: string;
}
/** Optional future integration; generated output is never authoritative stored state. */
export interface ProjectSummaryAdapter {
  summarize(context: ProjectContext): Promise<ProjectSummary>;
}
