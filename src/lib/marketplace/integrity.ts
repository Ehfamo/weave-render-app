import {
  canonicalManifestValue,
  manifestIntegrity,
  MarketplaceValidationService,
} from "./validation.ts";
import { MARKETPLACE_OBJECT_TYPES } from "./contracts.ts";
import type { CatalogManifest } from "./catalog.ts";

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function packageDigest(manifest: CatalogManifest) {
  return sha256(canonicalManifestValue(manifest));
}
export async function verifyPackage(manifest: CatalogManifest) {
  if (
    manifest.integrity.algorithm !== "sha256" ||
    !/^[a-f0-9]{64}$/.test(manifest.integrity.digest) ||
    manifest.integrity.digest !== (await packageDigest(manifest))
  )
    throw Error("INTEGRITY_MISMATCH");
}
export async function validatePublishedPackage(
  manifest: CatalogManifest,
  available: ReadonlyMap<string, readonly string[]>,
) {
  await verifyPackage(manifest);
  if (
    !MARKETPLACE_OBJECT_TYPES.includes(manifest.objectType) ||
    JSON.stringify(manifest).length > 64000
  )
    throw Error("INVALID_METADATA");
  // Reuse P6 content/license/provenance checks. Legacy fingerprint is never accepted at the trust boundary.
  const reference = structuredClone(manifest);
  reference.integrity = { algorithm: "xeomx-canonical-v1", digest: "" };
  reference.integrity.digest = manifestIntegrity(reference);
  const result = new MarketplaceValidationService().validate(reference, available);
  if (!result.ok) throw Error(result.errors[0]);
  if (
    !manifest.disclosure ||
    !Array.isArray(manifest.disclosure.languages) ||
    manifest.disclosure.languages.some((x) => !["en", "fa", "ar", "zh", "hi"].includes(x)) ||
    manifest.permissions.length > 30 ||
    manifest.dependencies.length > 30 ||
    new Set(manifest.permissions.map((x) => x.id)).size !== manifest.permissions.length ||
    manifest.permissions.some(
      (x) =>
        !/^[a-z][a-z0-9._-]{1,100}$/.test(x.id) ||
        !["safe_read", "write", "external", "sensitive"].includes(x.risk),
    )
  )
    throw Error("INVALID_METADATA");
  if (
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    manifest.title.length > 200 ||
    manifest.summary.length > 1000 ||
    manifest.description.length > 12000 ||
    !/^\d+\.\d+\.\d+$/.test(manifest.compatibility.minimumVersion)
  )
    throw Error("INVALID_METADATA");
  const disclosure = manifest.disclosure;
  if (
    disclosure.privacy &&
    (!Array.isArray(disclosure.privacy.dataAccess) ||
      !Array.isArray(disclosure.privacy.destinations))
  )
    throw Error("INVALID_PRIVACY");
  if (disclosure.mcp) {
    const { tools, hosts, credentialNames } = disclosure.mcp;
    if (
      !Array.isArray(tools) ||
      !Array.isArray(hosts) ||
      !Array.isArray(credentialNames) ||
      tools.length > 50 ||
      hosts.some((x) => !/^[a-z0-9.-]+$/.test(x)) ||
      credentialNames.some((x) => !/^[A-Z][A-Z0-9_]{1,80}$/.test(x)) ||
      tools.some(
        (x) =>
          !x.name ||
          !x.schema ||
          x.permissionIds.some((id) => !manifest.permissions.some((p) => p.id === id)),
      )
    )
      throw Error("INVALID_MCP_DISCLOSURE");
  }
  if (
    /-----BEGIN .*PRIVATE KEY-----|sk-[a-zA-Z0-9]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9_-]+\.eyJ/.test(
      JSON.stringify(manifest),
    )
  )
    throw Error("SECRET_LEAKAGE");
}
