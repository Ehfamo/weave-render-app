import type { MemoryService } from "../memory/service.ts";
import type { BrandReference, CharacterReference, VoiceReference } from "./contracts.ts";

export interface CreativeContinuityContext {
  characters: Array<{
    id: string;
    name: string;
    assets: string[];
    traits: Record<string, string>;
    notes: string[];
    version: number;
  }>;
  voice?: { id: string; style: string; instructions: string[] };
  brand?: { id: string; colors: string[]; style: string; instructions: string[] };
  memories: Array<{ id: string; type: string; content: string }>;
}

type RelevantMemory = Pick<MemoryService, "relevant">;

/** Builds bounded, project-scoped continuity context without duplicating memory state. */
export class CreativeConsistencyService {
  private memory: RelevantMemory;

  constructor(memory: RelevantMemory) {
    this.memory = memory;
  }

  async context(
    projectId: string,
    references: {
      characters: CharacterReference[];
      voice?: VoiceReference;
      brand?: BrandReference;
    },
  ): Promise<CreativeContinuityContext> {
    const scoped = [
      ...references.characters,
      ...(references.voice ? [references.voice] : []),
      ...(references.brand ? [references.brand] : []),
    ];
    if (scoped.some((reference) => reference.projectId !== projectId))
      throw new Error("CREATIVE_REFERENCE_DENIED");

    const matches = await this.memory.relevant({
      scope: { kind: "project", projectId },
      types: ["CharacterMemory", "VoiceMemory", "BrandMemory"],
      limit: 20,
    });
    const selectedMemoryIds = new Set(
      [references.voice?.memoryId, references.brand?.memoryId].filter((id): id is string =>
        Boolean(id),
      ),
    );

    return {
      characters: references.characters.map((character) => ({
        id: character.id,
        name: character.name,
        assets: [...new Set([...character.assetIds, ...character.lookAssetIds])],
        traits: { ...character.visualTraits },
        notes: character.continuityNotes.slice(0, 20),
        version: character.version,
      })),
      ...(references.voice
        ? {
            voice: {
              id: references.voice.id,
              style: references.voice.style,
              instructions: references.voice.instructions.slice(0, 20),
            },
          }
        : {}),
      ...(references.brand
        ? {
            brand: {
              id: references.brand.id,
              colors: references.brand.colors.slice(0, 20),
              style: references.brand.style,
              instructions: references.brand.instructions.slice(0, 20),
            },
          }
        : {}),
      memories: matches
        .filter(
          ({ memory }) => memory.type === "CharacterMemory" || selectedMemoryIds.has(memory.id),
        )
        .slice(0, 20)
        .map(({ memory }) => ({
          id: memory.id,
          type: memory.type,
          content: memory.content.slice(0, 2_000),
        })),
    };
  }
}
