import { object, scopeSchema, sameScope, uuid } from "../memory/service.ts";
import type { MemoryService } from "../memory/service.ts";
import type { MemoryScope, MemoryPatch, MemorySettings } from "../memory/contracts.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type { ProjectSummary, AssetSummary, ProjectMessage } from "../backend/vertical-slice.ts";
import type { CoreExecutionRequest, CoreExecutionResponse } from "../core-execution/contracts.ts";

export interface ProjectActivity {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  state?: string;
}
export interface ProjectPersistence {
  readonly userId: string;
  authorize(projectId: string, write?: boolean): Promise<void>;
  list(): Promise<ProjectSummary[]>;
  create(input: { name: string; description?: string }): Promise<ProjectSummary>;
  load(projectId: string): Promise<{
    project: ProjectSummary;
    assets: readonly AssetSummary[];
    messages?: readonly ProjectMessage[];
  }>;
  rename(projectId: string, name: string): Promise<void>;
  activity(projectId: string): Promise<ProjectActivity[]>;
  begin(input: CoreExecutionRequest & { executionId: string; requestHash: string }): Promise<{
    conversationId: string;
    created: boolean;
    response?: CoreExecutionResponse;
  }>;
  finish(conversationId: string, response: CoreExecutionResponse): Promise<void>;
}

function shortText(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("INVALID_PROJECT_INPUT");
  return value.trim();
}
export function projectTarget(projectId: string) {
  return `/projects/${uuid(projectId)}`;
}

/** Composition of the canonical project, Brain, Memory and conversation services. No storage here. */
export class ProjectsService {
  readonly persistence: ProjectPersistence;
  readonly brain: ProjectBrainService;
  readonly memory: MemoryService;
  constructor(persistence: ProjectPersistence, brain: ProjectBrainService, memory: MemoryService) {
    uuid(persistence.userId);
    this.persistence = persistence;
    this.brain = brain;
    this.memory = memory;
  }
  async authorize(id: string, write = false) {
    await this.persistence.authorize(uuid(id), write);
  }
  async home() {
    const rows = await this.persistence.list();
    const projects = await Promise.all(
      rows.map(async (project) => {
        await this.authorize(project.id);
        const [brain, activity] = await Promise.all([
          this.brain.get(project.id),
          this.persistence.activity(project.id),
        ]);
        if (activity.some((row) => row.projectId !== project.id))
          throw new Error("PROJECT_ACCESS_DENIED");
        return {
          ...project,
          goal: brain.entries.find((e) => e.kind === "goal")?.text ?? null,
          activity: activity.slice(0, 3),
          target: projectTarget(project.id),
        };
      }),
    );
    return {
      projects,
      continuations: projects
        .flatMap((project) =>
          project.activity.map((activity) => ({
            ...activity,
            projectName: project.name,
            target: project.target,
          })),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    };
  }
  async create(input: { name: string; goal?: string }) {
    const name = shortText(input.name, 120);
    const goal = input.goal ? shortText(input.goal, 1500) : undefined;
    const project = await this.persistence.create({ name });
    await this.authorize(project.id, true);
    // Creation and goal setup are separately acknowledged; never duplicate a project on goal failure.
    if (goal) {
      try {
        await this.brain.setGoal(project.id, goal);
      } catch {
        return { project, goalSaved: false };
      }
    }
    return { project, goalSaved: true };
  }
  async open(projectId: string, conversationId?: string) {
    await this.authorize(projectId);
    const [snapshot, brain, activity] = await Promise.all([
      this.persistence.load(projectId),
      this.brain.snapshot(projectId, conversationId),
      this.persistence.activity(projectId),
    ]);
    if (snapshot.project.id !== projectId || activity.some((a) => a.projectId !== projectId))
      throw new Error("PROJECT_ACCESS_DENIED");
    const ownedConversations = new Set(activity.map((a) => a.id));
    return {
      project: snapshot.project,
      assets: snapshot.assets,
      brain,
      activity,
      messages: (snapshot.messages ?? []).filter((row) =>
        ownedConversations.has(row.conversationId),
      ),
    };
  }
  async edit(projectId: string, input: { name?: string; goal?: string }) {
    await this.authorize(projectId, true);
    if (input.name !== undefined)
      await this.persistence.rename(projectId, shortText(input.name, 120));
    if (input.goal !== undefined) await this.brain.setGoal(projectId, shortText(input.goal, 1500));
    return this.open(projectId);
  }
  async context(projectId: string, conversationId?: string) {
    await this.authorize(projectId, true);
    return this.brain.buildContext(projectId, { conversationId, maxCharacters: 12000 });
  }
  async memoryControl(
    value: unknown,
  ): Promise<{ settings: MemorySettings; memories: Awaited<ReturnType<MemoryService["list"]>> }> {
    const input = object(value);
    const allowed = ["action", "scope", "id", "patch", "settings"];
    if (Object.keys(input).some((key) => !allowed.includes(key)))
      throw new Error("INVALID_MEMORY_INPUT");
    const scope = scopeSchema.parse(input.scope);
    if (scope.kind !== "user") await this.authorize(scope.projectId);
    if (scope.kind === "conversation")
      await this.brain.snapshot(scope.projectId, scope.conversationId);
    if (input.action === "list") {
      const [settings, memories] = await Promise.all([
        this.memory.settings(),
        this.memory.list({ scope, limit: 100 }),
      ]);
      return {
        settings,
        memories: memories.filter((r) => r.source.reference !== "xeomx.project-brain.v1"),
      };
    }
    if (input.action === "settings") {
      await this.memory.setSettings(input.settings as MemorySettings);
    } else {
      const id = uuid(input.id);
      const record = await this.memory.get(id);
      if (
        !record ||
        !sameScope(record.scope, scope) ||
        record.source.reference === "xeomx.project-brain.v1"
      )
        throw new Error("MEMORY_ACCESS_DENIED");
      if (input.action === "edit") await this.memory.update(id, input.patch as MemoryPatch);
      else if (input.action === "archive") await this.memory.archive(id);
      else if (input.action === "delete") await this.memory.delete(id);
      else throw new Error("INVALID_MEMORY_INPUT");
    }
    return this.memoryControl({ action: "list", scope }) as Promise<{
      settings: MemorySettings;
      memories: Awaited<ReturnType<MemoryService["list"]>>;
    }>;
  }
}
export type ProjectsHomeData = Awaited<ReturnType<ProjectsService["home"]>>;
export type ProjectWorkspaceData = Awaited<ReturnType<ProjectsService["open"]>>;
export type MemoryControlScope = MemoryScope;
