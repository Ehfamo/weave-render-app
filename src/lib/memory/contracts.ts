export const MEMORY_TYPES = [
  "UserMemory",
  "ProjectMemory",
  "ConversationMemory",
  "CharacterMemory",
  "VoiceMemory",
  "BrandMemory",
  "PreferenceMemory",
  "InstructionMemory",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemoryScope =
  | { kind: "user" }
  | { kind: "project"; projectId: string }
  | { kind: "conversation"; projectId: string; conversationId: string };
export interface MemorySource {
  kind: "user" | "conversation" | "import";
  reference?: string;
}
export type MemoryImportance = number; // finite [0,1]
export type MemoryStatus = "active" | "archived";
export interface MemoryDraft {
  type: MemoryType;
  scope: MemoryScope;
  content: string;
  importance: MemoryImportance;
  source: MemorySource;
}
export interface MemoryRecord extends MemoryDraft {
  id: string;
  userId: string;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}
export interface MemorySettings {
  enabled: boolean;
  disabledTypes: MemoryType[];
}
export interface MemoryQuery {
  scope: MemoryScope;
  types?: MemoryType[];
  query?: string;
  limit?: number;
  updatedSince?: string;
  minimumImportance?: number;
}
export interface MemoryMatch {
  memory: MemoryRecord;
  relevance: number;
  method: "lexical" | "semantic";
}
export type MemoryPatch = Partial<Pick<MemoryRecord, "content" | "importance" | "status">>;
/** Adapter is bound to an authenticated actor. Implementations MUST enforce ownership in storage too. */
export interface MemoryAdapter {
  readonly userId: string;
  create(draft: MemoryDraft): Promise<MemoryRecord>;
  get(id: string): Promise<MemoryRecord | null>;
  list(query: MemoryQuery): Promise<MemoryRecord[]>;
  update(id: string, patch: MemoryPatch): Promise<MemoryRecord | null>;
  delete(id: string): Promise<void>;
  settings(): Promise<MemorySettings>;
  setSettings(settings: MemorySettings): Promise<MemorySettings>;
}
