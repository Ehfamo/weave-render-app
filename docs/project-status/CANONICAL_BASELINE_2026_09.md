# CANONICAL_BASELINE_2026_09 — ACCEPTED SOURCE BASELINE

Owner decision 2026-09-11 explicitly supersedes the two historical blocking gates. Policy: `P0_SOURCE_ACCEPTANCE_POLICY.json`. J01–J12 and >850 remain MISSING_EVIDENCE / NON_BLOCKING_HISTORICAL_GATE. No journeys invented and no filler translations added.

Full unit suite after policy alignment: **126/126 PASS, zero failures or skipped tests**. Existing locale parity/nonempty assertions remain, with the 515 accepted keys individually protected by `P0_ACCEPTED_LOCALE_KEYS.json`. Real additional keys may be added later. Only the two designated tests changed.

Acceptance scope: SOURCE_BASELINE_ONLY. P0_SOURCE_READY = YES. P1_READY = YES. Not a production-release approval. Validated source commit is the commit introducing the policy (resolve with git log); its hash is recorded in the subsequent P1 evidence. Existing canonical identities and prior unchanged-source validation are preserved in the JSON companion.

Supabase remains a deferred environment task with previously observed schema mismatch. Cloudflare remains BLOCKED_BY_EXTERNAL_DEPENDENCY. Neither environment was retried. Main, canonical files, dependencies and production untouched.

## Historical review (superseded acceptance decision; evidence preserved)

# CANONICAL_BASELINE_2026_09 — final evidence snapshot

**P0 = BLOCKED. Acceptance = NOT_ACCEPTED. P1_READY = NO. P1_STARTED = NO.**

This committed snapshot records the canonical identity and remaining acceptance gaps. It is not a green baseline or permission to begin P1. The machine-readable companion contains hashes, sizes, lineage, commands, exact search scope, environment results and provenance.

Validated/reviewed source HEAD: `721f344096fb73bbce396be355fc772fae2297cb`. The evidence commit is the commit introducing this file and is recorded by exact SHA in Issue #3, avoiding self-reference.

## Fresh evidence

- Four canonical hashes and sizes, and lockfile hash: PASS using Python hashlib on current bytes. No canonical edits.
- Unit/Contract: 124/126 PASS, 2 FAIL, zero skipped. Output (trailing whitespace normalized): `p0-final-evidence-2026-09-11/unit.txt`. Tests and aggregator remain unchanged.
- Locale parity and nonempty strings: PASS, 515 keys in each of en/fa/ar/zh/hi.
- Translation completeness: MISSING_EVIDENCE; the existing >850 assertion remains FAIL. GitHub path history traces its introduction on P0 to reconciliation commit 8bca11a, which had only 480 English keys. Available 14 historical catalogs contain 35–511 keys. No independent key inventory or explicit supersession was located in repository documentation or the bounded archive scan. A mismatch at introduction does not prove the assertion obsolete. No fabricated keys or lowered assertion.
- Supabase staging bzoikmppvwiidyjdaqgv: FAIL compatibility. Read-only catalog lookup returns null for creator_stats, likes, saves, follows, comments, prompt_views. Existing migration 20260710134256 is not recorded. Access works; 37 public tables have RLS enabled. This supports unapplied migration state, not a credential diagnosis. No migration or data mutation performed.
- Cloudflare: BLOCKED_BY_EXTERNAL_DEPENDENCY. Current configuration names weave-render-app; deployment workflow uses main and plain wrangler deploy. There is no verified isolated target for this run. Prior CI shows credential presence, not permissions. No remote deployment attempted.

## Reused validation

Run 34483114678 / job 102890559760 validated source 297319f496376d5aeb8400c3363138b9648d57b8. Current 721f differs only in evidence documents. These are reused results, not fresh reruns: clean install, typecheck, lint, build, integration, migration source checks, smoke, imports/cycles, runtime and bounded browser/RTL/responsive checks, i18n parity, secret scan and backend static checks PASS. Unit and overall aggregator FAIL. Browser checks do not replace original journeys or prove all hydration scenarios. Database migration source tests do not prove deployed schema compatibility.

## Journeys

J01, J02, J03, J04, J05, J06, J07, J08, J09, J10, J11, J12: each MISSING_EVIDENCE; each NOT_RUN.

Exact prior search evidence is preserved in `p0-last-mile-2026-09-10/historical-search.json`: 21 branch refs / 16 distinct HEADs, path history, two patches, and three supplied ZIPs. Incomplete code search is explicitly bounded. No replacement journeys were invented.

## Decision and safety

Canonical recovery is resolved; old recovery-blocker text is historical. External limitations alone are not a reason to fail source identity. P0 nevertheless remains BLOCKED because required validation is still red and the translation acceptance contract cannot be resolved from available evidence. This does not assert a newly discovered runtime bug.

Next closure evidence needed: original journey definitions or an explicit replacement acceptance contract; an authoritative translation-key inventory or explicit supersession of the numeric requirement; staging migration reconciliation in a separately authorized operation; a verified isolated Cloudflare target.

This evidence-only commit changes no application code, tests, aggregator, canonical files, dependencies, main, production deployment, production Supabase, DNS, secrets or payments. No P1 work started.
