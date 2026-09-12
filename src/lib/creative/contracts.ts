import type { RoutingMode } from "../model-gateway/contracts.ts";
export type CreativeAssetType =
  "image" | "video" | "audio" | "voice" | "document" | "generation-output";
export interface AssetReference {
  assetId: string;
  role: "source" | "character" | "voice" | "brand" | "output";
  version: number;
}
export interface CreativeAsset {
  id: string;
  ownerId: string;
  projectId: string;
  type: CreativeAssetType;
  name: string;
  status: "active" | "archived";
  mimeType?: string;
  generationId?: string;
  parentAssetId?: string;
  metadata: Record<string, unknown>;
  provenance: { kind: "upload" | "generation" | "reference"; sourceId?: string };
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface CharacterReference {
  id: string;
  projectId: string;
  name: string;
  assetIds: string[];
  visualTraits: Record<string, string>;
  lookAssetIds: string[];
  approvedVariationAssetIds: string[];
  continuityNotes: string[];
  version: number;
  provenance: string;
}
export interface VoiceReference {
  id: string;
  projectId: string;
  name: string;
  assetIds: string[];
  style: string;
  instructions: string[];
  memoryId?: string;
}
export interface BrandReference {
  id: string;
  projectId: string;
  name: string;
  assetIds: string[];
  colors: string[];
  style: string;
  instructions: string[];
  memoryId?: string;
}
export interface CreativePrompt {
  text: string;
  negative?: string;
  format?: string;
  durationSeconds?: number;
}
export interface CreativeGenerationRequest {
  id: string;
  userId: string;
  projectId: string;
  intent: "image" | "video" | "audio" | "voice";
  prompt: CreativePrompt;
  references: AssetReference[];
  characterIds: string[];
  voiceId?: string;
  brandId?: string;
  quality: RoutingMode;
  createdAt: string;
}
export interface CreativeGenerationResult {
  requestId: string;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  assetId?: string;
  errorCode?: string;
  version: number;
  parentGenerationId?: string;
  createdAt: string;
}
export interface TimelineItem {
  id: string;
  sceneId: string;
  trackId: string;
  assetId?: string;
  start: number;
  duration: number;
  order: number;
  prompt?: string;
  transition?: { kind: "cut" | "fade" | "dissolve"; duration: number };
  status: "active" | "archived";
}
export interface TimelineTrack {
  id: string;
  kind: "video" | "audio" | "voice" | "text";
  order: number;
  items: TimelineItem[];
}
export interface CreativeScene {
  id: string;
  name: string;
  order: number;
  notes: string;
}
export interface Timeline {
  id: string;
  projectId: string;
  version: number;
  scenes: CreativeScene[];
  tracks: TimelineTrack[];
  updatedAt: string;
}
export interface CreativeWorkspace {
  projectId: string;
  selectedAssetId?: string;
  selectedCharacterIds: string[];
  selectedVoiceId?: string;
  selectedBrandId?: string;
  timeline: Timeline;
}
export interface CreativeProjectState {
  workspace: CreativeWorkspace;
  assets: CreativeAsset[];
  characters: CharacterReference[];
  voices: VoiceReference[];
  brands: BrandReference[];
  generations: CreativeGenerationResult[];
  context: string;
}
