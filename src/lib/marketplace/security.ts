import type { MarketplacePackageManifest } from "./contracts.ts";
export class MarketplaceRuntimePolicy {
  authorize(manifest: MarketplacePackageManifest, approvedPermissions: readonly string[] = []) {
    const approved = new Set(approvedPermissions);
    for (const permission of manifest.permissions) {
      if (permission.risk === "safe_read") continue;
      if (!approved.has(permission.id)) throw Error("MARKETPLACE_APPROVAL_REQUIRED");
    }
    return {
      packageId: manifest.packageId,
      version: manifest.version,
      permissions: manifest.permissions.map((x) => x.id),
    };
  }
}
