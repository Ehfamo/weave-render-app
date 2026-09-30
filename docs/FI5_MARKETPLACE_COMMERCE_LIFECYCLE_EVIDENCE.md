# FI5 Marketplace Commerce and Lifecycle — source/integration closure

Closure date: 2026-09-30. Repository: `Ehfamo/weave-render-app`.

- FI4 prerequisite: `b8238f9ed6c82399f89fbc80ba2a8c61d398de60`.
- FI5 branch: `feature/xeomx-fi5-marketplace-commerce-lifecycle-20260924`.
- First checkpoint: `dc8196bf93533d5c818c7123d842c6d756e707eb`.
- Recovered and validated source: `2931d998529cef3578dcb574321dc824c95747dc`.
- Source and deterministic integration: **SOURCE_PASS / INTEGRATION_PASS**.
- Rendered and live financial verification: **DEFERRED_EXTERNAL**, never LIVE_VERIFIED.

All runtime, UI, test and migration changes are in the validated source commit.
The closure commit adds only evidence and preservation metadata. The exact final
commit, verified remote equality, bundle digest and recovery instructions are
recorded after publication in `preservation/xeomx-fi5-final-20260930` at:
`artifacts/fi5-preservation/XEOMX_FI5_FINAL_CLOSURE_20260930.manifest.json`.

The FI5 source-branch copy of the manifest is the pre-publication validation record
and points to that finalized preservation copy. A commit cannot embed its own Git
hash. FI5_PASS requires the finalized copy to confirm exact remote equality; this
evidence document alone does not assert publication.

## Canonical architecture and behavior

FI5 extends MarketplaceService and SupabaseMarketplaceStore. It reuses FI4 immutable
package/version identity, SHA-256 integrity, permissions, dependencies, privacy,
trial and review rules. It reuses billing_checkout_intents, billing_payment_events,
billing_webhook_receipts, billing_entitlements, approval_requests, audit_events,
projects and project membership. It adds no parallel payment ledger or approval engine.

- **Publishers/publishing:** distinct lifecycle, identity, commerce and payout
  eligibility. Owner-authorized drafts pass canonical digest, metadata, license,
  privacy and dependency checks. Risk signals require review. Published content is
  immutable; changed content requires a new version. Publishers cannot self-assert
  external payout verification.
- **Prices/licenses:** FREE, ONE_TIME and SUBSCRIPTION contracts; integer minor
  amounts, explicit USD/IRR/IRT (Toman), effective dates and truthful tax status.
  No implicit conversion. Acquisition price, digest and license snapshots are immutable.
- **Acquisition/entitlement:** project-authorized, audited, idempotent free acquisition
  can activate access. Paid acquisition requires canonical approval and authoritative
  provider evidence. Client success cannot activate entitlement. Unconfigured paid
  acquisition remains PROVIDER_PENDING / NOT_CONFIGURED. Recurring execution is external.
- **Transactions/events:** validated transitions, durable claims and exact request
  fingerprints. Repeated requests return the same result; conflicts fail closed.
  Provider events require verified binding, digest, amount, currency and allowed
  transition. Duplicate, conflicting, unsigned, oversized and tampered events are tested.
- **Refunds/disputes:** atomic refund reservations bind the settled transaction,
  enforce the ceiling and prevent double refund. Approval/rejection/provider-pending
  states persist; REFUNDED requires verified reconciliation. Dispute evidence is
  transaction-scoped, with explicit counterparty concessions rather than fabricated
  adjudication. Buyer resolution cannot close before required refund reconciliation.
- **Earnings/revenue/payouts:** authoritative settled billing events produce separate
  gross, fee, refund adjustment and creator net. Unknown fee configuration remains
  unknown and held. Payout reservation includes the full available currency balance,
  including negative post-payout refund adjustments. Held/disputed/unsettled amounts,
  currency mismatch, missing eligibility and duplicate reservation fail closed.
  PAID requires matching verified settlement evidence. No configured provider means
  no transfer. Analytics use persisted records; unavailable conversion is NOT_ENOUGH_DATA.
- **Lifecycle:** deprecation/withdrawal preserve historical ownership and audit.
  Withdrawal prevents new acquisition; SECURITY_BLOCKED denies execution authorization.
  Historical acquisition retries remain idempotent without permitting new acquisition.
- **Enterprise policy:** project-owner control of package types, maximum amount and
  currency, publisher allow/block rules, permissions, consequential operations,
  network hosts, security review, admin approval, version pins and commercial license.
  Resume and checkout recheck current policy; old approval cannot bypass new restrictions.
- **Audit/privacy:** consequential changes reuse canonical audits. Ownership, project
  membership and designated approver are server-enforced. Unexpected database errors
  are masked. Raw provider payloads and credentials are absent from browser responses.

## UI and localization

MarketplaceWorkspace uses MarketplaceCommercePanel and MarketplaceAcquisition through
marketplaceCommerceFn → allow-listed dispatchCommerce → MarketplaceService → authenticated
Supabase RPC. It displays actual publishing, quote, acquisition, entitlement/license,
transaction, approval, refund/dispute, earning, payout and lifecycle states. Source
publishing/price forms and project policy controls call canonical operations. Current
price projections respect visibility. No fake sales, ratings, earnings or financial success.

Private responses are actor-bound and the private panel is keyed by user identity.
Stable request keys protect uncertain retries without canonical browser storage.
Forms have labels, semantic headings, keyboard controls and focus styles. New FI5
keys preserve en/fa/ar/zh/hi parity. Rendered accessibility, translation quality and
RTL behavior are not claimed as verified.

## Persistence and isolation

Migration: `supabase/migrations/20260924063459_fi5_marketplace_commerce.sql` —
**MIGRATION_SOURCE_ONLY**. Marketplace-specific publisher, draft, price, acquisition,
adjustment, earning, payout, receipt and policy records extend existing billing and
approval boundaries. RLS, explicit grants, service-only RPC execution, actor checks,
immutable snapshots and atomic accounting reservations are tested with PGlite PostgreSQL.
Public price projection uses caller security. Browser callers cannot dispatch provider
settlement or reference commands.

Tests cover cross-buyer/creator/project denial, private adjustment evidence, financial
record visibility, membership revocation, actor impersonation, fake entitlement activation,
arbitrary transitions and policy bypass. Deterministic providers and synthetic records
are test adapters only. No hosted database or financial provider was used for validation.

## Executed validation at 2931d998529cef3578dcb574321dc824c95747dc

Dependencies used the repository lockfile (`npm ci --no-audit --no-fund`). Focused
commands used `node --experimental-strip-types --test` with the files below. Counts
include parent tests where the Node reporter includes them.

| Gate | Actual result |
| --- | --- |
| tests/fi5-commerce.test.mjs | 29/29 INTEGRATION_PASS |
| tests/fi5-closure.test.mjs | 12/12 INTEGRATION_PASS |
| tests/fi5-persistence.test.mjs | 15/15 INTEGRATION_PASS |
| FI5 combined | 56/56; 0 failed, 0 skipped |
| FI4 Marketplace + PostgreSQL | 40/40 (27 + 13) INTEGRATION_PASS |
| Existing billing boundary + migration | 15/15 PASS |
| Critical FI3/FI2/FI1, Brain, Memory, Search/Command Center | 110/110 PASS |
| npm run typecheck | SOURCE_PASS; 0 type errors |
| npm run lint | SOURCE_PASS; 0 errors, 11 existing Fast Refresh warnings |
| npm run build | SOURCE_PASS; local production package, not deployed |
| npm test | 470/470; 0 failed, 0 skipped, 0 cancelled |
| npm run test:smoke | 1/1 SOURCE_PASS |
| git diff --check | SOURCE_PASS |
| Changed-file secret/credential review | SOURCE_PASS; no actual credentials |

Critical regression files (tests/*.test.mjs): fi3-capability-runtime, fi3-persistence,
fi2-projects-continuity, fi2-persistence-migration, fi1-core-execution, project-brain,
memory-core, memory-migration, global-search, command-center, stage53-project-search.

Full suite and production build ran once after focused validation. The build preceded
full suite because its canonical smoke test requires fresh .output artifacts. Build
warnings: Nitro ignores inlineDynamicImports with codeSplitting; generated Wrangler
main overrides the configured value. npm warns about environment http-proxy config.
All 11 lint warnings are in files unchanged by FI5. Secret scan's sole generic-key
match is the explicit non-secret rejection fixture in fi5-commerce.test.mjs. Validation
summaries and log digests are in the manifest; no unexecuted test is reported as PASS.

## Exact history and external limits

Implementation commits, oldest first:
`dc8196bf93533d5c818c7123d842c6d756e707eb`,
`3e01e4d9fd8f40b658d7437f369687de685eef2f`,
`7601c9976570fb6b16a1fd384a7820817144f90b`,
`4232b0710817311fc1bc287fbb79051cef2fc38b`,
`2931d998529cef3578dcb574321dc824c95747dc`.
Recovered UI/boundary changes were preserved on GitHub before validation. The final
closure commit and exact recovery bundle are identified in the finalized preservation
manifest. No published history is rewritten.

Payment, refund and payout providers: **NOT_CONFIGURED**. Live charges/refunds/payouts,
recurring settlement, financial webhook signature verification, KYC/KYB, bank/card and
tax verification are **DEFERRED_EXTERNAL**. Hosted migration, live Marketplace
providers/signing inherited from FI4, rendered browser/mobile/RTL/accessibility QA
and real-user commerce validation are **DEFERRED_EXTERNAL**. Deterministic tests do
not promote these external items to PASS.

Main unchanged. Production and Production Supabase unchanged. No hosted migration,
DNS change, deployment, real payment or payout. No live financial credentials.
No real money moved. **FI6 NOT_STARTED**.
