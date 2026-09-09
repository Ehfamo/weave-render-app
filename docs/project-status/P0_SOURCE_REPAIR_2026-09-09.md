# P0 source repair — continuation evidence

P0 = BLOCKED. P1_READY = NO. P1_STARTED = NO.

Repository: Ehfamo/weave-render-app. Branch: `plan/xeomx-platform-expansion-20260909`.
Starting source: `3827d1225323d627efbdfcaffbdcb3ee28a3f2a5`.
Repaired source: `90b400baf8b0fe6b91f370ece8b89a97132281eb`.
The later continuation instruction arrived while HEAD was already `b814b2a66f32be6bc677d9ee262151c4be989b84`; valid repair commits were preserved.
This is repair evidence, not an accepted canonical baseline.

## Diagnosis and repairs

| Class | Actual cause | Repair / remaining state |
|---|---|---|
| A — historical source | Vertical-slice backend absent; integration import failure | Four originals restored byte-for-byte from `2f4f7aa36c4c324aee8b09c90721dba018bfcb44`; integration 12/12 passes |
| A — missing source | Canonical preview imported absent status/safety/catalog components and presentation types | Minimal read-only components reconstructed from actual canonical consumers and backend contracts; no fabricated execution, payment, security feed or provider success |
| A — missing source | Project handoff and catalog search contracts absent | Immutable opaque-reference handoff restored; bounded search helpers recovered from historical catalog semantics and connected to existing marketplace queries |
| B/C — dependency/import | Nine missing imports were internal files, not npm dependencies | Source audit now reports zero missing imports and cycles; no package changes |
| D — type contracts | Old FeatureStatus omitted canonical states; restored backend accepted only first provider | Canonical release union, translated labels, disabled planned actions, exact three-route Stage5.4 submission allowlist |
| D — lint/types | 808 errors concentrated in generated DB types and two worker files | Format only those noncanonical files; replace six explicit any annotations with narrowed contracts/guards; declare EdgeRuntime lifecycle; report background failure without payload |
| D/F — preview | Missing compact prop and 28 undefined message functions | Implement compact; supply 28 messages in all five locales; actually server-render all 295 views |
| E/F — runtime | Nitro manifest lacks auxiliaryWorkers expected by Cloudflare Vite preview | One Nitro adapter now owns build and preview; fresh CI proved server starts, exposing locale/slash redirects in HTTP assertions; smoke now targets /en/ |
| E — test baseline | Missing Stage5.3 source, routes, journeys and legacy hardening | 13 unit/contract failures remain, preserved in p0-source-repair-2026-09-09/unit.txt; no assertion weakened |
| G — staging schema | Six application relations absent in staging | All six definitions already exist in July marketplace migration; staging history has no 20260710% entries. No duplicate migration or database mutation |

Historical source search used existing reconciliation source, available release/verification trees and previously inspected uploaded source/knowledge archives. Canonical recovery was not restarted. Reconstructed components are not claimed as byte-identical historical originals; they implement bounded P0 presentation and permission behavior.

## Focused commits

- `c7a1c98deb710221e0a937c79f9a65f17a66d295` — four historical backend files.
- `a5981034ebc06828ba29340db91dee887ebe851b` — worker types and 808 lint errors.
- `b814b2a66f32be6bc677d9ee262151c4be989b84` — Stage5.4 submission allowlist.
- `2139c2b03b952a0e16ce5f6755f638ee4dde6f3f` — preview dependencies, release contracts, opaque context and render tests.
- `64be755c34caa5ecb11fac0f0fc664e4102edb6e` — shared build/preview adapter and isolated CI source triggers.
- `bc07312e34eaae3ec1d4d8eb3d988faa642411fb` — compact prop, catalog search contract and localized smoke.
- `90b400baf8b0fe6b91f370ece8b89a97132281eb` — missing messages and all-view render regression.

Complete changed paths and fresh SHA256/byte measurements are in the adjacent JSON report. All four canonical files and package-lock match supplied expectations. The Validation Matrix step is byte-for-byte unchanged. Workflow edits only cover source triggers, runner isolation, runtime log preservation and runtime target URL.

## Validation

Local Node v24.19.0 / npm 11.9.0. CI retains Node 22 / npm 10.9.3.
Fresh command exit codes and log hashes are in JSON.

| Gate | Before | Repaired local result |
|---|---|---|
| Clean install | Earlier PASS | Fresh npm ci PASS, 487 packages from unchanged lock |
| Typecheck | FAIL | PASS, exit 0 after compact correction |
| Lint | 808 errors / 12 warnings | PASS, zero errors / 12 existing warnings |
| Build | Earlier PASS | Fresh PASS, Nitro Cloudflare Worker output |
| Unit/contract | 57/75 pass, 18 failures | 88/101 pass, 13 failures; restored suites/new tests increase denominator |
| Integration | Import failure | PASS, 12/12 |
| Migration checks | Earlier PASS | Fresh command exit 0; static checks do not prove DB application |
| Worker smoke | Earlier PASS | PASS, 1/1 |
| Source imports/cycles | 9 missing imports | PASS, zero missing/cycles |
| Component SSR | Unavailable | PASS, all 295 canonical views; not browser/route E2E |
| i18n parity / RTL source | 480 matching keys | 511 matching keys; no missing canonical preview messages |
| Locale completeness | FAIL | Still FAIL: existing test requires >850 keys; no filler added |
| Secret scan | Earlier PASS | Fresh configured scan: zero findings |

CI runs:

- `34409323309`, job `102659787369`, source `64be755...`: FAIL on compact prop, unit tests and root redirect assertion. Actual lint/integration/build/import outcomes passed.
- `34409621842`, job `102660740592`, source `bc07312...`: install/build/typecheck/lint/integration/migrations/smoke/imports/i18n/secrets outcomes success; unit and /en normalization assertion failed.
- Final source run `34409950674`, job `102661806824`, source `90b400...`: actual outcome logs show only UNIT=failure; all other reported source gates succeed. HOME_HTTP=200 and HEADLESS_BROWSER_RUNTIME_PASS are recorded. This bounded home smoke does not establish J01–J12 or comprehensive hydration/a11y coverage. Aggregator truthfully fails the run.

## Remaining blockers

1. SOURCE/TEST: absent `src/lib/agents/control-plane.ts`, `src/lib/billing/index.ts`, `src/lib/evidence/evidence.ts` prevent their Stage5.3 suites loading. These security-sensitive implementations remain unrepaired; passing fixture assertions alone would not establish full persistence, ownership and lifecycle behavior.
2. SOURCE/TEST: direct routes asserted by the 17-target and 21-target suites, LegalHubPage, ProductEnvironmentPage, global launcher/context integration and legacy page/SEO/listing hardening remain missing or incomplete. Catalog preview rendering does not establish these routes exist.
3. EVIDENCE/SOURCE: original `src/lib/critical-journeys.ts` and J01–J12 definitions remain absent. No replacement journeys or historical PASS mislabeled as fresh.
4. SOURCE: locale completeness remains below the existing contract despite supplying every message consumed by canonical previews.
5. DATABASE: staging `bzoikmppvwiidyjdaqgv` lacks creator_stats, likes, saves, follows, comments, prompt_views. Classification FAIL, not credential blocker. Definitions, RLS and security-invoker view already exist in `supabase/migrations/20260710134256_58ccd951-1ccf-4d9b-a2e7-f343a0145223.sql`. Reconciliation must account for existing staging schema; this run remained read-only.

## Isolation

No main ref update, merge, production deployment, production DB query/mutation, DNS, secret change or payment operation occurred. Main was freshly observed at `fb18042fdb281f7ca2d2731c16edac899aa6222b`. No new OSS dependency/framework. Generated DB types only formatted; schema/RLS unchanged. CI removes repository environment files in its ephemeral checkout and uses loopback-only runtime wiring, without live backend credentials. No canonical baseline or P1 branch/implementation created.

Stored local log copies normalize trailing whitespace only; JSON command-log hashes refer to the original raw output. The CI outcome excerpt and GitHub job log preserve source results.
