import { MemoryService, uuid } from "../memory/service.ts";
import type { MemoryRecord } from "../memory/contracts.ts";
import { BRAIN_KINDS } from "./contracts.ts";
import type {
  BrainEntry,
  BrainKind,
  ProjectDomain,
  ProjectBrainState,
  ProjectBrainSnapshot,
  ProjectContext,
} from "./contracts.ts";
const marker = "xeomx.project-brain.v1";
function entries(value: unknown): BrainEntry[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error("INVALID_BRAIN_STATE");
  const ids = new Set<string>();
  let goals = 0;
  return value
    .map((v: unknown) => {
      if (typeof v !== "object" || v === null) throw new Error("INVALID_BRAIN_ENTRY");
      const r = v as Record<string, unknown>;
      if (
        typeof r.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(r.id) ||
        ids.has(r.id) ||
        !BRAIN_KINDS.includes(r.kind as BrainKind) ||
        typeof r.text !== "string" ||
        !r.text.trim() ||
        r.text.length > 1500 ||
        typeof r.resolved !== "boolean"
      )
        throw new Error("INVALID_BRAIN_ENTRY");
      ids.add(r.id);
      if (r.kind === "goal" && ++goals > 1) throw new Error("DUPLICATE_PROJECT_GOAL");
      return { id: r.id, kind: r.kind as BrainKind, text: r.text.trim(), resolved: r.resolved };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
export class ProjectBrainService {
  private memory: MemoryService;
  private domain: ProjectDomain;
  constructor(memory: MemoryService, domain: ProjectDomain) {
    this.memory = memory;
    this.domain = domain;
    uuid(domain.userId);
  }
  private async project(id: string) {
    uuid(id);
    const p = await this.domain.getAuthorizedProject(id);
    if (!p || p.id !== id) throw new Error("PROJECT_ACCESS_DENIED");
    return p;
  }
  private owned(r: MemoryRecord, projectId: string) {
    if (
      r.userId !== this.domain.userId ||
      r.scope.kind !== "project" ||
      r.scope.projectId !== projectId
    )
      throw new Error("BRAIN_ACCESS_DENIED");
    return r;
  }
  private async document(projectId: string) {
    const rows = await this.memory.list({
      scope: { kind: "project", projectId },
      types: ["ProjectMemory"],
      query: marker,
      limit: 100,
    });
    const docs = rows.filter(
      (r) => this.owned(r, projectId).source.reference === marker && r.status === "active",
    );
    // Fail closed on concurrent initial creation; never silently choose conflicting canonical state.
    if (docs.length > 1) throw new Error("BRAIN_CONFLICT");
    return docs[0] ?? null;
  }
  async get(projectId: string): Promise<ProjectBrainState> {
    const project = await this.project(projectId);
    if (this.domain.readBrain) {
      const data = await this.domain.readBrain(projectId);
      return { project, entries: entries(data), updatedAt: project.updatedAt };
    }
    // Read-only compatibility for unmigrated callers; memory settings never hide project state.
    const doc = await this.document(projectId);
    let data: unknown = [];
    if (doc) {
      const decoded: unknown = JSON.parse(doc.content);
      if (
        typeof decoded !== "object" ||
        decoded === null ||
        !("format" in decoded) ||
        decoded.format !== marker ||
        !("entries" in decoded)
      )
        throw new Error("INVALID_BRAIN_STATE");
      data = decoded.entries;
    }
    return { project, entries: entries(data), updatedAt: doc?.updatedAt ?? project.updatedAt };
  }
  async put(projectId: string, entry: BrainEntry): Promise<ProjectBrainState> {
    await this.project(projectId);
    const validated = entries([entry])[0];
    const state = await this.get(projectId);
    const next = entries([
      ...state.entries.filter(
        (e) => e.id !== validated.id && !(validated.kind === "goal" && e.kind === "goal"),
      ),
      validated,
    ]);
    const content = JSON.stringify({ format: marker, entries: next });
    if (content.length > 7500) throw new Error("BRAIN_CAPACITY_EXCEEDED");
    if (!this.domain.writeBrain) throw new Error("PROJECT_STORAGE_UNAVAILABLE");
    await this.domain.writeBrain(projectId, next, state.entries);
    return this.get(projectId);
  }
  setGoal(projectId: string, text: string) {
    return this.put(projectId, { id: "goal", kind: "goal", text, resolved: false });
  }
  async relevantProjectMemories(projectId: string, query?: string, limit = 20) {
    await this.project(projectId);
    return (
      await this.memory.relevant({ scope: { kind: "project", projectId }, query, limit })
    ).filter((m) => this.owned(m.memory, projectId).source.reference !== marker);
  }
  setInstruction(projectId: string, id: string, text: string) {
    return this.put(projectId, { id, kind: "instruction", text, resolved: false });
  }
  recordDecision(projectId: string, id: string, text: string) {
    return this.put(projectId, { id, kind: "decision", text, resolved: false });
  }
  recordConstraint(projectId: string, id: string, text: string) {
    return this.put(projectId, { id, kind: "constraint", text, resolved: false });
  }
  trackEntity(projectId: string, id: string, text: string) {
    return this.put(projectId, { id, kind: "entity", text, resolved: false });
  }
  trackOpenItem(projectId: string, id: string, text: string, resolved = false) {
    return this.put(projectId, { id, kind: "openItem", text, resolved });
  }
  async snapshot(projectId: string, conversationId?: string): Promise<ProjectBrainSnapshot> {
    const project = await this.project(projectId);
    if (
      conversationId &&
      !(await this.domain.authorizeConversation(projectId, uuid(conversationId)))
    )
      throw new Error("CONVERSATION_ACCESS_DENIED");
    const settings = await this.memory.settings();
    const state = await this.get(projectId);
    const matches = await this.memory.relevant({
      scope: { kind: "project", projectId },
      limit: 100,
    });
    const memories = matches
      .map((m) => this.owned(m.memory, projectId))
      .filter((r) => r.source.reference !== marker);
    if (conversationId) {
      for (const { memory: r } of await this.memory.relevant({
        scope: { kind: "conversation", projectId, conversationId },
        limit: 20,
      })) {
        if (
          r.userId !== this.domain.userId ||
          r.scope.kind !== "conversation" ||
          r.scope.projectId !== projectId ||
          r.scope.conversationId !== conversationId
        )
          throw new Error("BRAIN_ACCESS_DENIED");
        memories.push(r);
      }
    }
    const recentActivity = (await this.domain.recentConversations(projectId))
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, 10);
    const of = <K extends BrainKind>(kind: K) =>
      state.entries.filter((e): e is BrainEntry & { kind: K } => e.kind === kind);
    const goal = of("goal")[0] ?? null;
    return {
      ...state,
      goal,
      instructions: of("instruction"),
      decisions: of("decision"),
      constraints: of("constraint"),
      entities: of("entity"),
      openItems: of("openItem").filter((e) => !e.resolved),
      memories,
      recentActivity,
      summary: { method: "deterministic", text: goal?.text ?? project.name },
      memoryEnabled: settings.enabled,
      candidateLimit: 100,
      updatedAt:
        [
          project.updatedAt,
          state.updatedAt,
          ...memories.map((r) => r.updatedAt),
          ...recentActivity.map((a) => a.updatedAt),
        ]
          .sort()
          .at(-1) ?? state.updatedAt,
    };
  }
  async buildContext(
    projectId: string,
    options: { conversationId?: string; maxCharacters?: number } = {},
  ): Promise<ProjectContext> {
    const maxCharacters = options.maxCharacters ?? 12000;
    if (!Number.isInteger(maxCharacters) || maxCharacters < 128 || maxCharacters > 32000)
      throw new Error("INVALID_CONTEXT_LIMIT");
    const snapshot = await this.snapshot(projectId, options.conversationId);
    const history = options.conversationId && this.domain.recentMessages
      ? await this.domain.recentMessages(projectId, options.conversationId)
      : [];
    const reference = history.filter((row) => row.role === "assistant").at(-1);
    const candidates = [
      { kind: "identity", text: snapshot.project.name },
      ...[
        snapshot.goal,
        ...snapshot.instructions,
        ...snapshot.constraints,
        ...snapshot.decisions,
        ...snapshot.openItems,
        ...snapshot.entities,
        ...snapshot.entries.filter((e) => e.kind === "fact" || e.kind === "preference"),
      ]
        .filter((e): e is BrainEntry => e !== null)
        .map((e) => ({ kind: e.kind, text: e.text })),
      { kind: "description", text: snapshot.project.description ?? "" },
      ...history.map((row) => ({ kind: `history:${row.role}`, text: row.content.slice(0, 4000), id: row.id })),
      ...snapshot.memories.map((r) => ({ kind: r.type, text: r.content })),
      ...snapshot.recentActivity.map((a) => ({ kind: "activity", text: a.title })),
    ];
    const sections: { kind: string; text: string }[] = [];
    const encode = () => JSON.stringify({ projectId, sections });
    let truncated = history.some((row) => row.content.length > 4000);
    let referenceIncluded = false;
    for (const candidate of candidates) {
      sections.push({ kind: candidate.kind, text: candidate.text });
      if (encode().length > maxCharacters) {
        sections.pop();
        truncated = true;
        break;
      }
      if ("id" in candidate && candidate.id === reference?.id) referenceIncluded = true;
    }
    // Whole sections preserve valid structured JSON. Budget applies to serialized text,
    // including escapes; no full snapshot is attached to accidentally bypass this bound.
    return {
      projectId,
      text: encode(),
      maxCharacters,
      truncated,
      sourceCount: sections.length,
      updatedAt: snapshot.updatedAt,
      ...(reference && referenceIncluded ? { referenceResultId: reference.id } : {}),
    };
  }
}
