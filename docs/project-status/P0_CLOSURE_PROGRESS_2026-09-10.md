# P0 closure progress — 2026-09-10

P0 = BLOCKED. P1_READY = NO. P1_STARTED = NO.

Repository: `Ehfamo/weave-render-app`.
Branch: `plan/xeomx-platform-expansion-20260909`.
Starting HEAD: `1a70bcf765aacc4818883615ef65e1ce11ab98ae`.
Validated source HEAD: `7281190377c446b71fdfd90365f1342792667702`.
This is a progress/evidence report, **not CANONICAL_BASELINE_2026_09**. The report's containing commit is the evidence commit; it is intentionally not embedded in its own contents.

## Completed repairs

1. `5c4526861dc761027e17530758cfc564ca4c4774` — reconstruct the three missing Stage5.3 contract modules and a shared bounded JSON validator:
   - `src/lib/agents/control-plane.ts`: existing SQL action allowlists, risk ceilings, R3 denial, approval synchronization, bounded retry and cancellation. It never executes agents or tools. Actor and exact-owner approval facts must be established server-side; SQL remains authoritative.
   - `src/lib/billing/index.ts`: provider boundary, normalized safe failures, checkout/subscription transitions, payment confirmation matching, local test ledger with conflict detection and immutable snapshots. No live payment provider is connected or invoked; the local ledger is not production persistence.
   - `src/lib/evidence/evidence.ts`: dataset/item validation, duplicate detection, immutable terminal transitions, consistent evaluation counts, secret-key rejection, deterministic evidence serialization and sanitized errors. Provider evaluation remains explicitly disconnected.
   - `tests/stage53-boundary-regression.test.mjs`: adversarial JSON, SQL bounds, approval retry, empty-result rejection, mutation and cross-owner payment tests. All 21 original module tests and 4 new regression tests pass.
2. `7281190377c446b71fdfd90365f1342792667702` — reconnect 37 direct entries to their existing canonical environment/subpage previews, add the legal hub and its route, and regenerate the TanStack route tree. Data/evals parent routes render nested outlets correctly. These are read-only existing previews, not new AI functionality. Four actual HTTP heading checks were added to the existing runtime step through `scripts/p0-route-runtime.py`. **Aggregator logic is unchanged.**

The three module paths, `ProductEnvironmentPage.tsx`, and `LegalHubPage.tsx` returned empty path histories when freshly queried on the P0 branch. Existing recovered-artifact inspection did not supply their originals. The implementations are explicitly **minimal reconstructions**, not byte-identical historical restorations. Their contracts come from the repository's Stage5.3 migrations, original tests, and canonical product architecture. No canonical recovery restart, new dependency, copied OSS framework, or package/lock change occurred.

## Fresh validation

Workflow [34451420982](https://github.com/Ehfamo/weave-render-app/actions/runs/34451420982), job `102787799003`, validated source `7281190...`.

| Gate | Actual result |
|---|---|
| Canonical hashes and exact byte counts | PASS: four source files and lockfile unchanged; values in companion JSON |
| Clean install | PASS, freshly run in CI |
| Typecheck | PASS, fresh local and CI |
| Lint | PASS, 0 errors; 12 pre-existing warnings |
| Build | PASS, fresh local and CI |
| Unit / Contract | **FAIL: 116/123 pass, 7 fail**, no skips/cancellations |
| Integration | PASS, 12/12 |
| Migration source checks | PASS, 36/36; not live schema validation |
| Smoke | PASS, 1/1 |
| Routes/imports and circular dependency audit | PASS, zero unresolved source imports and cycles |
| Runtime | PASS: homepage HTTP 200 and four restored entries |
| Nested route HTTP checks | PASS: `/en/data/annotation`, `/en/evals/experiments`, `/en/inbox`, `/en/legal`; correct rendered h1 verified |
| Hydration / responsive smoke | PASS within existing bounded desktop DOM/mobile screenshot/log-pattern checks; not comprehensive browser coverage |
| RTL / i18n static checks | PASS: five catalogs have matching 511 keys and root direction invariant |
| Secret scan / backend static safety | PASS |
| Aggregator | Correctly FAILS because UNIT=failure; not modified |

Starting unit result was freshly reproduced: **88/101 pass, 13 fail**. Restoring three missing module imports expands previously failing file-load entries into 21 actual tests; four new regression tests also increase the denominator. The improvement is not a change in assertions or exclusion of failing tests. First repair CI run `34450935503` had 113/123 pass and 10 fail; route repairs reduce this to 7.

Raw command output is stored under `p0-closure-2026-09-10/`; trailing whitespace was normalized for Git hygiene. The companion JSON contains stored-log hashes, fresh canonical values, complete changed paths and classifications.

## Remaining unit root causes

| Failure | Classification and actual cause |
|---|---|
| Deferred home discovery | SOURCE: missing `HomeExperience.tsx` and `HomeDiscoverySection.tsx`; current home still imports the prompt-card path directly |
| Twelve critical journeys | SOURCE / EVIDENCE: `src/lib/critical-journeys.ts` and original `CRITICAL_JOURNEYS` definitions absent |
| Locale acceptance | SOURCE / CONTRACT: exact key parity exists at 511 keys, but original test requires more than 850. No dummy keys or relaxed assertion added |
| Legacy simulations / metrics / product 404s | PRODUCT / SOURCE: legacy studio and AI entry routes have not been replaced by the complete original product shell; remaining fixture/404 expectations are also unproven |
| Listing / auth / SEO safety | PRODUCT / SOURCE: current marketplace still exposes legacy feed contracts; test first stops because listing selection includes full prompt bodies; the expected `fetchFeedPrompts` contract is also absent, so later auth/SEO/dashboard assertions are not certified |
| Deferred global tools | SOURCE: root lacks `GlobalLauncherProvider`; original launcher/provider modules absent |
| Context-preserving route hardening | SOURCE: restored read-only preview entry does not yet implement the expected `CapabilityBoundary`, context provider/summary and handoff flow. The test remains failing rather than being satisfied by inert identifier strings |

These are broader supporting-product-source gaps than the three Stage5.3 modules. They are not aggregator errors, credential problems, or proof that the four canonical recovered files are corrupt. Restoring those four files again cannot resolve them. Completing the original journey requirement needs its actual definitions; unrelated replacement journeys are explicitly forbidden. The missing product-shell and complete locale behavior also need substantive restoration, not placeholder modules or test weakening.

## J01–J12

Fresh current-tree definition checks find the authoritative source absent. **FAIL here means the definition/validation prerequisite fails; it does not mean a browser journey was executed and failed.** Route and action execution are NOT_RUN for every journey. No historical result is relabeled fresh.

| Journey | Final classification | Route / action execution |
|---|---|---|
| J01 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J02 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J03 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J04 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J05 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J06 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J07 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J08 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J09 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J10 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J11 | FAIL — original definition missing | NOT_RUN / NOT_RUN |
| J12 | FAIL — original definition missing | NOT_RUN / NOT_RUN |

## Staging and production isolation

Supabase staging `bzoikmppvwiidyjdaqgv`: **FAIL — schema mismatch**, not a credential blocker. Fresh read-only `to_regclass` queries return null for `creator_stats`, `likes`, `saves`, `follows`, `comments`, and `prompt_views`. All six are already defined in `supabase/migrations/20260710134256_58ccd951-1ccf-4d9b-a2e7-f343a0145223.sql`; its version is absent from staging migration history. All 37 existing public tables have RLS enabled. No duplicate migration was created, no migration applied, and no staging or production data mutated.

Cloudflare isolated remote staging: **BLOCKED_BY_EXTERNAL_DEPENDENCY**. The current branch has no verified isolated remote target; `wrangler.jsonc` names `weave-render-app` and the deployment workflow targets main. It was not invoked. CI reports credential presence only, which is not a permission or isolation verification. Local scratch preview encounters `uv_interface_addresses` OS restriction; CI's local Cloudflare Worker preview and HTTP/browser smoke pass. The older `auxiliaryWorkers` error is resolved and is not presented as a current failure. No remote Cloudflare deployment is claimed or performed.

`main` remained at `fb18042fdb281f7ca2d2731c16edac899aa6222b`. Production deployment, Supabase, DNS, secrets and payments were untouched. Only the P0 branch was advanced. No P1 branch or implementation exists from this work. No original tests, lint rules, TypeScript configuration, or required aggregator gates were weakened.

## Gate decision

Canonical identity and successful individual source gates do not outweigh seven failing unit/contract cases, absent original journeys and known staging incompatibility. **CANONICAL_BASELINE_2026_09 is NOT_ESTABLISHED.** This report preserves recovery history and records actual progress; it does not certify final closure.

P0 = BLOCKED

P1_READY = NO

P1_STARTED = NO
