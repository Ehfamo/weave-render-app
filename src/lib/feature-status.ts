// Central Feature Status Registry.
// Every UI surface must classify its feature via this registry — no scattered
// status flags in components. See `.lovable/plan.md`.

import type { CapabilityReleaseState } from "./platform-contracts";

/** coming_soon remains an input alias for legacy notices, never canonical registry data. */
export type FeatureStatus = CapabilityReleaseState | "coming_soon";

export interface FeatureConfig {
  key: string;
  status: FeatureStatus;
  route: string;
  /** True when the feature's primary CTA should perform its real action. */
  allowPrimaryAction: boolean;
  /** True when a waitlist / notify-me flow is meaningful for this feature. */
  waitlistEnabled: boolean;
  /** Optional analytics event name (leave undefined to skip). */
  analyticsEvent?: string;
}

export const FEATURES = {
  // ── Content discovery (LIVE) ──────────────────────────────────────────
  discover: {
    key: "discover",
    status: "live",
    route: "/",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  explore: {
    key: "explore",
    status: "live",
    route: "/explore",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  promptListing: {
    key: "promptListing",
    status: "live",
    route: "/prompt-hub",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  promptDetail: {
    key: "promptDetail",
    status: "live",
    route: "/prompt",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  promptCopy: {
    key: "promptCopy",
    status: "live",
    route: "",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  promptSave: {
    key: "promptSave",
    status: "live",
    route: "",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  savedLibrary: {
    key: "savedLibrary",
    status: "live",
    route: "/dashboard",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  search: {
    key: "search",
    status: "live",
    route: "/explore",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  collections: {
    key: "collections",
    status: "live",
    route: "/collections",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  magazine: {
    key: "magazine",
    status: "live",
    route: "/magazine",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,

  // ── BETA (works but not verified for public release) ──────────────────
  feed: {
    key: "feed",
    status: "beta",
    route: "/feed",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,
  creators: {
    key: "creators",
    status: "beta",
    route: "/creators",
    allowPrimaryAction: true,
    waitlistEnabled: false,
  } as FeatureConfig,

  // ── PREVIEW (visible product preview, primary action gated) ───────────
  studio: {
    key: "studio",
    status: "preview",
    route: "/studio",
    allowPrimaryAction: false,
    waitlistEnabled: true,
    analyticsEvent: "feature_preview_view",
  } as FeatureConfig,
  xeomxAI: {
    key: "xeomxAI",
    status: "preview",
    route: "/xeomx-ai",
    allowPrimaryAction: false,
    waitlistEnabled: true,
    analyticsEvent: "feature_preview_view",
  } as FeatureConfig,
  remix: {
    key: "remix",
    status: "preview",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,

  // ── COMING SOON (no functionality yet) ────────────────────────────────
  pricing: {
    key: "pricing",
    status: "planned",
    route: "/pricing",
    allowPrimaryAction: false,
    waitlistEnabled: true,
    analyticsEvent: "coming_soon_view",
  } as FeatureConfig,
  marketplace: {
    key: "marketplace",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  subscriptions: {
    key: "subscriptions",
    status: "planned",
    route: "/pricing",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  creatorEarnings: {
    key: "creatorEarnings",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  payouts: {
    key: "payouts",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  follow: {
    key: "follow",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  founders: {
    key: "founders",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  academy: {
    key: "academy",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  agentStore: {
    key: "agentStore",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  aiCompare: {
    key: "aiCompare",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  pwa: {
    key: "pwa",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  android: {
    key: "android",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  telegramBot: {
    key: "telegramBot",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: true,
  } as FeatureConfig,
  socialPublishing: {
    key: "socialPublishing",
    status: "planned",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: false,
  } as FeatureConfig,

  // ── Public aggregate counters (view/like/copy) are not verified as
  //    real data; treated as sample until an aggregation view exists. ──
  publicCounts: {
    key: "publicCounts",
    status: "preview",
    route: "",
    allowPrimaryAction: false,
    waitlistEnabled: false,
  } as FeatureConfig,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function statusOf(key: FeatureKey): FeatureStatus {
  return FEATURES[key].status;
}

export function isLive(key: FeatureKey): boolean {
  return FEATURES[key].status === "live";
}
