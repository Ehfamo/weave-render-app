import type {
  CatalogEntry,
  CatalogManifest,
  MarketplaceStore,
  MarketplaceTrialRuntime,
  TrialRecord,
} from "./catalog.ts";
import { SANDBOX_LIMITS } from "./catalog.ts";
import { packageDigest, sha256, validatePublishedPackage, verifyPackage } from "./integrity.ts";
import {
  detectDuplicateSignals,
  evaluateCompatibility,
  matchGoalToCapabilities,
  rankMarketplaceCandidates,
} from "../intelligence/marketplace.ts";
import { MarketplaceValidationService } from "./validation.ts";
import type { MarketplaceContext } from "../intelligence/marketplace.ts";
import type { MarketplaceListing } from "./contracts.ts";

const context = (locale = "en"): MarketplaceContext => ({
  runtimeVersion: "1.0.0",
  installedPackages: {},
  allowedPermissions: new Set(),
  locale,
  capabilities: [],
});
export const SAFE_TRIAL_CONTEXT =
  "Sample project: plan a community garden. Audience: volunteers. No private user, project, conversation, files or memory data.";
const dimensions = new Set([
  "usefulness",
  "reliability",
  "setup",
  "documentation",
  "value",
  "support",
]);
export class MarketplaceService {
  private readonly store: MarketplaceStore;
  private readonly trialRuntime: MarketplaceTrialRuntime;
  private readonly now: () => string;
  constructor(
    store: MarketplaceStore,
    trialRuntime: MarketplaceTrialRuntime,
    now = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.trialRuntime = trialRuntime;
    this.now = now;
  }
  private actor() {
    if (!this.store.userId) throw Error("AUTH_REQUIRED");
    return this.store.userId;
  }
  private async entry(id: string) {
    const entry = await this.store.get(id);
    if (!entry || entry.state !== "published") throw Error("CAPABILITY_UNAVAILABLE");
    await verifyPackage(entry.manifest);
    return entry;
  }
  async publish(entry: CatalogEntry) {
    if (entry.manifest.creatorId !== this.actor()) throw Error("OWNER_REQUIRED");
    if (entry.visibility === "project") {
      if (!entry.scopeProjectId) throw Error("PROJECT_ACCESS_DENIED");
      await this.store.authorizeProject(entry.scopeProjectId);
    } else if (entry.scopeProjectId) throw Error("INVALID_SCOPE");
    if (!["public", "private", "project"].includes(entry.visibility) || entry.state !== "published")
      throw Error("INVALID_METADATA");
    if (
      entry.category.length > 80 ||
      entry.tags.length > 30 ||
      entry.tags.some((x) => typeof x !== "string" || x.length > 80) ||
      !Number.isFinite(Date.parse(entry.createdAt))
    )
      throw Error("INVALID_METADATA");
    if (
      entry.price &&
      (!["FREE", "ONE_TIME_PRICE", "ONE_TIME_CREDITS", "SUBSCRIPTION_INCLUDED"].includes(
        entry.price.kind,
      ) ||
        !Number.isFinite(entry.price.amount) ||
        entry.price.amount < 0 ||
        (entry.price.kind === "FREE" && entry.price.amount !== 0) ||
        !entry.price.currency ||
        entry.price.currency.length > 20)
    )
      throw Error("INVALID_PRICE");
    const rows = await this.store.list();
    const available = new Map<string, string[]>();
    for (const item of rows)
      available.set(item.manifest.packageId, [
        ...(available.get(item.manifest.packageId) ?? []),
        item.manifest.version,
      ]);
    await validatePublishedPackage(entry.manifest, available);
    await this.dependencies(entry, rows);
    return this.store.publish(entry);
  }
  async discover(
    input: {
      goal?: string;
      type?: string;
      category?: string;
      locale?: string;
      compatibleOnly?: boolean;
      freeOnly?: boolean;
    } = {},
  ) {
    const goal = (input.goal ?? "").trim().slice(0, 500);
    const capabilities = matchGoalToCapabilities(goal);
    const rows = (await this.store.list()).filter(
      (x) =>
        x.state === "published" &&
        (!input.type || x.manifest.objectType === input.type) &&
        (!input.category || x.category === input.category) &&
        (!input.locale || x.manifest.disclosure.languages.includes(input.locale)) &&
        (!input.freeOnly || x.price?.kind === "FREE"),
    );
    const candidates = [];
    for (const entry of rows) {
      try {
        await verifyPackage(entry.manifest);
      } catch {
        continue;
      }
      const haystack = `${entry.manifest.title} ${entry.manifest.summary} ${entry.tags.join(" ")}`
        .normalize("NFKC")
        .toLowerCase();
      const intent = capabilities
        .filter((x) => x !== "marketplace.search")
        .some((x) => haystack.includes(x.split(".")[0]));
      const keyword =
        !goal ||
        goal
          .toLowerCase()
          .split(/\s+/)
          .some((x) => x.length > 1 && haystack.includes(x));
      if (!intent && !keyword) continue;
      // P9 ranking heuristic is never presented as a quality/reliability score.
      const listing: MarketplaceListing = {
        id: entry.id,
        packageId: entry.manifest.packageId,
        version: entry.manifest.version,
        creatorId: entry.manifest.creatorId,
        state: entry.state,
        category: entry.category,
        tags: entry.tags,
        price: entry.price ?? { kind: "ONE_TIME_PRICE", amount: 0, currency: "UNKNOWN" },
        ratingCount: 0,
        ratingTotal: 0,
      };
      candidates.push({ listing, manifest: entry.manifest });
    }
    return rankMarketplaceCandidates({
      goal,
      candidates,
      context: { ...context(input.locale), capabilities },
    })
      .filter((x) => !input.compatibleOnly || x.compatibility.state === "COMPATIBLE")
      .map((x) => {
        const entry = rows.find((r) => r.id === x.listing.id)!;
        return {
          id: entry.id,
          title: entry.manifest.title,
          summary: entry.manifest.summary,
          type: entry.manifest.objectType,
          version: entry.manifest.version,
          category: entry.category,
          languages: entry.manifest.disclosure.languages,
          price: entry.price,
          compatibility: x.compatibility,
          reasons: ["GOAL_METADATA_MATCH", ...x.evidence],
          unknownEvidence: x.unknownSignals,
        };
      });
  }
  async dependencies(entry: CatalogEntry, supplied?: CatalogEntry[]) {
    const rows = supplied ?? (await this.store.list());
    const key = (m: CatalogManifest) => `${m.packageId}@${m.version}`;
    const all = new Map(
      rows.filter((x) => x.state === "published").map((x) => [key(x.manifest), x]),
    );
    all.set(key(entry.manifest), entry);
    const graph = new Map<string, string[]>();
    const inspected = new Set<string>();
    const walk = async (item: CatalogEntry, depth = 0): Promise<void> => {
      if (depth > 20 || inspected.size > 100) throw Error("DEPENDENCY_LIMIT");
      const id = key(item.manifest);
      if (inspected.has(id)) return;
      inspected.add(id);
      await verifyPackage(item.manifest);
      graph.set(id, []);
      for (const dep of item.manifest.dependencies) {
        const target = all.get(`${dep.packageId}@${dep.version}`);
        if (!target) {
          if (!dep.optional) throw Error("MISSING_DEPENDENCY");
          continue;
        }
        graph.get(id)!.push(key(target.manifest));
        await walk(target, depth + 1);
      }
    };
    await walk(entry);
    new MarketplaceValidationService().assertNoCycles(key(entry.manifest), graph);
    return [...graph].map(([id, requires]) => ({ id, requires }));
  }
  async details(id: string) {
    const entry = await this.entry(id),
      manifest = entry.manifest;
    let dependencyState = "RESOLVED",
      graph: { id: string; requires: string[] }[] = [];
    try {
      graph = await this.dependencies(entry);
    } catch {
      dependencyState = "INVALID_DEPENDENCIES";
    }
    const reviews = await this.store.reviews(id);
    const privacy = manifest.disclosure.privacy;
    const signals = detectDuplicateSignals(
      manifest,
      (await this.store.list())
        .filter((x) => x.manifest.packageId !== manifest.packageId)
        .map((x) => x.manifest),
    ).flags.map((x) => x.code);
    if (!privacy) signals.push("INCOMPLETE_PRIVACY_DECLARATION");
    if (!manifest.disclosure.signature) signals.push("UNSIGNED_PACKAGE");
    if (manifest.permissions.some((x) => x.risk === "sensitive" || x.risk === "external"))
      signals.push("CONSEQUENTIAL_PERMISSIONS");
    if (dependencyState !== "RESOLVED") signals.push("BROKEN_DEPENDENCY");
    if (this.now() > new Date(Date.parse(entry.createdAt) + 365 * 86400000).toISOString())
      signals.push("MAINTENANCE_REVIEW");
    return {
      id,
      title: manifest.title,
      summary: manifest.summary,
      description: manifest.description,
      version: manifest.version,
      packageId: manifest.packageId,
      type: manifest.objectType,
      publisherId: manifest.creatorId,
      category: entry.category,
      versions: (await this.store.list())
        .filter((x) => x.manifest.packageId === manifest.packageId)
        .map((x) => ({ id: x.id, version: x.manifest.version })),
      compatibility: evaluateCompatibility(manifest, context()),
      permissions: manifest.permissions,
      dependencies: manifest.dependencies,
      graph,
      dependencyState,
      requirements: {
        skills: manifest.requiredSkills,
        tools: manifest.requiredTools,
        network: manifest.disclosure.mcp?.hosts ?? [],
        credentials: manifest.disclosure.mcp?.credentialNames ?? [],
        providerRequired: !!manifest.disclosure.trial,
      },
      privacy: privacy ?? {
        dataAccess: [],
        destinations: [],
        retention: "NOT_DECLARED",
        training: "NOT_DECLARED",
        region: "NOT_DECLARED",
      },
      privacyState: privacy ? "PUBLISHER_DECLARED" : "NOT_DECLARED",
      trust: {
        publisher: "NOT_VERIFIED",
        integrity: "VERIFIED",
        signature: manifest.disclosure.signature ? "NOT_VERIFIED" : "NOT_CONFIGURED",
        permissions: "PUBLISHER_DECLARED",
        privacy: privacy ? "PUBLISHER_DECLARED" : "NOT_DECLARED",
        dependencies: dependencyState,
        security: "NOT_EVALUATED",
        reliability: "NOT_ENOUGH_DATA",
        maintenance: entry.createdAt,
        reviews: reviews.length ? "VERSION_TRIAL_VERIFIED" : "NOT_ENOUGH_DATA",
      },
      digest: manifest.integrity.digest,
      signature: manifest.disclosure.signature
        ? {
            algorithm: manifest.disclosure.signature.algorithm,
            keyId: manifest.disclosure.signature.keyId,
          }
        : null,
      provenance: manifest.provenance,
      license: manifest.license,
      mcp: manifest.disclosure.mcp ?? null,
      signals: [...new Set(signals)],
      moderation: signals.length ? "REVIEW_SUGGESTED" : "NOT_EVALUATED",
      price: entry.price,
      runtimeCost: "UNKNOWN",
      reviews,
      trial: {
        eligible: this.trialEligible(manifest) && dependencyState === "RESOLVED",
        limits: SANDBOX_LIMITS,
        defaultContext: "SAMPLE",
        network: "CONFIGURED_MODEL_GATEWAY_ONLY",
      },
      reviewEligibility:
        this.store.userId &&
        this.store.userId !== manifest.creatorId &&
        (await this.store.hasTrial(id))
          ? "ELIGIBLE"
          : "NOT_ENOUGH_DATA",
    };
  }
  private trialEligible(m: CatalogManifest) {
    return (
      evaluateCompatibility(m, context()).state !== "INCOMPATIBLE" &&
      m.disclosure.trial?.mode === "text" &&
      ["prompt", "template", "agent", "skill"].includes(m.objectType) &&
      !m.disclosure.mcp &&
      !m.requiredTools.some((x) => x !== "model.reason") &&
      m.permissions.every(
        (x) => ["model.reason", "project.read"].includes(x.id) && x.risk === "safe_read",
      ) &&
      typeof m.payload === "object" &&
      m.payload !== null &&
      !Array.isArray(m.payload) &&
      typeof m.payload.prompt === "string"
    );
  }
  async readiness(id: string, projectId: string) {
    this.actor();
    await this.store.authorizeProject(projectId);
    const entry = await this.entry(id);
    await this.dependencies(entry);
    if (evaluateCompatibility(entry.manifest, context()).state === "INCOMPATIBLE")
      throw Error("INCOMPATIBLE_RUNTIME");
    const grant = await this.store.grant(entry.manifest.packageId, projectId);
    return {
      state: !grant
        ? "APPROVAL_REQUIRED"
        : grant.digest !== entry.manifest.integrity.digest ||
            grant.version !== entry.manifest.version
          ? "REAPPROVAL_REQUIRED"
          : "READY_FOR_ACQUISITION",
      installed: false,
      purchased: false,
    };
  }
  async approvePermissions(id: string, projectId: string, digest: string, approvedIds: string[]) {
    this.actor();
    await this.store.authorizeProject(projectId);
    const entry = await this.entry(id);
    await this.dependencies(entry);
    if (
      digest !== entry.manifest.integrity.digest ||
      [...new Set(approvedIds)].sort().join() !==
        entry.manifest.permissions
          .map((x) => x.id)
          .sort()
          .join()
    )
      throw Error("MARKETPLACE_APPROVAL_REQUIRED");
    await this.store.saveGrant(entry, projectId);
    return this.readiness(id, projectId);
  }
  async trial(input: {
    id: string;
    versionId: string;
    projectId?: string;
    usePrivateContext?: boolean;
    allowNetwork?: boolean;
    approvedPermissionIds: string[];
  }) {
    const userId = this.actor(),
      entry = await this.entry(input.versionId);
    await this.dependencies(entry);
    if (!this.trialEligible(entry.manifest)) throw Error("TRIAL_UNAVAILABLE");
    if (entry.manifest.permissions.some((x) => !input.approvedPermissionIds.includes(x.id)))
      throw Error("MARKETPLACE_APPROVAL_REQUIRED");
    let trialContext = SAFE_TRIAL_CONTEXT;
    if (input.usePrivateContext) {
      if (!input.projectId || !entry.manifest.permissions.some((x) => x.id === "project.read"))
        throw Error("PRIVATE_CONTEXT_APPROVAL_REQUIRED");
      await this.store.authorizeProject(input.projectId);
      trialContext = (await this.store.projectContext(input.projectId)).slice(
        0,
        SANDBOX_LIMITS.maxContextCharacters,
      );
    }
    const requestHash = await sha256(
      JSON.stringify({
        versionId: input.versionId,
        digest: entry.manifest.integrity.digest,
        mode: !!input.usePrivateContext,
        projectId: input.usePrivateContext ? input.projectId : null,
        network: !!input.allowNetwork,
      }),
    );
    const record: TrialRecord = {
      id: input.id,
      versionId: input.versionId,
      userId,
      ...(input.usePrivateContext ? { projectId: input.projectId } : {}),
      state: "RUNNING",
      mode: input.usePrivateContext ? "PROJECT" : "SAMPLE",
      requestHash,
      createdAt: this.now(),
    };
    const claimed = await this.store.claimTrial(record);
    if (!claimed.claimed) return claimed.record;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.trialRuntime.run(
          {
            actorId: userId,
            id: input.id,
            manifest: entry.manifest,
            context: trialContext,
            allowNetwork: input.allowNetwork === true,
          },
          controller.signal,
        ),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(Error("TRIAL_TIMEOUT"));
          }, SANDBOX_LIMITS.timeoutMs);
        }),
      ]);
      if (result.state === "RUNNING" || (result.state === "COMPLETED" && !result.output))
        throw Error("INVALID_TRIAL_RESULT");
      return await this.store.finishTrial({
        ...record,
        state: result.state,
        output: result.output?.slice(0, 8000),
        ...(result.errorCode
          ? {
              errorCode: ["NOT_CONFIGURED", "NETWORK_APPROVAL_REQUIRED", "UNAVAILABLE"].includes(
                result.errorCode,
              )
                ? result.errorCode
                : "TRIAL_FAILED",
            }
          : {}),
      });
    } catch {
      return this.store.finishTrial({ ...record, state: "FAILED", errorCode: "TRIAL_FAILED" });
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
  async review(id: string, values: Record<string, number>, text: string) {
    const actor = this.actor(),
      entry = await this.entry(id);
    if (entry.manifest.creatorId === actor || !(await this.store.hasTrial(id)))
      throw Error("REVIEW_NOT_ELIGIBLE");
    if (
      !Object.keys(values).length ||
      Object.entries(values).some(
        ([k, v]) => !dimensions.has(k) || !Number.isInteger(v) || v < 1 || v > 5,
      ) ||
      text.trim().length < 2 ||
      text.length > 2000
    )
      throw Error("INVALID_REVIEW");
    await this.store.review(id, values, text.trim());
  }
  async recommend(referenceId: string, kind: "job" | "conversation", locale?: string) {
    this.actor();
    const original = await this.store.continuation(referenceId, kind);
    await this.store.authorizeProject(original.projectId);
    const recommendations = await this.discover({ goal: original.goal, locale });
    // No private goal/context in the URL, listing payload, trace or recommendation response.
    return {
      recommendations,
      continuation: {
        projectId: original.projectId,
        referenceId: original.referenceId,
        kind: original.kind,
      },
      autoInstall: false,
      autoBuy: false,
    };
  }
}
export { packageDigest };
