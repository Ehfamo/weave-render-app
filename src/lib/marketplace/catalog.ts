import type { JsonValue } from "../model-gateway/contracts.ts";
import type { MarketplacePackageManifest, MarketplaceListing } from "./contracts.ts";
export interface MarketplaceDisclosure {
  languages: string[];
  privacy?: {
    dataAccess: string[];
    destinations: string[];
    retention?: string;
    training?: string;
    region?: string;
  };
  mcp?: {
    tools: {
      name: string;
      schema: Record<string, JsonValue>;
      permissionIds: string[];
      consequential: boolean;
    }[];
    hosts: string[];
    credentialNames: string[];
  };
  signature?: { algorithm: string; keyId: string; value: string };
  trial?: { mode: "text"; providerRequired: true };
}
export type CatalogManifest = MarketplacePackageManifest & { disclosure: MarketplaceDisclosure };
export interface CatalogEntry {
  id: string;
  manifest: CatalogManifest;
  category: string;
  tags: string[];
  price: MarketplaceListing["price"] | null;
  visibility: "public" | "private" | "project";
  scopeProjectId?: string;
  state: "published" | "suspended" | "deprecated";
  createdAt: string;
}
export interface TrialRecord {
  id: string;
  versionId: string;
  userId: string;
  projectId?: string;
  state: "RUNNING" | "COMPLETED" | "FAILED" | "NOT_CONFIGURED" | "UNAVAILABLE";
  mode: "SAMPLE" | "PROJECT";
  requestHash: string;
  output?: string;
  errorCode?: string;
  createdAt: string;
}
export interface PermissionGrant {
  packageId: string;
  version: string;
  digest: string;
  permissions: CatalogManifest["permissions"];
}
/** Caller-bound port. Implementations enforce RLS and durable uniqueness; no production map store. */
export interface MarketplaceStore {
  readonly userId?: string;
  list(): Promise<CatalogEntry[]>;
  get(id: string): Promise<CatalogEntry | null>;
  publish(entry: CatalogEntry): Promise<CatalogEntry>;
  authorizeProject(id: string): Promise<void>;
  projectContext(id: string): Promise<string>;
  grant(packageId: string, projectId: string): Promise<PermissionGrant | null>;
  saveGrant(entry: CatalogEntry, projectId: string): Promise<void>;
  claimTrial(record: TrialRecord): Promise<{ claimed: boolean; record: TrialRecord }>;
  finishTrial(record: TrialRecord): Promise<TrialRecord>;
  hasTrial(versionId: string): Promise<boolean>;
  review(versionId: string, dimensions: Record<string, number>, text: string): Promise<void>;
  reviews(versionId: string): Promise<{ dimensions: Record<string, number>; text: string }[]>;
  continuation(
    id: string,
    kind: "job" | "conversation",
  ): Promise<{
    projectId: string;
    referenceId: string;
    kind: "job" | "conversation";
    goal: string;
  }>;
}
export const SANDBOX_LIMITS = Object.freeze({
  timeoutMs: 8000,
  maxToolCalls: 1,
  maxContextCharacters: 4000,
  maxOutputTokens: 512,
});
export interface MarketplaceTrialRuntime {
  run(
    input: {
      actorId: string;
      id: string;
      manifest: CatalogManifest;
      context: string;
      allowNetwork: boolean;
    },
    signal: AbortSignal,
  ): Promise<{ state: TrialRecord["state"]; output?: string; errorCode?: string }>;
}
