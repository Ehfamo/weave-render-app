import {
  MARKETPLACE_OBJECT_TYPES,
  type MarketplaceAcquisition,
  type MarketplaceEntitlement,
  type MarketplaceInstall,
  type MarketplaceLedgerEntry,
  type MarketplaceListing,
  type MarketplaceModerationDecision,
  type MarketplacePackage,
  type MarketplacePackageManifest,
  type MarketplaceReview,
  type MarketplaceVersion,
} from "./contracts.ts";
import type { MarketplaceObjectAdapter } from "./adapters.ts";
import { MarketplaceValidationService } from "./validation.ts";
import { MarketplaceRuntimePolicy } from "./security.ts";

export interface MarketplaceActor {
  userId: string;
  moderator: boolean;
  canUseProject(projectId: string): Promise<boolean>;
}
export class MarketplaceService {
  private packages = new Map<string, MarketplacePackage>();
  private versions = new Map<string, MarketplaceVersion>();
  private listings = new Map<string, MarketplaceListing>();
  private acquisitions = new Map<string, MarketplaceAcquisition>();
  private entitlements = new Map<string, MarketplaceEntitlement>();
  private installs = new Map<string, MarketplaceInstall>();
  private reviews = new Map<string, MarketplaceReview>();
  private decisions: MarketplaceModerationDecision[] = [];
  private ledger: MarketplaceLedgerEntry[] = [];
  private balances = new Map<string, number>();
  private adapters = new Map<string, MarketplaceObjectAdapter>();
  private actor: MarketplaceActor;
  private validation: MarketplaceValidationService;
  private commissionBps: number;
  private now: () => string;
  private runtimePolicy: MarketplaceRuntimePolicy;
  constructor(
    actor: MarketplaceActor,
    validation = new MarketplaceValidationService(),
    commissionBps = 2000,
    now = () => new Date().toISOString(),
    runtimePolicy = new MarketplaceRuntimePolicy(),
  ) {
    this.actor = actor;
    this.validation = validation;
    this.commissionBps = commissionBps;
    this.now = now;
    this.runtimePolicy = runtimePolicy;
    if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000)
      throw Error("INVALID_COMMISSION");
  }
  registerAdapter(adapter: MarketplaceObjectAdapter) {
    if (this.adapters.has(adapter.type)) throw Error("DUPLICATE_ADAPTER");
    this.adapters.set(adapter.type, adapter);
  }
  setTestCredits(userId: string, credits: number) {
    if (!Number.isSafeInteger(credits) || credits < 0) throw Error("INVALID_CREDITS");
    this.balances.set(userId, credits);
  }
  createDraft(manifest: MarketplacePackageManifest) {
    if (manifest.creatorId !== this.actor.userId || this.packages.has(manifest.packageId))
      throw Error("MARKETPLACE_FORBIDDEN");
    const now = this.now(),
      pkg: MarketplacePackage = {
        id: manifest.packageId,
        ownerId: this.actor.userId,
        state: "draft",
        currentVersion: manifest.version,
        createdAt: now,
        updatedAt: now,
      };
    const version: MarketplaceVersion = {
      id: this.versionId(manifest.packageId, manifest.version),
      packageId: manifest.packageId,
      version: manifest.version,
      state: "draft",
      manifest: structuredClone(manifest),
      createdAt: now,
    };
    this.packages.set(pkg.id, pkg);
    this.versions.set(version.id, version);
    return structuredClone(version);
  }
  createVersion(packageId: string, manifest: MarketplacePackageManifest) {
    const pkg = this.needOwned(packageId);
    if (
      manifest.packageId !== packageId ||
      manifest.creatorId !== this.actor.userId ||
      this.versions.has(this.versionId(packageId, manifest.version))
    )
      throw Error("INVALID_NEW_VERSION");
    const current = this.versions.get(this.versionId(packageId, pkg.currentVersion))!;
    if (current.state !== "published" && current.state !== "deprecated")
      throw Error("CURRENT_VERSION_NOT_PUBLISHED");
    const version = this.createVersionRecord(manifest);
    pkg.currentVersion = manifest.version;
    pkg.state = "draft";
    pkg.updatedAt = this.now();
    return version;
  }
  updateDraft(packageId: string, version: string, manifest: MarketplacePackageManifest) {
    this.needOwned(packageId);
    const item = this.needVersion(packageId, version);
    if (item.state !== "draft" && item.state !== "invalid") throw Error("IMMUTABLE_VERSION");
    if (
      manifest.packageId !== packageId ||
      manifest.version !== version ||
      manifest.creatorId !== this.actor.userId
    )
      throw Error("VERSION_MISMATCH");
    item.manifest = structuredClone(manifest);
    item.state = "draft";
    return structuredClone(item);
  }
  validate(packageId: string, version: string) {
    this.needOwned(packageId);
    const item = this.needVersion(packageId, version);
    if (!["draft", "invalid"].includes(item.state)) throw Error("INVALID_STATE");
    item.state = "validating";
    const available = this.availableDependencies();
    const result = this.validation.validate(item.manifest, available);
    this.validation.assertNoCycles(
      packageId,
      new Map(
        [...this.versions.values()].map((x) => [
          x.packageId,
          x.manifest.dependencies.map((d) => d.packageId),
        ]),
      ),
    );
    item.state = result.ok
      ? item.manifest.permissions.some((x) => x.risk !== "safe_read")
        ? "review_required"
        : "valid"
      : "invalid";
    return { ...result, state: item.state };
  }
  moderate(packageId: string, version: string, decision: "approved" | "rejected", reason: string) {
    if (!this.actor.moderator) throw Error("MODERATION_FORBIDDEN");
    const item = this.needVersion(packageId, version);
    if (!["valid", "review_required"].includes(item.state)) throw Error("INVALID_STATE");
    item.state = decision;
    const record: MarketplaceModerationDecision = {
      id: `moderation:${item.id}:${this.decisions.length}`,
      versionId: item.id,
      actorId: this.actor.userId,
      decision,
      reason: reason.slice(0, 500),
      createdAt: this.now(),
    };
    this.decisions.push(record);
    return structuredClone(record);
  }
  moderateListing(listingId: string, decision: "suspended" | "deprecated", reason: string) {
    if (!this.actor.moderator) throw Error("MODERATION_FORBIDDEN");
    const listing = this.listings.get(listingId);
    if (!listing) throw Error("LISTING_UNAVAILABLE");
    listing.state = decision;
    const version = this.needVersion(listing.packageId, listing.version);
    version.state = "deprecated";
    const record: MarketplaceModerationDecision = {
      id: `moderation:${version.id}:${this.decisions.length}`,
      versionId: version.id,
      actorId: this.actor.userId,
      decision,
      reason: reason.slice(0, 500),
      createdAt: this.now(),
    };
    this.decisions.push(record);
    return structuredClone(record);
  }
  publish(
    packageId: string,
    version: string,
    input: { category: string; tags: string[]; price: MarketplaceListing["price"] },
  ) {
    const pkg = this.needOwned(packageId),
      item = this.needVersion(packageId, version);
    if (!["valid", "approved"].includes(item.state)) throw Error("PUBLICATION_NOT_APPROVED");
    this.validatePrice(input.price);
    item.state = "published";
    item.manifest.publishedAt = this.now();
    pkg.state = "published";
    pkg.currentVersion = version;
    const listing: MarketplaceListing = {
      id: `listing:${item.id}`,
      packageId,
      version,
      creatorId: pkg.ownerId,
      state: "published",
      category: input.category,
      tags: [...new Set(input.tags)].slice(0, 20),
      price: structuredClone(input.price),
      ratingCount: 0,
      ratingTotal: 0,
      publishedAt: this.now(),
    };
    this.listings.set(listing.id, listing);
    return structuredClone(listing);
  }
  discover(
    input: {
      query?: string;
      type?: string;
      creatorId?: string;
      freeOnly?: boolean;
      compatibleOnly?: boolean;
    } = {},
  ) {
    const q = input.query?.normalize("NFKC").toLowerCase().trim();
    return [...this.listings.values()]
      .filter((listing) => {
        const version = this.needVersion(listing.packageId, listing.version);
        return (
          listing.state === "published" &&
          (!input.type || version.manifest.objectType === input.type) &&
          (!input.creatorId || listing.creatorId === input.creatorId) &&
          (!input.freeOnly || listing.price.kind === "FREE") &&
          (!input.compatibleOnly || version.manifest.compatibility.runtime === "xeomx") &&
          (!q ||
            `${version.manifest.title} ${version.manifest.summary} ${listing.tags.join(" ")}`
              .toLowerCase()
              .includes(q))
        );
      })
      .map((listing) => structuredClone(listing));
  }
  preview(listingId: string) {
    const listing = this.needListing(listingId),
      manifest = this.needVersion(listing.packageId, listing.version).manifest;
    return {
      title: manifest.title,
      summary: manifest.summary,
      previews: structuredClone(manifest.previews),
      permissions: structuredClone(manifest.permissions),
      dependencies: structuredClone(manifest.dependencies),
      license: structuredClone(manifest.license),
      provenance: structuredClone(manifest.provenance),
    };
  }
  acquire(listingId: string, idempotencyKey: string) {
    if (!idempotencyKey || idempotencyKey.length > 120) throw Error("INVALID_IDEMPOTENCY_KEY");
    const prior = [...this.acquisitions.values()].find(
      (x) => x.buyerId === this.actor.userId && x.idempotencyKey === idempotencyKey,
    );
    if (prior) {
      if (prior.listingId !== listingId) throw Error("IDEMPOTENCY_CONFLICT");
      return this.acquisitionResult(prior);
    }
    const listing = this.needListing(listingId);
    if (listing.creatorId === this.actor.userId) throw Error("SELF_ACQUISITION_FORBIDDEN");
    const amount =
      listing.price.kind === "FREE" || listing.price.kind === "SUBSCRIPTION_INCLUDED"
        ? 0
        : listing.price.amount;
    const balance = this.balances.get(this.actor.userId) ?? 0;
    if (listing.price.currency === "CREDITS" && balance < amount)
      throw Error("INSUFFICIENT_CREDITS");
    if (listing.price.kind === "ONE_TIME_PRICE") throw Error("LIVE_PAYMENT_REQUIRED");
    if (amount) this.balances.set(this.actor.userId, balance - amount);
    const acquisition: MarketplaceAcquisition = {
      id: `acq:${this.acquisitions.size + 1}`,
      idempotencyKey,
      buyerId: this.actor.userId,
      listingId,
      packageId: listing.packageId,
      version: listing.version,
      amount,
      status: "active",
      createdAt: this.now(),
    };
    this.acquisitions.set(acquisition.id, acquisition);
    const entitlement: MarketplaceEntitlement = {
      id: `entitlement:${acquisition.id}`,
      buyerId: this.actor.userId,
      packageId: listing.packageId,
      version: listing.version,
      acquisitionId: acquisition.id,
      status: "active",
    };
    this.entitlements.set(entitlement.id, entitlement);
    const commission = Math.floor((amount * this.commissionBps) / 10000);
    this.ledger.push({
      id: `ledger:${acquisition.id}:sale`,
      acquisitionId: acquisition.id,
      creatorId: listing.creatorId,
      type: "sale",
      gross: amount,
      commission,
      creatorAmount: amount - commission,
      createdAt: this.now(),
    });
    return this.acquisitionResult(acquisition);
  }
  async install(
    acquisitionId: string,
    projectId: string,
    approvedPermissions: readonly string[] = [],
  ) {
    if (!(await this.actor.canUseProject(projectId))) throw Error("PROJECT_ACCESS_DENIED");
    const acquisition = this.acquisitions.get(acquisitionId),
      entitlement = [...this.entitlements.values()].find(
        (x) => x.acquisitionId === acquisitionId && x.buyerId === this.actor.userId,
      );
    if (
      !acquisition ||
      !entitlement ||
      entitlement.status !== "active" ||
      acquisition.status !== "active"
    )
      throw Error("ENTITLEMENT_REQUIRED");
    const version = this.needVersion(acquisition.packageId, acquisition.version),
      check = this.validation.validate(version.manifest, this.availableDependencies());
    if (!check.ok) throw Error("INSTALL_VALIDATION_FAILED");
    this.runtimePolicy.authorize(version.manifest, approvedPermissions);
    const adapter = this.adapters.get(version.manifest.objectType);
    if (!adapter) throw Error("ADAPTER_UNAVAILABLE");
    const imported = await adapter.import(version.manifest, projectId);
    const install: MarketplaceInstall = {
      id: `install:${acquisition.id}:${projectId}`,
      projectId,
      buyerId: this.actor.userId,
      packageId: acquisition.packageId,
      version: acquisition.version,
      adapter: version.manifest.objectType,
      status: "installed",
      createdAt: this.now(),
    };
    this.installs.set(install.id, install);
    return { install: structuredClone(install), imported };
  }
  review(listingId: string, rating: 1 | 2 | 3 | 4 | 5, text: string) {
    const listing = this.needListing(listingId);
    if (listing.creatorId === this.actor.userId) throw Error("SELF_REVIEW_FORBIDDEN");
    if (
      ![...this.acquisitions.values()].some(
        (x) =>
          x.buyerId === this.actor.userId && x.listingId === listingId && x.status === "active",
      )
    )
      throw Error("ACQUISITION_REQUIRED");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !text.trim() || text.length > 2000)
      throw Error("INVALID_REVIEW");
    const id = `review:${listingId}:${this.actor.userId}`,
      prior = this.reviews.get(id);
    if (prior) {
      listing.ratingTotal -= prior.rating;
    } else listing.ratingCount++;
    const review: MarketplaceReview = {
      id,
      listingId,
      authorId: this.actor.userId,
      rating,
      text: text.trim(),
      status: "active",
      updatedAt: this.now(),
    };
    listing.ratingTotal += rating;
    this.reviews.set(id, review);
    return {
      review: structuredClone(review),
      aggregate: {
        count: listing.ratingCount,
        average: listing.ratingCount ? listing.ratingTotal / listing.ratingCount : 0,
      },
    };
  }
  reportReview(reviewId: string, reason: string) {
    const review = this.reviews.get(reviewId);
    if (!review || review.authorId === this.actor.userId || !reason.trim() || reason.length > 500)
      throw Error("INVALID_REVIEW_REPORT");
    review.status = "reported";
    return { reviewId, reason: reason.trim(), status: "reported" as const };
  }
  refund(
    acquisitionId: string,
    state: "requested" | "approved" | "rejected" | "refunded" | "disputed" | "resolved",
  ) {
    const acquisition = this.acquisitions.get(acquisitionId);
    if (!acquisition || acquisition.buyerId !== this.actor.userId)
      throw Error("ACQUISITION_FORBIDDEN");
    if (state === "refunded") {
      if (acquisition.status === "refunded") return structuredClone(acquisition);
      acquisition.status = "refunded";
      const entitlement = [...this.entitlements.values()].find(
        (x) => x.acquisitionId === acquisitionId,
      )!;
      entitlement.status = "revoked";
      const sale = this.ledger.find((x) => x.acquisitionId === acquisitionId && x.type === "sale")!;
      this.ledger.push({
        ...sale,
        id: `ledger:${acquisitionId}:refund`,
        type: "refund",
        gross: -sale.gross,
        commission: -sale.commission,
        creatorAmount: -sale.creatorAmount,
        createdAt: this.now(),
      });
    } else if (state === "disputed") acquisition.status = "disputed";
    return { acquisition: structuredClone(acquisition), state };
  }
  creatorLedger(creatorId: string) {
    if (creatorId !== this.actor.userId) throw Error("LEDGER_FORBIDDEN");
    return structuredClone(this.ledger.filter((x) => x.creatorId === creatorId));
  }
  private createVersionRecord(manifest: MarketplacePackageManifest) {
    const item: MarketplaceVersion = {
      id: this.versionId(manifest.packageId, manifest.version),
      packageId: manifest.packageId,
      version: manifest.version,
      state: "draft",
      manifest: structuredClone(manifest),
      createdAt: this.now(),
    };
    this.versions.set(item.id, item);
    return structuredClone(item);
  }
  private needOwned(id: string) {
    const pkg = this.packages.get(id);
    if (!pkg || pkg.ownerId !== this.actor.userId) throw Error("MARKETPLACE_FORBIDDEN");
    return pkg;
  }
  private needVersion(id: string, version: string) {
    const item = this.versions.get(this.versionId(id, version));
    if (!item) throw Error("VERSION_NOT_FOUND");
    return item;
  }
  private needListing(id: string) {
    const item = this.listings.get(id);
    if (!item || item.state !== "published") throw Error("LISTING_UNAVAILABLE");
    return item;
  }
  private versionId(id: string, version: string) {
    return `${id}@${version}`;
  }
  private validatePrice(price: MarketplaceListing["price"]) {
    if (
      !Number.isSafeInteger(price.amount) ||
      price.amount < 0 ||
      (price.kind === "FREE" && price.amount !== 0) ||
      (price.kind === "ONE_TIME_CREDITS" && price.currency !== "CREDITS")
    )
      throw Error("INVALID_PRICE");
  }
  private availableDependencies() {
    const map = new Map<string, string[]>();
    for (const item of this.versions.values())
      if (item.state === "published" || item.state === "approved" || item.state === "valid")
        map.set(item.packageId, [...(map.get(item.packageId) ?? []), item.version]);
    return map;
  }
  private acquisitionResult(acquisition: MarketplaceAcquisition) {
    return {
      acquisition: structuredClone(acquisition),
      entitlement: structuredClone(
        [...this.entitlements.values()].find((x) => x.acquisitionId === acquisition.id)!,
      ),
    };
  }
}
export const objectTypes = MARKETPLACE_OBJECT_TYPES;
