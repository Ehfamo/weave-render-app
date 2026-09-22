import test from "node:test";
import assert from "node:assert/strict";
import { MARKETPLACE_OBJECT_TYPES } from "../src/lib/marketplace/contracts.ts";
import {
  MARKETPLACE_ADAPTER_TARGETS,
  restrictedObjectAdapter,
} from "../src/lib/marketplace/adapters.ts";
import { MarketplaceRuntimePolicy } from "../src/lib/marketplace/security.ts";
import { MarketplaceService } from "../src/lib/marketplace/reference.ts";
import {
  MarketplaceValidationService,
  manifestIntegrity,
} from "../src/lib/marketplace/validation.ts";
import { marketplaceGoalTarget } from "../src/lib/command-center/actions.ts";
import { readFile } from "node:fs/promises";

function manifest(type = "prompt", overrides = {}) {
  const value = {
    packageId: `creator.${type.replaceAll("-", ".")}`,
    objectType: type,
    version: "1.0.0",
    creatorId: "creator",
    title: `${type} package`,
    summary: "Safe reusable package",
    description: "A complete marketplace package.",
    compatibility: { runtime: "xeomx", minimumVersion: "1.0.0", objectAdapter: type },
    dependencies: [],
    permissions: [
      { id: "project.read", reason: "Read authorized project context", risk: "safe_read" },
    ],
    requiredSkills: [],
    requiredTools: [],
    license: {
      identifier: "creator-commercial",
      commercialUse: true,
      redistribution: false,
      attributionRequired: true,
      creatorDeclared: true,
    },
    provenance: {
      kind: "creator-owned",
      sourceReferences: [],
      creatorDeclaration: "I own this package.",
    },
    previews: [
      {
        kind: type === "workflow" ? "steps" : "sample",
        references: [],
        publicData: { sample: true },
      },
    ],
    changelog: "Initial version",
    payload: { canonicalReference: `${type}:source` },
    integrity: { algorithm: "xeomx-canonical-v1", digest: "" },
    createdAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
  value.integrity.digest = manifestIntegrity(value);
  return value;
}

test("all eight object types map only to existing canonical XEOMX domains", async () => {
  assert.equal(MARKETPLACE_OBJECT_TYPES.length, 8);
  for (const type of MARKETPLACE_OBJECT_TYPES) {
    assert.ok(MARKETPLACE_ADAPTER_TARGETS[type]);
    const adapter = restrictedObjectAdapter(type, async (item, projectId) => ({
      referenceId: `${projectId}:${item.packageId}`,
    }));
    assert.equal(
      (await adapter.import(manifest(type), "project")).referenceId,
      `project:creator.${type.replaceAll("-", ".")}`,
    );
    if (type !== "prompt")
      await assert.rejects(() => adapter.import(manifest("prompt"), "project"), /ADAPTER_MISMATCH/);
  }
});

test("validation rejects secrets forbidden capabilities missing license provenance integrity and dependencies", () => {
  const validation = new MarketplaceValidationService();
  assert.equal(validation.validate(manifest()).ok, true);
  const unsafe = manifest("agent", {
    permissions: [{ id: "shell", reason: "escape", risk: "sensitive" }],
    payload: { apiKey: "secret-value" },
    license: { identifier: "", creatorDeclared: false },
    provenance: { kind: "imported-reference", sourceReferences: [], creatorDeclaration: "" },
    dependencies: [{ packageId: "missing.dep", version: "1.0.0", optional: false }],
  });
  unsafe.integrity.digest = manifestIntegrity(unsafe);
  assert.deepEqual(
    validation.validate(unsafe).errors.sort(),
    [
      "FORBIDDEN_PERMISSION",
      "INVALID_LICENSE",
      "INVALID_PROVENANCE",
      "MISSING_DEPENDENCY",
      "SECRET_LEAKAGE",
    ].sort(),
  );
});

test("dependency cycles fail closed", () => {
  assert.throws(
    () =>
      new MarketplaceValidationService().assertNoCycles(
        "a",
        new Map([
          ["a", ["b"]],
          ["b", ["a"]],
        ]),
      ),
    /DEPENDENCY_CYCLE/,
  );
});

test("published versions are immutable and changes require a new version", () => {
  const actor = {
    userId: "creator",
    moderator: true,
    async canUseProject() {
      return true;
    },
  };
  const service = new MarketplaceService(actor);
  const first = manifest();
  service.createDraft(first);
  assert.equal(service.validate(first.packageId, first.version).state, "valid");
  service.moderate(first.packageId, first.version, "approved", "safe");
  service.publish(first.packageId, first.version, {
    category: "productivity",
    tags: ["prompt"],
    price: { kind: "FREE", amount: 0, currency: "CREDITS" },
  });
  assert.throws(
    () => service.updateDraft(first.packageId, first.version, first),
    /IMMUTABLE_VERSION/,
  );
  const second = manifest("prompt", { version: "1.1.0", changelog: "Improved" });
  second.integrity.digest = manifestIntegrity(second);
  assert.equal(service.createVersion(first.packageId, second).version, "1.1.0");
});

test("complete create validate moderate publish discover acquire earn install safe-use flow", async () => {
  const actor = {
    userId: "creator",
    moderator: true,
    async canUseProject(projectId) {
      return projectId === "buyer-project";
    },
  };
  const service = new MarketplaceService(actor, undefined, 2000, () => "2026-09-13T00:00:00.000Z");
  service.registerAdapter(
    restrictedObjectAdapter("prompt", async () => ({ referenceId: "prompt:installed" })),
  );
  const item = manifest();
  service.createDraft(item);
  assert.equal(service.validate(item.packageId, item.version).ok, true);
  service.moderate(item.packageId, item.version, "approved", "reviewed");
  const listing = service.publish(item.packageId, item.version, {
    category: "writing",
    tags: ["seo"],
    price: { kind: "ONE_TIME_CREDITS", amount: 100, currency: "CREDITS" },
  });
  assert.equal(
    service.discover({ query: "prompt", type: "prompt", compatibleOnly: true }).length,
    1,
  );
  assert.equal(service.preview(listing.id).previews[0].publicData.sample, true);
  actor.userId = "buyer";
  actor.moderator = false;
  service.setTestCredits("buyer", 100);
  const bought = service.acquire(listing.id, "purchase-once");
  assert.deepEqual(service.acquire(listing.id, "purchase-once"), bought);
  const installed = await service.install(bought.acquisition.id, "buyer-project");
  assert.equal(installed.install.version, "1.0.0");
  assert.equal(installed.imported.referenceId, "prompt:installed");
  const review = service.review(listing.id, 5, "Useful and safe");
  assert.deepEqual(review.aggregate, { count: 1, average: 5 });
  actor.userId = "creator";
  const ledger = service.creatorLedger("creator");
  assert.deepEqual(
    ledger.map((x) => [x.gross, x.commission, x.creatorAmount]),
    [[100, 20, 80]],
  );
});

test("commerce prevents price override double charge insufficient balance and self purchase", () => {
  const actor = {
      userId: "creator",
      moderator: true,
      async canUseProject() {
        return true;
      },
    },
    service = new MarketplaceService(actor);
  const item = manifest();
  service.createDraft(item);
  service.validate(item.packageId, item.version);
  service.moderate(item.packageId, item.version, "approved", "ok");
  const listing = service.publish(item.packageId, item.version, {
    category: "x",
    tags: [],
    price: { kind: "ONE_TIME_CREDITS", amount: 50, currency: "CREDITS" },
  });
  assert.throws(() => service.acquire(listing.id, "self-key"), /SELF_ACQUISITION/);
  actor.userId = "buyer";
  service.setTestCredits("buyer", 49);
  assert.throws(() => service.acquire(listing.id, "buyer-key"), /INSUFFICIENT/);
  service.setTestCredits("buyer", 50);
  service.acquire(listing.id, "buyer-key");
  assert.throws(() => service.acquire(listing.id, "other-key"), /INSUFFICIENT/);
});

test("refund creates append-only negative ledger and revokes entitlement", async () => {
  const actor = {
      userId: "creator",
      moderator: true,
      async canUseProject() {
        return true;
      },
    },
    service = new MarketplaceService(actor);
  service.registerAdapter(restrictedObjectAdapter("prompt", async () => ({ referenceId: "x" })));
  const item = manifest();
  service.createDraft(item);
  service.validate(item.packageId, item.version);
  service.moderate(item.packageId, item.version, "approved", "ok");
  const listing = service.publish(item.packageId, item.version, {
    category: "x",
    tags: [],
    price: { kind: "ONE_TIME_CREDITS", amount: 10, currency: "CREDITS" },
  });
  actor.userId = "buyer";
  service.setTestCredits("buyer", 10);
  const bought = service.acquire(listing.id, "refund-key");
  service.refund(bought.acquisition.id, "refunded");
  await assert.rejects(() => service.install(bought.acquisition.id, "p"), /ENTITLEMENT_REQUIRED/);
  actor.userId = "creator";
  assert.deepEqual(
    service.creatorLedger("creator").map((x) => x.type),
    ["sale", "refund"],
  );
});

test("reviews require acquisition block creator and update one canonical review", () => {
  const actor = {
      userId: "creator",
      moderator: true,
      async canUseProject() {
        return true;
      },
    },
    service = new MarketplaceService(actor);
  const item = manifest();
  service.createDraft(item);
  service.validate(item.packageId, item.version);
  service.moderate(item.packageId, item.version, "approved", "ok");
  const listing = service.publish(item.packageId, item.version, {
    category: "x",
    tags: [],
    price: { kind: "FREE", amount: 0, currency: "CREDITS" },
  });
  assert.throws(() => service.review(listing.id, 5, "self"), /SELF_REVIEW/);
  actor.userId = "buyer";
  assert.throws(() => service.review(listing.id, 5, "no purchase"), /ACQUISITION_REQUIRED/);
  service.acquire(listing.id, "free-key");
  assert.equal(service.review(listing.id, 4, "good").aggregate.average, 4);
  assert.equal(service.review(listing.id, 2, "updated").aggregate.average, 2);
});

test("runtime permissions declare but never grant authority", () => {
  const policy = new MarketplaceRuntimePolicy(),
    risky = manifest("workflow", {
      permissions: [{ id: "external.publish", reason: "Publish", risk: "external" }],
    });
  risky.integrity.digest = manifestIntegrity(risky);
  assert.throws(() => policy.authorize(risky), /APPROVAL_REQUIRED/);
  assert.equal(policy.authorize(risky, ["external.publish"]).permissions[0], "external.publish");
});

test("marketplace creator listing and library UI is localized responsive and RTL safe", async () => {
  const ui = await readFile(
    new URL("../src/components/xeomx/marketplace/MarketplaceWorkspace.tsx", import.meta.url),
    "utf8",
  );
  for (const token of [
    'dir="auto"',
    "sm:grid-cols",
    "lg:grid-cols",
    "overflow-x-auto",
    "min-h-11",
    "aria-current",
    "sr-only",
  ])
    assert.match(ui, new RegExp(token));
  const locales = await Promise.all(
    ["en", "fa", "ar", "zh", "hi"].map(async (locale) =>
      JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
    ),
  );
  const keys = Object.keys(locales[0])
    .filter((key) => key.startsWith("p6_"))
    .sort();
  assert.equal(keys.length, 18);
  for (const locale of locales)
    assert.deepEqual(
      Object.keys(locale)
        .filter((key) => key.startsWith("p6_"))
        .sort(),
      keys,
    );
});

test("Command Center marketplace goals route to one canonical surface", () => {
  for (const goal of [
    "Find an SEO agent",
    "Install this workflow",
    "Show my purchased assets",
    "Publish this prompt",
    "Show my creator earnings",
  ])
    assert.equal(marketplaceGoalTarget(goal), "/marketplace");
  assert.equal(marketplaceGoalTarget("continue project"), undefined);
});

test("marketplace source has no arbitrary execution payment payout or private search bypass", async () => {
  const source = (
    await Promise.all(
      ["contracts", "validation", "security", "adapters", "service"].map((name) =>
        readFile(new URL(`../src/lib/marketplace/${name}.ts`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  assert.doesNotMatch(
    source,
    /child_process|exec\(|eval\(|service.role|SERVICE_ROLE|SELECT\s|fetch\(|chargeCard|sendPayout|private.*global.*search/i,
  );
  assert.match(source, /MARKETPLACE_APPROVAL_REQUIRED/);
  assert.match(source, /PROJECT_ACCESS_DENIED/);
});

test("moderation can suspend listings and reviews expose an abuse-report boundary", () => {
  const actor = {
    userId: "creator",
    moderator: true,
    async canUseProject() {
      return true;
    },
  };
  const service = new MarketplaceService(actor),
    item = manifest();
  service.createDraft(item);
  service.validate(item.packageId, item.version);
  service.moderate(item.packageId, item.version, "approved", "ok");
  const listing = service.publish(item.packageId, item.version, {
    category: "x",
    tags: [],
    price: { kind: "FREE", amount: 0, currency: "CREDITS" },
  });
  actor.userId = "buyer";
  actor.moderator = false;
  service.acquire(listing.id, "review-report");
  const review = service.review(listing.id, 4, "Useful").review;
  actor.userId = "reporter";
  assert.equal(service.reportReview(review.id, "misleading").status, "reported");
  actor.userId = "moderator";
  actor.moderator = true;
  assert.equal(
    service.moderateListing(listing.id, "suspended", "reported abuse").decision,
    "suspended",
  );
  assert.equal(service.discover({ query: "prompt" }).length, 0);
});
