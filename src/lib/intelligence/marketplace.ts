import type {
  MarketplaceListing,
  MarketplacePackageManifest,
  MarketplaceReview,
} from "../marketplace/contracts.ts";
import type { IntelligenceCapability } from "./contracts.ts";

export type CompatibilityState =
  "COMPATIBLE" | "COMPATIBLE_WITH_REQUIREMENTS" | "INCOMPATIBLE" | "UNKNOWN";
export interface CompatibilityResult {
  state: CompatibilityState;
  reasons: readonly string[];
}
export interface MarketplaceContext {
  runtimeVersion: string;
  installedPackages: Readonly<Record<string, string>>;
  allowedPermissions: ReadonlySet<string>;
  locale: string;
  capabilities: readonly IntelligenceCapability[];
}
export interface FactualSignals {
  successfulExecutions?: number;
  executions?: number;
  repeatUsage?: number;
  verifiedRating?: number;
  verifiedReviewCount?: number;
  refundRate?: number;
  failureRate?: number;
  maintainedAt?: string;
  validated?: boolean;
  expectedRuntimeCostMinor?: number;
}
export interface RankedCandidate {
  listing: MarketplaceListing;
  manifest: MarketplacePackageManifest;
  compatibility: CompatibilityResult;
  utility: number;
  evidence: readonly string[];
  explanation: string;
  unknownSignals: readonly string[];
  placement: "ORGANIC" | "SPONSORED";
}
const normalized = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const tokens = (value: string) => new Set(normalized(value).split(" ").filter(Boolean));
const overlap = (a: Set<string>, b: Set<string>) => {
  const union = new Set([...a, ...b]);
  return union.size ? [...a].filter((x) => b.has(x)).length / union.size : 0;
};
const parts = (version: string) =>
  /^\d+\.\d+\.\d+$/.test(version) ? version.split(".").map(Number) : undefined;

export function matchGoalToCapabilities(goal: string): readonly IntelligenceCapability[] {
  const g = normalized(goal);
  const out: IntelligenceCapability[] = [];
  if (/seo|search|rank|اینستاگرام|instagram|launch|راه اندازی|تسويق|营销|मार्केटिंग/.test(g))
    out.push("marketing");
  if (/research|competitor|تحقیق|رقیب|بحث|منافس|研究|竞争|शोध|प्रतियोगी/.test(g))
    out.push("research");
  if (
    /voice|image|video|character|صدا|تصویر|ویدیو|کاراکتر|صورة|فيديو|图像|视频|चित्र|वीडियो/.test(g)
  )
    out.push("creative.generate");
  if (/sales|follow up|فروش|پیگیری/.test(g)) out.push("sales");
  return out.length ? [...new Set(out)] : ["marketplace.search"];
}
export function evaluateCompatibility(
  manifest: MarketplacePackageManifest,
  context: MarketplaceContext,
): CompatibilityResult {
  const reasons: string[] = [];
  if (manifest.compatibility.runtime !== "xeomx")
    return { state: "INCOMPATIBLE", reasons: ["RUNTIME_MISMATCH"] };
  const current = parts(context.runtimeVersion),
    minimum = parts(manifest.compatibility.minimumVersion);
  if (current === undefined || minimum === undefined)
    return { state: "UNKNOWN", reasons: ["VERSION_NOT_COMPARABLE"] };
  if (
    current.findIndex((v, i) => v !== minimum[i]) >= 0 &&
    current[current.findIndex((v, i) => v !== minimum[i])] <
      minimum[current.findIndex((v, i) => v !== minimum[i])]
  )
    return { state: "INCOMPATIBLE", reasons: ["RUNTIME_VERSION_TOO_OLD"] };
  const denied = manifest.permissions.filter((x) => !context.allowedPermissions.has(x.id));
  if (denied.length) reasons.push("ADDITIONAL_PERMISSION_REQUIRED");
  const missing = manifest.dependencies.filter(
    (x) => !x.optional && context.installedPackages[x.packageId] !== x.version,
  );
  if (missing.length) reasons.push("DEPENDENCY_INSTALL_REQUIRED");
  return {
    state: reasons.length ? "COMPATIBLE_WITH_REQUIREMENTS" : "COMPATIBLE",
    reasons: reasons.length ? reasons : ["RUNTIME_PERMISSIONS_DEPENDENCIES_MATCH"],
  };
}
export function rankMarketplaceCandidates(input: {
  goal: string;
  candidates: readonly {
    listing: MarketplaceListing;
    manifest: MarketplacePackageManifest;
    signals?: FactualSignals;
    sponsored?: boolean;
  }[];
  context: MarketplaceContext;
}): readonly RankedCandidate[] {
  const goalTokens = tokens(input.goal),
    required = new Set(input.context.capabilities);
  return input.candidates
    .map(({ listing, manifest, signals = {}, sponsored = false }) => {
      const compatibility = evaluateCompatibility(manifest, input.context);
      const evidence: string[] = [],
        unknown: string[] = [];
      const lexical = overlap(
        goalTokens,
        tokens(`${manifest.title} ${manifest.summary} ${listing.tags.join(" ")}`),
      );
      const capabilityMatch = [...required].some((x) =>
        normalized(`${manifest.title} ${manifest.summary} ${listing.tags.join(" ")}`).includes(
          x.split(".")[0],
        ),
      );
      let utility = lexical * 45 + (capabilityMatch ? 25 : 0);
      if (compatibility.state === "COMPATIBLE") {
        utility += 20;
        evidence.push("COMPATIBLE_WITH_CURRENT_PROJECT");
      } else if (compatibility.state === "COMPATIBLE_WITH_REQUIREMENTS") utility += 5;
      else if (compatibility.state === "INCOMPATIBLE") utility -= 100;
      if (signals.validated === true) {
        utility += 10;
        evidence.push("VALIDATION_PASSED");
      } else if (signals.validated === undefined) unknown.push("validation");
      if (signals.verifiedRating !== undefined && signals.verifiedReviewCount !== undefined) {
        utility += Math.max(0, Math.min(10, signals.verifiedRating * 2));
        evidence.push(`VERIFIED_REVIEWS:${signals.verifiedReviewCount}`);
      } else unknown.push("verifiedReviews");
      for (const key of [
        "successfulExecutions",
        "repeatUsage",
        "refundRate",
        "failureRate",
        "expectedRuntimeCostMinor",
      ] as const)
        if (signals[key] === undefined) unknown.push(key);
      const explanation =
        compatibility.state === "COMPATIBLE"
          ? `Matches ${capabilityMatch ? "the required capability" : "the goal metadata"} and works with this project${manifest.permissions.length ? " with declared permissions" : " without additional permissions"}.`
          : `Compatibility: ${compatibility.reasons.join(", ")}.`;
      return {
        listing,
        manifest,
        compatibility,
        utility,
        evidence,
        explanation,
        unknownSignals: unknown,
        placement: sponsored ? ("SPONSORED" as const) : ("ORGANIC" as const),
      };
    })
    .filter((x) => x.compatibility.state !== "INCOMPATIBLE")
    .sort((a, b) => b.utility - a.utility || a.listing.id.localeCompare(b.listing.id));
}

export function summarizeVerifiedReviews(
  reviews: readonly (MarketplaceReview & { verifiedAcquisition: boolean; creatorId: string })[],
  minimum = 3,
) {
  const usable = reviews.filter(
    (x) => x.status === "active" && x.verifiedAcquisition && x.authorId !== x.creatorId,
  );
  if (usable.length < minimum)
    return {
      status: "INSUFFICIENT" as const,
      message: "No reliable summary yet.",
      reviewIds: usable.map((x) => x.id),
    };
  const positive = usable.filter((x) => x.rating >= 4),
    complaints = usable.filter((x) => x.rating <= 2);
  return {
    status: "AVAILABLE" as const,
    reviewIds: usable.map((x) => x.id),
    positiveCount: positive.length,
    complaintCount: complaints.length,
    positiveExamples: positive.slice(0, 3).map((x) => x.text),
    complaintExamples: complaints.slice(0, 3).map((x) => x.text),
  };
}
export function detectDuplicateSignals(
  candidate: MarketplacePackageManifest,
  existing: readonly MarketplacePackageManifest[],
) {
  const flags = existing.flatMap((item) => {
    const codes: string[] = [];
    if (item.integrity.digest === candidate.integrity.digest)
      codes.push("IDENTICAL_PAYLOAD_FINGERPRINT");
    if (
      normalized(item.title) === normalized(candidate.title) &&
      normalized(item.description) === normalized(candidate.description)
    )
      codes.push("NORMALIZED_METADATA_DUPLICATE");
    else if (
      overlap(
        tokens(`${item.title} ${item.description}`),
        tokens(`${candidate.title} ${candidate.description}`),
      ) >= 0.85
    )
      codes.push("NEAR_DUPLICATE_METADATA");
    return codes.map((code) => ({ code, relatedPackageId: item.packageId }));
  });
  return {
    action: flags.length ? ("REQUEST_MODERATION_REVIEW" as const) : ("NONE" as const),
    flags,
    autonomousPenalty: false,
  };
}
export function buildRiskSignals(facts: {
  selfPurchases?: number;
  repeatedRefunds?: number;
  duplicateSubmissions?: number;
  permissionRiskChanged?: boolean;
  copiedFingerprint?: boolean;
}) {
  const signals = Object.entries(facts)
    .filter(([, value]) => value === true || (typeof value === "number" && value > 0))
    .map(([kind, value]) => ({
      kind,
      factualValue: value,
      disposition: "MODERATION_REVIEW" as const,
    }));
  return { signals, accusation: false, automaticBan: false };
}
export function creatorInsights(facts: {
  views?: number;
  acquisitions?: number;
  installs?: number;
  repeatUses?: number;
  refundReasons?: readonly string[];
}) {
  const insights: string[] = [],
    gaps: string[] = [];
  if (
    facts.views !== undefined &&
    facts.acquisitions !== undefined &&
    facts.views >= 20 &&
    facts.acquisitions / facts.views < 0.02
  )
    insights.push("Many listing views but low acquisition.");
  else if (facts.views === undefined || facts.acquisitions === undefined)
    gaps.push("acquisition_funnel");
  if (
    facts.installs !== undefined &&
    facts.repeatUses !== undefined &&
    facts.installs >= 10 &&
    facts.repeatUses / facts.installs < 0.1
  )
    insights.push("Users install but rarely use again.");
  else if (facts.installs === undefined || facts.repeatUses === undefined)
    gaps.push("usage_funnel");
  if (facts.refundReasons?.length)
    insights.push(`Verified refund reasons are available (${facts.refundReasons.length}).`);
  else gaps.push("refund_reasons");
  return { insights, dataGaps: gaps };
}
export function listingSuggestions(input: {
  manifest: MarketplacePackageManifest;
  validationCodes: readonly string[];
  reviewSummary: ReturnType<typeof summarizeVerifiedReviews>;
}) {
  const suggestions: string[] = [];
  if (!input.manifest.previews.length) suggestions.push("Add a clearer example input/output.");
  if (input.manifest.dependencies.length && !/dependenc/i.test(input.manifest.description))
    suggestions.push("Explain dependency requirements.");
  if (input.validationCodes.length)
    suggestions.push(`Resolve validation findings: ${input.validationCodes.join(", ")}.`);
  if (input.reviewSummary.status === "AVAILABLE" && input.reviewSummary.complaintCount)
    suggestions.push("Review verified complaints before editing the listing.");
  return { suggestions, autoPublish: false };
}
export function recommendBundle(items: readonly RankedCandidate[]) {
  const compatible = items.filter((x) => x.compatibility.state === "COMPATIBLE").slice(0, 3);
  return {
    optional: true,
    requiresAcquisitionApproval: true,
    items: compatible.map((x) => ({
      listingId: x.listing.id,
      price: x.listing.price,
      permissions: x.manifest.permissions,
      dependencies: x.manifest.dependencies,
    })),
    totalKnownAmount: compatible.reduce(
      (sum, x) =>
        sum +
        (x.listing.price.kind === "FREE" || x.listing.price.kind === "SUBSCRIPTION_INCLUDED"
          ? 0
          : x.listing.price.amount),
      0,
    ),
    currency: compatible.every(
      (x) => x.listing.price.currency === compatible[0]?.listing.price.currency,
    )
      ? compatible[0]?.listing.price.currency
      : "MIXED",
  };
}
