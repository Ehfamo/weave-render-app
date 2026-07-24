# XeomX Pre-Launch Completion — Audit & Implementation Plan

## Executive summary

XeomX is a TanStack Start + Supabase + Paraglide (5 locales) project already deep in production polish. The homepage, prompt data, creators, collections, and magazine content are still driven largely by **hardcoded arrays in `src/lib/prompts.ts` / `marketplace.ts` / `explore-sections.ts`**, presented alongside large stat numbers ("1.2M views", "84.3k likes", "12,480 copies") that read as real. Auth (Email + Google), profiles, likes/saves/collections/comments/notifications, and support tickets are backed by real Supabase tables with RLS. Studio, Xeomx AI, Pricing, Marketplace, Founders Drop, PWA/Android/Telegram, and creator monetization are UI-only.

Goal of this plan: **stop the fake-metrics problem and dead CTAs**, introduce a single Feature Status registry, and route every non-live surface through consistent Preview / Coming Soon patterns — without deleting a single section, route, or product concept, and without touching Supabase schema.

## Current architecture (verified)

- **Framework**: TanStack Start v1 on Cloudflare Workers (`src/server.ts`, `wrangler.jsonc`), Vite 7, React 19.
- **Routing**: File-based under `src/routes/`, locale rewriting via Paraglide middleware (`en/fa/ar/zh/hi`).
- **i18n**: Paraglide JS 2, `messages/{locale}.json`, RTL for `fa`/`ar`.
- **UI**: Tailwind v4 + shadcn, cinematic dark theme, custom XEOMX logo + brand tokens in `src/styles.css`.
- **Auth**: Supabase Auth via `@/integrations/supabase/client`; `_authenticated/route.tsx` gates protected subtree.
- **Data**: Supabase tables present: `profiles, prompts, prompt_views, likes, saves, comments, collections, collection_items, follows, notifications, earnings, subscriptions, contact_messages, waitlist, reserved_usernames`. All have RLS + Data-API grants.
- **Content source of truth today**: `src/lib/prompts.ts` (hardcoded 15 prompts w/ fake views/likes/copies), `src/lib/marketplace.ts`, `src/lib/explore-sections.ts` (65+ future sections), `messages/*.json`.

## Route inventory & target status

| Route | Current | Target |
|---|---|---|
| `/` (index) | Live, uses hardcoded stats | LIVE (relabel stats as SAMPLE) |
| `/feed` | Renders hardcoded feed | BETA (label Curated) |
| `/explore` | Roadmap hub, real | LIVE |
| `/explore/$slug` | Reads `explore-sections.ts` | LIVE (routes to Preview/Coming Soon per phase) |
| `/collections` + `/collections/$id` | Mix of Supabase + fallback hardcoded | LIVE for real rows, PREVIEW for demo slugs |
| `/creators` | Hardcoded creator cards | BETA + DEMO PROFILE badges |
| `/prompt-hub` | Duplicate of explore | LIVE |
| `/prompt/$id` | Reads hardcoded `PROMPTS` | LIVE for known IDs, real 404 for unknown |
| `/magazine` + `/magazine/$slug` | Hardcoded 3 articles | LIVE listing, PREVIEW for slugs without body |
| `/studio` | UI shell | PREVIEW |
| `/xeomx-ai` | UI shell | PREVIEW |
| `/pricing` | Plans UI | COMING SOON (Waitlist CTA) |
| `/auth`, `/forgot-password`, `/reset-password` | Email + Google | LIVE (add "Apple/Discord — Coming Soon" chips) |
| `/_authenticated/dashboard` | Adaptive real data | LIVE (auth) |
| `/profile-edit`, `/settings` | Real | LIVE (auth) |
| `/contact` | Real, writes `contact_messages` | LIVE |
| `/terms`, `/privacy`, `/cookies`, `/refund-policy` | Real | LIVE (align copy w/ pre-launch) |
| Unknown slug | Falls to route not-found | Branded 404 |

## Key findings

### Hardcoded / misleading data
- `src/lib/prompts.ts` — 15 prompts with `views: "1.2M"`, `likes: "84.3k"`, `copies: 12480` etc. Presented as real on `/`, `/feed`, `/prompt/$id`.
- `src/routes/index.tsx` hero stats (12,480 prompts / 1.4M renders / 284k creators) — unsupported.
- `src/lib/marketplace.ts` — hardcoded creator/collection sample data used as fallback.
- `src/routes/creators.tsx` — sample creator profiles with follower counts.
- `src/routes/magazine.tsx` — 3 hardcoded articles; slug detail routes to real body only for those.

### Dead / misleading CTAs
- Homepage "Reserve", "Go Pro", "Generate" — no backend.
- Studio Generate button, Xeomx AI action buttons — no-op.
- Follow button on Creator cards — no persistence.
- Pricing "Choose plan" — no checkout.

### Auth / providers
- Only Email + Google are configured; Apple + Discord referenced in copy but not enabled. Must be visibly Coming Soon.
- GitHub is listed in the master prompt as active but the current UI does not expose it — will surface as an active provider chip only if `configure_social_auth` for GitHub is already enabled (verified before shipping); otherwise treat GitHub identically to Apple/Discord (Coming Soon).

### i18n / RTL
- 5 locales wired. Some remaining hardcoded English strings in newer components (`Logo` wordmark is a brand mark, keep). Audit each surface below when touched.
- RTL logical properties already used broadly; verify Studio / Xeomx AI / Dashboard sub-sections when we touch them.

### SEO
- `src/lib/seo.ts` builds canonical + og properly. `/prompt/$id`, `/magazine/$slug`, `/collections/$id` need unique `head()` derived from data. Coming Soon pages need `robots: noindex`.
- `public/sitemap.xml` is static — leave as-is unless routes shift (they won't).

### Accessibility / responsive
- Already substantial passes done. Remaining: heading order on Studio/Xeomx AI/Pricing when we relabel, focus rings on new Waitlist buttons.

### Security
- Verified: no service-role key in client bundle; `client.server.ts` server-only; CSP report-only in place. No changes required.

## Central Feature Status Registry (new)

New file: `src/lib/feature-status.ts`

```ts
export type FeatureStatus = "live" | "beta" | "preview" | "coming_soon";
export interface FeatureConfig {
  key: string; status: FeatureStatus; route: string;
  titleKey: string; descriptionKey: string;
  waitlistEnabled: boolean; analyticsEvent?: string;
  allowPrimaryAction: boolean;
}
export const FEATURES: Record<string, FeatureConfig> = { /* discover, feed, promptCopy, promptSave, savedLibrary, studio, xeomxAI, pricing, marketplace, follow, remix, founders, academy, agentStore, aiCompare, pwa, android, telegram, socialPublishing, ... */ };
export function statusOf(key: string): FeatureStatus { ... }
```

New shared components in `src/components/xeomx/status/`:
- `FeatureStatusBadge.tsx` — themed pill (LIVE/BETA/PREVIEW/COMING SOON) with i18n.
- `FeatureGate.tsx` — wraps a CTA; if `allowPrimaryAction=false`, renders `WaitlistButton` instead.
- `ComingSoonPage.tsx` — reusable full page (title, description, badge, waitlist form, back-to-Discover, related live links).
- `ComingSoonModal.tsx` — dialog variant for in-place CTAs.
- `PreviewNotice.tsx` — inline banner for PREVIEW routes.
- `DemoDataBadge.tsx` — small "SAMPLE DATA" pill for stat clusters.
- `FeatureWaitlistForm.tsx` — writes to existing `waitlist` table via a `createServerFn`.

## File-by-file implementation plan

### Phase 1 — Foundation (no visual change)
1. `src/lib/feature-status.ts` (new) — registry.
2. `src/components/xeomx/status/*` (new) — 7 shared components above.
3. `messages/{en,fa,ar,zh,hi}.json` — add `status.*`, `comingSoon.*`, `waitlist.*`, `preview.*` keys.
4. `src/lib/analytics.ts` (new or extend existing) — centralized `track(event, props)` helper wrapping current usage; add events listed in success criteria. If a provider already exists, reuse it.
5. `src/lib/waitlist.functions.ts` (new) — `createServerFn` that inserts into existing `waitlist` table (uses `requireSupabaseAuth` optionally; anon insert allowed by existing RLS).

### Phase 2 — Truthful homepage & nav
6. `src/routes/index.tsx` — wrap stat cluster in `<DemoDataBadge>` OR replace numeric values with i18n copy ("Launching soon", "Content library in preparation"). Convert Reserve / Go Pro CTAs to `<FeatureGate feature="pricing">`. Keep every section.
7. `src/components/xeomx/Header.tsx` + `IndexRails.tsx` — add tiny `<FeatureStatusBadge>` next to nav items whose target route is not LIVE (Feed=BETA, Studio=PREVIEW, Xeomx AI=PREVIEW, Pricing=COMING SOON).
8. `src/components/xeomx/ConnectSection.tsx` — ensure 5 channels (Instagram, TikTok, Telegram, YouTube, Pinterest), add COMING SOON label for official publishing.

### Phase 3 — Prompt & marketplace surfaces
9. `src/lib/prompts.ts` — mark exported arrays as **SAMPLE**; wrap the numeric `views/likes/copies` fields so `PromptCard` displays them under a `DemoDataBadge`. Do not delete the data.
10. `src/components/xeomx/PromptCard.tsx` — hide raw counts when `FEATURES.publicCounts.status !== "live"`, or overlay `SAMPLE DATA` chip.
11. `src/routes/prompt.$id.tsx` — real 404 (`throw notFound()`) for unknown IDs; add unique `head()` (title, description, og:image=cover) from prompt data; Copy button wired to real clipboard w/ analytics; Save button `FeatureGate` → auth-required + real Supabase `saves` insert (persistence already exists). If not authenticated, redirect to `/auth?next=<current>` (validated internal path).
12. `src/routes/feed.tsx` — add BETA badge + "Curated" label; keep hardcoded content but mark cluster SAMPLE.
13. `src/routes/creators.tsx` — DEMO PROFILE badge on sample cards; Follow → COMING SOON modal.
14. `src/routes/collections.tsx` / `collections.$id.tsx` — real 404 for unknown IDs; PREVIEW badge for demo slugs (`saas-in-10`, `10x-marketer`, `automation-mastery`, `editorial-aesthetic`) if backing rows don't exist.
15. `src/routes/magazine.tsx` / `magazine.$slug.tsx` — real 404 for unknown slug; ARTICLE COMING SOON for slugs listed but without body; unique `head()` per article + BreadcrumbList + Article JSON-LD.

### Phase 4 — Preview / Coming Soon routes
16. `src/routes/studio.tsx` — wrap page in `<PreviewNotice>`; Generate CTA → `FeatureGate` → waitlist. Sample output labeled "PREVIEW OUTPUT".
17. `src/routes/xeomx-ai.tsx` — same treatment; remove any string containing "mock" TODO comment; every button becomes a waitlist CTA or Preview info.
18. `src/routes/pricing.tsx` — COMING SOON badge + fixed notice: "Plans shown are previews. No payment is currently being collected." Convert each plan CTA to `FeatureWaitlistForm(plan=<tier>)`. Preserve visual design.
19. `src/routes/explore_.$slug.tsx` — pull `phase` from `explore-sections.ts` → render as PREVIEW (`q1`) or COMING SOON (`q2`/`q3`). Real 404 for unknown slug.

### Phase 5 — Auth truthfulness
20. `src/routes/auth.tsx` — keep Email + Google active buttons. Add disabled Apple + Discord + (GitHub if not verified enabled) rows with `<FeatureStatusBadge status="coming_soon" />`. Preserve `next` param (already validated internal-only in `src/lib/auth-validation.ts`).
21. `src/hooks/use-auth.ts` — swap `getSession()` → `getUser()` for identity checks (getSession retained for token-attach only).

### Phase 6 — 404 and cleanup
22. `src/routes/__root.tsx` — verify `notFoundComponent` renders branded 404 (search, links to Discover / Collections / Magazine, `robots: noindex`). Extend if minimal.
23. Add `robots: noindex` meta to every Coming Soon and Preview page.
24. `messages/*.json` — round out missing keys touched above; verify parity script (existing).

### Phase 7 — Analytics + tests + verify
25. Wire `track(...)` calls at: page_view (root), prompt_copy, save_attempt, prompt_save, waitlist_started, waitlist_completed, coming_soon_view, feature_preview_view, search_submitted, filter_applied, signup_completed, login_completed.
26. Add Vitest tests (project already has `bunx vitest`): FeatureStatusBadge render per status, FeatureGate blocks CTA when not live, ComingSoonModal a11y, Copy handler success/failure, Save auth-gate redirect, Return-URL validator, 404 for unknown prompt slug.
27. Run `bun run build`, `tsgo`, tests.

## Backend dependencies (documented — not implemented here)
- `waitlist` table exists — reuse; if the `plan` / `feature_key` columns don't exist, store the feature key in the `source` column instead (schema-safe).
- No new tables, functions, policies, or grants required for this phase.
- Real Save + Saved Library: `saves` table exists with RLS — repair frontend to use it (already partially wired).
- Follow: `follows` table exists. Decision: keep Follow COMING SOON in this phase to avoid partial UX; do not wire follower counts publicly until aggregation view is designed.

## Risks
- Touching homepage stat copy risks conflicting with brand tone — mitigated by keeping the SAMPLE DATA visual cluster instead of deleting.
- Adding badges to nav could clutter — will use compact 8px pills with muted color, hidden below `sm` breakpoint on some items.
- `explore-sections.ts` has 65 slugs; each Preview page shares one component so no route explosion.
- Paraglide message keys must land in all 5 locales in one commit to avoid runtime `undefined`.

## Items completable without backend changes
Everything in phases 1–7 above.

## Items blocked by backend / infra (report only, no action)
- GitHub OAuth activation (needs `supabase--configure_social_auth`).
- Apple / Discord OAuth.
- www→apex redirect for xeomx.com (DNS).
- Real prompt content library import (requires content).
- Aggregated public counters (view / like / copy) — requires a materialized view or Supabase function.

## Implementation order (once approved)
Phase 1 → 2 → 3 → 4 → 5 → 6 → 7, each verified with build + typecheck before proceeding.
