# FI4 Marketplace Excellence I — source and integration evidence

Repository: `Ehfamo/weave-render-app`.
Source branch: `feature/xeomx-fi3-capability-runtime-20260915`.
Exact FI3 prerequisite: `b33248cb7cd0fb27f76d74b2dab60c265fba84a7`.
FI2 ancestor: `9b6f077baf2a4bf72edaf22ed71da4492d33c18e`.
FI1 ancestor: `dcafa525ebae0cf126e7470be3ca9de8065274aa`.
FI4 branch: `feature/xeomx-fi4-marketplace-excellence-20260915`.
Final closure date: `2026-09-23`.

Emergency checkpoint: `e5d8fd4a2b9848ce5761f7e9076c784f7626f702`.
Second checkpoint: `b41a439a95b8d8fc0a679ee113ce1f0778f85e6f`.
Both exact commits were verified on the FI4 GitHub branch before further work.
Recovery workflow runs `35734229882` and `35735698583` succeeded, including
bundle SHA-256, prerequisite, ancestry and remote-HEAD equality checks.
Recovered validated source commit: `e030417eb9892548f6c43ca40fb23d2f299e76f4`.
On September 23, this newer local commit was preserved before closure edits.
Recovery workflow run `35819077227` succeeded; the FI4 branch was then read back
from GitHub and matched this exact local SHA. Its existing bundle SHA-256 is
`971480502b6a6fb654e3b30f3b8f14c9095e8e3bc2e6a4fcc711628629116057`.

The final closure commit changes evidence/manifest only. Its literal SHA,
verified remote SHA, final bundle digest and recovery result are recorded after
commit creation in
`artifacts/fi4-preservation/XEOMX_FI4_FINAL_CLOSURE_20260923.manifest.json` on
`preservation/xeomx-fi4-final-20260923`. This companion is the final attestation.
The source-branch copy records the pre-publication state and points to that
attestation: a commit cannot contain its own literal hash. The final source
commit can also be resolved with `git log -1 --format=%H --
artifacts/fi4-preservation/XEOMX_FI4_FINAL_CLOSURE_20260923.manifest.json`.
The September 22 manifest remains a historical record, not the final attestation.

## Architecture and implementation

SOURCE_PASS / INTEGRATION_PASS. The production MarketplaceService uses a caller-bound
SupabaseMarketplaceStore. No in-memory catalog is authoritative in production.
The existing P6 object contracts, validation, license/provenance rules, dependency
cycle check, P9 intent/ranking/duplicate signals, canonical TaskOrchestrator,
AgentRegistry, model tool, Model Gateway and ProjectBrainService are reused.
The original deterministic P6 commerce reference is retained only in
`tests/helpers/p6-marketplace-reference.ts`; its valid contract tests still run.
FI5 commerce is not connected to production and no new payment flow exists.

The source-only migration adds packages, immutable versions, safe listings,
trials, version-bound permission grants and multidimensional reviews. Existing
`project_members` supplies private team/project membership: FI4 does not invent
an independent organization directory or role system. Ownership and active
project membership are rechecked. Private catalog data does not become public
through review, trial, dependency or recommendation endpoints.

`/marketplace` is a guest-capable root route. Public discovery uses safe public
metadata; private/team access is caller scoped. Raw package payloads are not
returned by guest discovery or detail. Authenticated mutations validate actor
identity on the server. The server-only store reads full versions only after the
caller can see their listing. Direct client writes to versions/trials/reviews
are denied. Reviews and permission grants use narrowly authorized RPCs.
No production seed/sample cards, fake acquisitions, installs, popularity or ratings.

Discovery supports bounded keywords and P9 intent matching, type, category,
language, declared free price and compatibility filters. It is deterministic
intent relevance, not vector search or an invented quality score. Explanations
identify metadata/intent matches and requirements. Compatibility compares full
numeric major/minor/patch versions and exact dependency versions. Unknown costs
and absent reliability evidence remain UNKNOWN / NOT_ENOUGH_DATA.

FI1 missing-capability/provider results expose Marketplace inline while keeping
the original goal/result state. Persisted FI1 conversations and FI3 failed jobs
can produce recommendations from an authorized opaque reference. Only resource
IDs enter routes. The original goal is used server-side for ranking, not returned
in recommendation metadata or sent to packages. Return links restore the same
Project and FI1 conversation; FI3 job state remains in canonical Project outputs.
No inspection, permission grant or recommendation auto-installs, buys or resumes
execution. Explicit normal retry/continue remains under the canonical runtime.

## Sandbox and permissions

INTEGRATION_PASS. Eligible text prompt/template/agent/skill packages execute their
bounded prompt through the existing TaskOrchestrator and canonical model tool /
Model Gateway. The sandbox registers no package executable, MCP network client,
workspace search, file write, external action or payment tool. Workflow/media/MCP
packages are truthfully TRIAL_UNAVAILABLE in this text-only sandbox.

Default input is fixed safe sample context. Merely selecting a Project does not
load its context. Private context requires explicit selection, declared and
approved `project.read`, server membership and bounded ProjectBrainService context.
Memory OFF continues to suppress automatic memory behavior without stopping Brain.
Network is denied without a separate explicit action. Allowed network execution
uses only the configured Model Gateway; arbitrary package hosts are never invoked.
The UI discloses provider/network requirements and UNKNOWN runtime cost.

Limits: 8-second execution deadline, one model tool call, one step, no orchestrator
retry, 4,000 context characters, 512 output tokens and 8,000 persisted result
characters. Abort/deadline errors are safe. Trial state and result are persisted
under actor/version identity. Durable claim uniqueness prevents duplicate
execution across requests and service recreation. An interrupted RUNNING trial
is not represented as success. No provider produces NOT_CONFIGURED, not output.
Trial output is labelled TRIAL / SANDBOX, never LIVE_VERIFIED.

Permission review binds actor, Project, exact immutable version and SHA-256 digest.
Every changed version/digest requires explicit reapproval, including expanded
safe-read access. Readiness also verifies integrity and dependency graphs. It is
acquisition readiness, not an installation or a charge. Unsupported consequential
or MCP permissions cannot become executable through the text trial.

## Integrity, trust, privacy, moderation, reviews

SHA-256 hashes canonical sorted JSON, excluding the digest field value and the
existing non-content publication timestamp. Published versions cannot be updated
or deleted through normal database operations. New content requires a new version.
Digest tampering is rejected before discovery/detail/trial/readiness. The legacy
32-bit P6 fingerprint is only a reference-test compatibility path, never trusted
by the production Marketplace service.

Trust dimensions remain separate: publisher NOT_VERIFIED; package integrity
VERIFIED only after digest comparison; signature NOT_CONFIGURED or NOT_VERIFIED;
permissions/privacy PUBLISHER_DECLARED; security NOT_EVALUATED; runtime reliability
NOT_ENOUGH_DATA; actual version publication time; actual version trial review
eligibility. Registry discovery never implies endorsement. Signature metadata
and provenance are persisted without fabricating a signing authority.

MCP inspection exposes declared tools/schemas/permissions/consequential flags,
hosts, credential names, dependencies, publisher/version/digest/signature. No secret
value is requested or forwarded. Unknown requirements remain undeclared. Dependency
inspection includes exact package edges and declared skills/tools/provider/network/
credential requirements. Required missing nodes, cycles, tampered dependencies
and excessive graph depth fail readiness/trials closed.

The Privacy Card distinguishes declared user, Project, file, memory and connected
app access; destinations; retention; training/data use; region and permissions.
Missing data is NOT_DECLARED. Declarations are not independently verified policies.
Moderation signals include duplicate metadata, unsigned packages, incomplete
privacy, consequential/excessive permission scope, stale publication, broken
dependencies and unsubstantiated trust wording. Signals request review and never
accuse or automatically ban a publisher.

Reviews require an authenticated non-publisher with an actual completed trial of
the exact version. Clients cannot fabricate completion or write arbitrary reviews.
Supported dimensions are usefulness, reliability, setup, documentation, value and
support. No ratings are synthesized. Reviews are trial-verified, not claims of
live-provider verification, acquisition or purchase.

## Recorded validation and September 23 closure checks

Existing installed dependencies and repository lockfile were reused; lockfile
unchanged. No live credentials or Production database were used.
The following source/integration gates were executed in the preceding working
session against the code subsequently committed as `e030417`. They are recorded
in that exact preserved commit; they are not claimed as freshly rerun on
September 23. The temporary console log files are no longer available in this
worker. The recovered source includes changes after checkpoint `b41a439`, and
those changes were already present during the final 414-test validation.
No source, tests, runtime, migration, locale or dependency files changed after
that validated source for this documentation-only closure. Therefore the full
suite/build were not repeated. Ancestry, source equivalence, JSON/evidence
integrity, diff whitespace and changed-file credential checks were rerun.

| Gate | Actual result |
| --- | --- |
| FI4 behavioral | 27/27 PASS, 0 skipped |
| FI4 PostgreSQL / PGlite | 13/13 PASS (12 transactional subtests plus parent), 0 skipped |
| FI4 + P6/P8/P9 targeted regression | 95/95 PASS |
| FI3 behavioral + PostgreSQL regression | 34/34 PASS |
| FI2 behavioral + PostgreSQL regression | 24/24 PASS |
| FI1 core execution | 13/13 PASS |
| Project Brain | 12/12 PASS |
| Memory core | 8/8 PASS |
| Global Search / Command Center | 14/14 PASS |
| Combined selected FI1–FI3/Brain/Memory/Search regression | 105/105 PASS |
| Full repository suite | 414/414 PASS, 0 failed, 0 skipped |
| Typecheck | PASS, 0 errors |
| Lint | PASS, 0 errors; unchanged 11 Fast Refresh warnings |
| Production build | PASS; no deployment |
| Canonical Worker package smoke | 1/1 PASS |
| git diff --check | PASS |
| Changed-file credential scan + boundary review | PASS |
| Five locale key parity | PASS; 74 FI4 keys per locale |
| FI3/FI2/FI1 ancestry | PASS |

Commands: `node --experimental-strip-types --test tests/fi4-marketplace.test.mjs
 tests/fi4-persistence.test.mjs`; targeted existing test files; `npm test`;
`npm run typecheck`; `npm run lint`; `npm run build`; `npm run test:smoke`;
`git diff --check`. The canonical full suite includes build smoke, so the build
was generated before the final full-suite run. Final typecheck used the actual
build-generated route tree. Build retains existing inlineDynamicImports/codeSplitting
and Wrangler main override warnings. npm reports an environment http-proxy warning.
No warning or missing service was converted into verification.

Initial checks exposed a fixture using the wrong ModelGateway constructor, an
incorrect private-payload assertion matching the legitimate public type `prompt`,
an auth Link search-key type error and a route-generator footer mismatch. These
were corrected without weakening ownership/integrity/runtime assertions. The old
P8 assertions requiring `setAcquired(true)` / `setInstalled(true)` and fake creator
financial panels were replaced with assertions for canonical readiness/trial calls
and absence of simulated success. Critical FI4 gates are behavioral and SQL tests.

## Safety and remaining external verification

Migration `20260922000000_fi4_marketplace.sql`: MIGRATION_SOURCE_ONLY. It ran only
inside isolated PGlite tests. No hosted migration was applied. Rollback reasoning
is in the migration: disable new endpoints, export actual Marketplace records,
then remove new functions/tables in reverse dependency order without altering
FI1–FI3 data. No duplicate project, memory, orchestration or payment tables.

Secret review covered all changed tracked/untracked source, tests, migration,
messages and evidence. Only configuration variable names and deterministic
fixtures exist; no credentials or dependency/build caches enter commits.
The September 23 scan also reviewed the existing negative-validation credential
fixture in `tests/p6-marketplace.test.mjs`; it is unchanged from the FI3 base,
not an added credential. No credential value is included in scan output.
No private package/project content is placed in URLs, public traces or analytics.

DEFERRED_EXTERNAL: signing authority; live third-party MCP verification; paid/live
provider trial; hosted migration; rendered browser/mobile/RTL/accessibility QA;
real-user Marketplace validation. RENDERED_PASS and LIVE_VERIFIED are not claimed.
Unsupported sandbox capability types are labelled unavailable, not fake-tested.
FI5 commerce/creator economy remains NOT_STARTED.

Main modified: NO. Production modified: NO. Production Supabase modified: NO.
DNS/payments/payouts modified: NO. No merge, force push, history rewrite or deployment.

The final preservation branch is required to contain the exact incremental Git
bundle, SHA-256, literal final HEAD/remote HEAD manifest and a scoped non-force
recovery workflow. Recovery verifies the FI3 prerequisite, bundle identity,
ancestry and remote equality. FI4_PASS and NEXT_ALLOWED_STAGE=FI5 are recorded
only in the final companion after that equality is observed. FI5 is not executed.
No local-only completion is accepted.
