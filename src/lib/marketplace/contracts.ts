import type { JsonValue } from "../model-gateway/contracts.ts";
export const MARKETPLACE_OBJECT_TYPES = [
  "prompt",
  "workflow",
  "skill",
  "agent",
  "template",
  "character",
  "voice",
  "creative-asset",
] as const;
export type MarketplaceObjectType = (typeof MARKETPLACE_OBJECT_TYPES)[number];
export type MarketplaceState =
  | "draft"
  | "validating"
  | "valid"
  | "invalid"
  | "review_required"
  | "approved"
  | "rejected"
  | "published"
  | "deprecated";
export interface MarketplaceDependency {
  packageId: string;
  version: string;
  optional: boolean;
}
export interface MarketplacePermissionDeclaration {
  id: string;
  reason: string;
  risk: "safe_read" | "write" | "external" | "sensitive";
}
export interface MarketplaceLicense {
  identifier: string;
  commercialUse: boolean;
  redistribution: boolean;
  attributionRequired: boolean;
  creatorDeclared: boolean;
}
export interface MarketplaceProvenance {
  kind: "creator-owned" | "user-supplied" | "generated" | "derived" | "imported-reference";
  sourceReferences: readonly string[];
  creatorDeclaration: string;
}
export interface MarketplaceCompatibility {
  runtime: "xeomx";
  minimumVersion: string;
  objectAdapter: MarketplaceObjectType;
}
export interface MarketplacePreview {
  kind: "sample" | "steps" | "capabilities" | "media" | "summary";
  references: readonly string[];
  publicData: JsonValue;
}
export interface MarketplacePackageManifest {
  packageId: string;
  objectType: MarketplaceObjectType;
  version: string;
  creatorId: string;
  title: string;
  summary: string;
  description: string;
  compatibility: MarketplaceCompatibility;
  dependencies: readonly MarketplaceDependency[];
  permissions: readonly MarketplacePermissionDeclaration[];
  requiredSkills: readonly string[];
  requiredTools: readonly string[];
  license: MarketplaceLicense;
  provenance: MarketplaceProvenance;
  previews: readonly MarketplacePreview[];
  changelog: string;
  payload: JsonValue;
  integrity: { algorithm: "xeomx-canonical-v1"; digest: string };
  createdAt: string;
  publishedAt?: string;
}
export interface MarketplacePackage {
  id: string;
  ownerId: string;
  state: MarketplaceState;
  currentVersion: string;
  createdAt: string;
  updatedAt: string;
}
export interface MarketplaceVersion {
  id: string;
  packageId: string;
  version: string;
  state: MarketplaceState;
  manifest: MarketplacePackageManifest;
  createdAt: string;
}
export interface MarketplacePrice {
  kind: "FREE" | "ONE_TIME_CREDITS" | "ONE_TIME_PRICE" | "SUBSCRIPTION_INCLUDED";
  amount: number;
  currency: "CREDITS" | string;
}
export interface MarketplaceListing {
  id: string;
  packageId: string;
  version: string;
  creatorId: string;
  state: "draft" | "published" | "suspended" | "deprecated";
  category: string;
  tags: readonly string[];
  price: MarketplacePrice;
  ratingCount: number;
  ratingTotal: number;
  publishedAt?: string;
}
export interface MarketplaceAcquisition {
  id: string;
  idempotencyKey: string;
  buyerId: string;
  listingId: string;
  packageId: string;
  version: string;
  amount: number;
  status: "active" | "refunded" | "disputed";
  createdAt: string;
}
export interface MarketplaceEntitlement {
  id: string;
  buyerId: string;
  packageId: string;
  version: string;
  acquisitionId: string;
  status: "active" | "revoked";
}
export interface MarketplaceInstall {
  id: string;
  projectId: string;
  buyerId: string;
  packageId: string;
  version: string;
  adapter: MarketplaceObjectType;
  status: "installed" | "failed";
  createdAt: string;
}
export interface MarketplaceLedgerEntry {
  id: string;
  acquisitionId: string;
  creatorId: string;
  type: "sale" | "refund" | "dispute-adjustment";
  gross: number;
  commission: number;
  creatorAmount: number;
  createdAt: string;
}
export interface MarketplaceReview {
  id: string;
  listingId: string;
  authorId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  status: "active" | "reported" | "removed";
  updatedAt: string;
}
export interface MarketplaceModerationDecision {
  id: string;
  versionId: string;
  actorId: string;
  decision: "approved" | "rejected" | "suspended" | "deprecated";
  reason: string;
  createdAt: string;
}
