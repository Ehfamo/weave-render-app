import type { ProjectBrainService } from "../project-brain/service.ts";
import type { AssetLibrary } from "./asset-library.ts";
import type {
  BrandReference,
  CharacterReference,
  CreativeGenerationRequest,
  CreativeGenerationResult,
  CreativeProjectState,
  CreativeWorkspace,
  Timeline,
  VoiceReference,
} from "./contracts.ts";
import { normalizeTimeline } from "./timeline.ts";
export interface CreativeStatePort {
  userId: string;
  canEditProject(id: string): Promise<boolean>;
  loadWorkspace(id: string): Promise<CreativeWorkspace | null>;
  saveWorkspace(value: CreativeWorkspace): Promise<void>;
  listCharacters(id: string): Promise<CharacterReference[]>;
  listVoices(id: string): Promise<VoiceReference[]>;
  listBrands(id: string): Promise<BrandReference[]>;
  listGenerations(id: string): Promise<CreativeGenerationResult[]>;
  submitGeneration(input: CreativeGenerationRequest): Promise<CreativeGenerationResult>;
}
export class CreativeWorkspaceService {
  private port: CreativeStatePort;
  private assets: AssetLibrary;
  private brain: ProjectBrainService;
  constructor(port: CreativeStatePort, assets: AssetLibrary, brain: ProjectBrainService) {
    this.port = port;
    this.assets = assets;
    this.brain = brain;
  }
  private async edit(id: string) {
    if (!(await this.port.canEditProject(id))) throw Error("CREATIVE_ACCESS_DENIED");
  }
  async load(projectId: string): Promise<CreativeProjectState> {
    await this.edit(projectId);
    const [workspace, assets, characters, voices, brands, generations, snapshot] =
      await Promise.all([
        this.port.loadWorkspace(projectId),
        this.assets.list(projectId),
        this.port.listCharacters(projectId),
        this.port.listVoices(projectId),
        this.port.listBrands(projectId),
        this.port.listGenerations(projectId),
        this.brain.snapshot(projectId),
      ]);
    if (!workspace) throw Error("WORKSPACE_NOT_FOUND");
    for (const rows of [characters, voices, brands])
      if (rows.some((x) => x.projectId !== projectId)) throw Error("CREATIVE_SCOPE_MISMATCH");
    const context = [
      snapshot.summary.text,
      ...snapshot.instructions.map((x) => x.text),
      ...snapshot.constraints.map((x) => x.text),
    ]
      .join("\n")
      .slice(0, 20_000);
    return {
      workspace: { ...workspace, timeline: normalizeTimeline(workspace.timeline) },
      assets,
      characters,
      voices,
      brands,
      generations,
      context,
    };
  }
  async saveTimeline(projectId: string, timeline: Timeline) {
    await this.edit(projectId);
    if (timeline.projectId !== projectId) throw Error("CREATIVE_SCOPE_MISMATCH");
    const current = await this.port.loadWorkspace(projectId);
    if (!current) throw Error("WORKSPACE_NOT_FOUND");
    await this.port.saveWorkspace({ ...current, timeline: normalizeTimeline(timeline) });
  }
  async requestGeneration(input: CreativeGenerationRequest) {
    await this.edit(input.projectId);
    if (
      input.userId !== this.port.userId ||
      input.prompt.text.trim().length < 1 ||
      input.prompt.text.length > 20_000 ||
      input.references.length > 20
    )
      throw Error("INVALID_GENERATION_REQUEST");
    const state = await this.load(input.projectId),
      assetIds = new Set(state.assets.map((a) => a.id));
    if (
      input.references.some((r) => !assetIds.has(r.assetId)) ||
      input.characterIds.some((id) => !state.characters.some((c) => c.id === id)) ||
      (input.voiceId && !state.voices.some((v) => v.id === input.voiceId)) ||
      (input.brandId && !state.brands.some((b) => b.id === input.brandId))
    )
      throw Error("CREATIVE_REFERENCE_DENIED");
    return this.port.submitGeneration(structuredClone(input));
  }
  async selectReferences(
    projectId: string,
    value: { characterIds: string[]; voiceId?: string; brandId?: string },
  ) {
    await this.edit(projectId);
    const state = await this.load(projectId);
    if (
      value.characterIds.some((id) => !state.characters.some((c) => c.id === id)) ||
      (value.voiceId && !state.voices.some((v) => v.id === value.voiceId)) ||
      (value.brandId && !state.brands.some((b) => b.id === value.brandId))
    )
      throw Error("CREATIVE_REFERENCE_DENIED");
    await this.port.saveWorkspace({
      ...state.workspace,
      selectedCharacterIds: [...new Set(value.characterIds)],
      ...(value.voiceId ? { selectedVoiceId: value.voiceId } : {}),
      ...(value.brandId ? { selectedBrandId: value.brandId } : {}),
    });
  }
}
