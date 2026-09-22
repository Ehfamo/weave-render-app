import type { MarketplacePackageManifest } from "./contracts.ts";
const ID = /^[a-z0-9][a-z0-9.-]{2,100}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const FORBIDDEN_PERMISSIONS = new Set([
  "shell",
  "sql",
  "network.unrestricted",
  "filesystem.unrestricted",
  "role.elevate",
  "production.deploy",
  "secrets.read",
]);
const SECRET =
  /(?:api[_-]?key|secret|password|private[_-]?key|service[_-]?role|bearer\s+[a-z0-9._-]+)/i;
export function canonicalManifestValue(manifest: MarketplacePackageManifest) {
  const value = structuredClone(manifest) as MarketplacePackageManifest;
  value.integrity.digest = "";
  delete value.publishedAt;
  const sort = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(sort)
      : input && typeof input === "object"
        ? Object.fromEntries(
            Object.entries(input)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, child]) => [key, sort(child)]),
          )
        : input;
  return JSON.stringify(sort(value));
}
export function manifestIntegrity(manifest: MarketplacePackageManifest) {
  let hash = 2166136261;
  for (const char of canonicalManifestValue(manifest)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export class MarketplaceValidationService {
  validate(
    manifest: MarketplacePackageManifest,
    available: ReadonlyMap<string, readonly string[]> = new Map(),
  ) {
    const errors: string[] = [];
    if (!ID.test(manifest.packageId) || !VERSION.test(manifest.version))
      errors.push("INVALID_ID_OR_VERSION");
    if (!manifest.title.trim() || !manifest.summary.trim() || !manifest.description.trim())
      errors.push("MISSING_DESCRIPTION");
    if (
      manifest.compatibility.runtime !== "xeomx" ||
      manifest.compatibility.objectAdapter !== manifest.objectType
    )
      errors.push("INCOMPATIBLE_RUNTIME");
    if (!manifest.license.identifier || !manifest.license.creatorDeclared)
      errors.push("INVALID_LICENSE");
    if (!manifest.provenance.creatorDeclaration || !manifest.provenance.kind)
      errors.push("INVALID_PROVENANCE");
    if (!manifest.previews.length || manifest.previews.some((x) => SECRET.test(JSON.stringify(x))))
      errors.push("INVALID_PREVIEW");
    if (manifest.permissions.some((x) => FORBIDDEN_PERMISSIONS.has(x.id)))
      errors.push("FORBIDDEN_PERMISSION");
    if (SECRET.test(JSON.stringify(manifest.payload))) errors.push("SECRET_LEAKAGE");
    if (
      manifest.integrity.algorithm !== "xeomx-canonical-v1" ||
      manifest.integrity.digest !== manifestIntegrity(manifest)
    )
      errors.push("INTEGRITY_MISMATCH");
    for (const dependency of manifest.dependencies)
      if (
        !dependency.optional &&
        !(available.get(dependency.packageId) ?? []).includes(dependency.version)
      )
        errors.push("MISSING_DEPENDENCY");
    return { ok: errors.length === 0, errors: [...new Set(errors)] };
  }
  assertNoCycles(root: string, dependencies: ReadonlyMap<string, readonly string[]>) {
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) throw Error("DEPENDENCY_CYCLE");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const child of dependencies.get(id) ?? []) visit(child);
      visiting.delete(id);
      visited.add(id);
    };
    visit(root);
  }
}
