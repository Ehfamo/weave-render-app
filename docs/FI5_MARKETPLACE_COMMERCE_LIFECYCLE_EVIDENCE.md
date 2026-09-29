# FI5 implementation checkpoint — NOT CLOSED

Repository: Ehfamo/weave-render-app
Source FI4: b8238f9ed6c82399f89fbc80ba2a8c61d398de60
Branch: feature/xeomx-fi5-marketplace-commerce-lifecycle-20260924

This early checkpoint preserves source work before expensive validation. No FI5 PASS is claimed.

The implementation extends MarketplaceService / SupabaseMarketplaceStore and existing
billing_checkout_intents, billing_payment_events, billing_entitlements, approval_requests,
audit_events and immutable FI4 package/version identity. New Marketplace-specific records
hold governed draft state, price/license snapshots, refund/dispute adjustments, earning
entries, payout accounting and enterprise policy. It does not introduce a second payment
ledger or approval engine.

Implemented checkpoint: typed provider-neutral extension, safe command boundary, creator
states, governed draft/validation/publication, explicit USD/IRR/IRT (Toman) price identity,
immutable snapshots, free acquisition, authoritative pending paid acquisition, scoped
enterprise policy and canonical approval consumption. Financial settlement/refund/dispute/
payout commands, localized UI and full behavioral/PostgreSQL coverage remain IN PROGRESS.

The Supabase CLI created 20260924063459_fi5_marketplace_commerce.sql. It is
MIGRATION_SOURCE_ONLY. No hosted database operation occurred. Relevant current Supabase
RLS/function documentation and changelog were checked; no changed API is introduced.

Payment/refund/payout providers: NOT_CONFIGURED. No production adapter or financial
credential was injected. Financial execution and signature verification remain
DEFERRED_EXTERNAL. No real money moved. Main/Production untouched. FI6 NOT_STARTED.

Validation: NOT_STARTED at this preservation checkpoint; diff whitespace check only.

## Recovery continuation — 2026-09-29

The previous local directory was unavailable. Exact GitHub checkpoint
`dc8196bf93533d5c818c7123d842c6d756e707eb` was recovered from a complete Git bundle
produced by the scoped recovery workflow. No approximate source was used.
Checkpoint `3e01e4d9fd8f40b658d7437f369687de685eef2f` was then imported on GitHub
and its remote equality verified.

The finance extension now implements authoritative payment event ingestion,
refund reservation/approval/provider-pending/verified reconciliation, explicit
counterparty dispute resolution, settled-ledger earnings, full-currency-balance
payout reservation including negative adjustments, and verified payout settlement.
It uses existing billing events, entitlements, approvals and audits.
Acquisition terms, prices, versions and accounting evidence are immutable.
No production provider is configured; deterministic provider adapters are tests only.

Targeted execution in this environment: `tests/fi5-commerce.test.mjs` 29/29 and
`tests/fi5-persistence.test.mjs` 15/15, combined 44/44, no failed/skipped tests.
Counts include one parent test per file. These are INTEGRATION_PASS, not LIVE_VERIFIED.
UI integration, additional policy/provider boundary coverage and final regression
remain incomplete. FI5 is still IN_PROGRESS, not closed.
