import { MarketplaceService } from "../../src/lib/marketplace/service.ts";
import { packageDigest } from "../../src/lib/marketplace/integrity.ts";
import { session, actor, other } from "./fi2-fixture.mjs";
import { sandboxRuntime } from "../../src/lib/marketplace/sandbox.ts";
import { ModelGateway } from "../../src/lib/model-gateway/gateway.ts";
import { GlobalSearchService } from "../../src/lib/global-search/service.ts";
export { actor, other };
export async function entry(changes = {}, metadata = {}) {
  const manifest = {
    packageId: "garden.research",
    objectType: "prompt",
    version: "1.0.0",
    creatorId: actor,
    title: "Research assistant",
    summary: "Research capability for bounded synthesis",
    description: "Prepare a short research report from given data.",
    compatibility: { runtime: "xeomx", minimumVersion: "1.0.0", objectAdapter: "prompt" },
    dependencies: [],
    permissions: [{ id: "model.reason", reason: "Text synthesis", risk: "safe_read" }],
    requiredSkills: [],
    requiredTools: ["model.reason"],
    license: {
      identifier: "CC-BY-4.0",
      commercialUse: true,
      redistribution: true,
      attributionRequired: true,
      creatorDeclared: true,
    },
    provenance: {
      kind: "creator-owned",
      sourceReferences: [],
      creatorDeclaration: "Original instructions",
    },
    previews: [{ kind: "sample", references: [], publicData: "A sample report" }],
    changelog: "Initial release",
    payload: { prompt: "Summarize the supplied data." },
    integrity: { algorithm: "sha256", digest: "" },
    createdAt: "2026-09-22T00:00:00.000Z",
    disclosure: {
      languages: ["en", "fa", "ar", "zh", "hi"],
      trial: { mode: "text", providerRequired: true },
    },
    ...changes,
  };
  manifest.integrity = { algorithm: "sha256", digest: "" };
  manifest.integrity.digest = await packageDigest(manifest);
  return {
    id: crypto.randomUUID(),
    manifest,
    category: "research",
    tags: ["research"],
    price: null,
    visibility: "public",
    state: "published",
    createdAt: manifest.createdAt,
    ...metadata,
  };
}
export async function fixture() {
  const fi2 = session();
  const p = (
    await fi2.projects.create({ name: "Private project", goal: "Keep PRIVATE_CANARY campaign" })
  ).project.id;
  // An isolated sample identity for canonical ProjectBrainService, separate from real project data.
  fi2.db.projects.set(actor, {
    id: actor,
    name: "Sandbox sample",
    description: null,
    updatedAt: "2026-09-22T00:00:00.000Z",
  });
  fi2.db.members.set(`${actor}:${actor}`, "owner");
  const entries = new Map(),
    trials = new Map(),
    grants = new Map(),
    reviews = [],
    contexts = [],
    calls = [];
  const gateway = new ModelGateway([
    {
      provider: { id: "fixture", displayName: "Deterministic test provider" },
      async getHealth() {
        return { availability: "AVAILABLE", checkedAt: "2026-09-22T00:00:00.000Z" };
      },
      async discoverModels() {
        return [
          {
            identity: { providerId: "fixture", modelId: "text" },
            capabilities: ["text"],
            quality: 0.8,
            estimatedLatencyMs: 1,
          },
        ];
      },
      async execute(request) {
        calls.push(request);
        return { ok: true, output: { kind: "text", text: "Deterministic trial output" } };
      },
    },
  ]);
  const runtime = (gateway) =>
    sandboxRuntime(() => ({
      brain: fi2.brain,
      search: new GlobalSearchService([], {
        userId: actor,
        async canReadProject() {
          return false;
        },
      }),
      gateway,
    }));
  const trialRuntime = runtime(gateway);
  const visible = (item, who) =>
    item.visibility === "public" ||
    item.manifest.creatorId === who ||
    (item.visibility === "project" && fi2.db.members.has(`${who}:${item.scopeProjectId}`));
  function connect(who = actor, runtime = trialRuntime) {
    const port = {
      userId: who,
      async list() {
        return [...entries.values()].filter((e) => visible(e, who)).map((x) => structuredClone(x));
      },
      async get(id) {
        const e = entries.get(id);
        return e && visible(e, who) ? structuredClone(e) : null;
      },
      async publish(e) {
        if (
          [...entries.values()].some(
            (x) =>
              x.manifest.packageId === e.manifest.packageId &&
              (x.manifest.creatorId !== who || x.manifest.version === e.manifest.version),
          )
        )
          throw Error("IMMUTABLE_OR_OWNER");
        entries.set(e.id, structuredClone(e));
        return structuredClone(e);
      },
      async authorizeProject(id) {
        if (!fi2.db.members.has(`${who}:${id}`)) throw Error("PROJECT_ACCESS_DENIED");
      },
      async projectContext(id) {
        await this.authorizeProject(id);
        contexts.push(id);
        return (await fi2.brain.buildContext(id, { maxCharacters: 4000 })).text;
      },
      async grant(packageId, projectId) {
        return structuredClone(grants.get(`${who}:${projectId}:${packageId}`) ?? null);
      },
      async saveGrant(e, projectId) {
        grants.set(`${who}:${projectId}:${e.manifest.packageId}`, {
          packageId: e.manifest.packageId,
          version: e.manifest.version,
          digest: e.manifest.integrity.digest,
          permissions: e.manifest.permissions,
        });
      },
      async claimTrial(record) {
        const old = trials.get(record.id);
        if (old) {
          if (old.userId !== who || old.requestHash !== record.requestHash)
            throw Error("IDEMPOTENCY_CONFLICT");
          return { claimed: false, record: structuredClone(old) };
        }
        trials.set(record.id, structuredClone(record));
        return { claimed: true, record };
      },
      async finishTrial(record) {
        trials.set(record.id, structuredClone(record));
        return structuredClone(record);
      },
      async hasTrial(id) {
        return [...trials.values()].some(
          (t) => t.userId === who && t.versionId === id && t.state === "COMPLETED",
        );
      },
      async review(versionId, dimensions, text) {
        reviews.push({ versionId, dimensions, text, userId: who });
      },
      async reviews(id) {
        return reviews
          .filter((x) => x.versionId === id)
          .map((x) => ({ dimensions: x.dimensions, text: x.text }));
      },
      async continuation(id, kind) {
        const c = fi2.db.conversations.get(id);
        if (!c || c.userId !== who) throw Error("ACCESS_DENIED");
        return { referenceId: id, projectId: c.projectId, goal: c.title, kind };
      },
    };
    return new MarketplaceService(port, runtime, () => "2026-09-22T00:00:00.000Z");
  }
  return {
    fi2,
    project: p,
    entries,
    trials,
    grants,
    reviews,
    contexts,
    calls,
    gateway,
    runtime,
    connect,
    service: connect(),
  };
}
export const trialInput = (e, changes = {}) => ({
  id: crypto.randomUUID(),
  versionId: e.id,
  approvedPermissionIds: e.manifest.permissions.map((x) => x.id),
  allowNetwork: true,
  ...changes,
});
