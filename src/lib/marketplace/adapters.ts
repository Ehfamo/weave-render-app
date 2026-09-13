import type { MarketplaceObjectType, MarketplacePackageManifest } from "./contracts.ts";
export interface MarketplaceObjectAdapter {
  type: MarketplaceObjectType;
  canonicalTarget: string;
  import(manifest: MarketplacePackageManifest, projectId: string): Promise<{ referenceId: string }>;
}
export const MARKETPLACE_ADAPTER_TARGETS: Readonly<Record<MarketplaceObjectType, string>> =
  Object.freeze({
    prompt: "Prompt",
    workflow: "AutomationWorkflow",
    skill: "SkillDefinition",
    agent: "AgentDefinition",
    template: "CreativeProjectState",
    character: "CharacterReference",
    voice: "VoiceReference",
    "creative-asset": "CreativeAsset",
  });
export function restrictedObjectAdapter(
  type: MarketplaceObjectType,
  importer: MarketplaceObjectAdapter["import"],
): MarketplaceObjectAdapter {
  return {
    type,
    canonicalTarget: MARKETPLACE_ADAPTER_TARGETS[type],
    async import(manifest, projectId) {
      if (manifest.objectType !== type || manifest.compatibility.objectAdapter !== type)
        throw Error("ADAPTER_MISMATCH");
      return importer(structuredClone(manifest), projectId);
    },
  };
}
