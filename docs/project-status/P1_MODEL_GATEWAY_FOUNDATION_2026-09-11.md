# P1 Model Gateway foundation

Scope completed: provider-neutral contracts, injected adapter boundary, deterministic FAST/BALANCED/BEST routing and executable gateway. This is foundation acceptance, not completion of the full Intelligence Core or live provider validation.

Branch: feature/xeomx-p1-model-gateway-20260911.
Parent P0 source baseline: d01d50d6d1ece3877654f0f325b79d2e9caad275. Subsequent P0 formatting-only correction: 703ff28b7294075950ce8ab621150ad68834c849; identical test formatting included here. Initial P1 contracts commit: e06496041cc04c942d98196c2417ca90e0fb50e3.

## Ownership and behavior

XEOMX UI → Task Router → Orchestrator → Skills / Tools → Model Gateway → Provider Adapters remains the architecture. This commit implements only the final two boundaries. It introduces no replacement router/orchestrator, persistence authority, identity, billing, permissions or user data store.

`src/lib/model-gateway/contracts.ts`: XEOMX request, output union (text/structured/embedding), model identity, capability, usage, measured gateway latency, provider identity/health, normalized error and ProviderAdapter contract. No SDK imports or credentials.

`src/lib/model-gateway/gateway.ts`: injected providers, health/discovery filtering, capability matching, deterministic weighted routing with stable identity tie-break, canonical request/response projection, sanitized normalized errors, input and usage checks, cooperative cancellation. Discovery failure becomes unavailable; execution failure remains a normalized failure. No silent execution fallback. Routing uses configured quality, latency and USD cost estimates; these are not live quotes or a P7 Cost Router.

Adapters receive request content explicitly supplied by the caller; unrelated extra caller fields are excluded. Errors never forward raw exception messages, headers or bodies. Legitimate generated output is returned as content. No logging or environment access. Canonical contracts own the shape; future concrete adapters must convert SDK results internally and obtain credentials server-side.

## Validation

- P0 policy-aligned full suite: 126/126 PASS, zero skipped.
- P1 focused tests: 8/8 PASS.
- Final full suite, explicit TAP reporter: 134/134 PASS, zero skipped/cancelled.
- Typecheck: PASS.
- Lint: PASS, 0 errors / 9 pre-existing warnings.
- Diff whitespace check: PASS.
- No dependency/lockfile/canonical changes. No build or live provider request newly executed; existing smoke test checks the previous build artifact and is not fresh build evidence.

Tests cover request/response field isolation, error sanitization, healthy-provider independence, unavailable providers, duplicate registration, discovery ownership, capability rejection, mode routing and stable ordering, invalid requests, cancellation, malformed outputs/usage, structured and embedding results, and absence of SDK imports in public contracts.

## Explicit limits

No concrete production provider adapters wired in this foundation. No changes to current generation execution path or UI. No stream API, autonomous agents, memory/search, DB migration, model SDK, external framework, full health monitoring, forced deadline for non-cooperative adapters, or automatic provider retries implemented. AbortSignal is cooperative; adapters must honor it. Quality/cost/latency estimates are supplied by XEOMX configuration.

Historical J01–J12 and >850 claims remain MISSING_EVIDENCE / NON_BLOCKING_HISTORICAL_GATE per explicit owner policy. Supabase migration state remains DEFERRED_ENVIRONMENT_TASK; Cloudflare remains BLOCKED_BY_EXTERNAL_DEPENDENCY. No archaeology or environment retries occurred.

Main, production deployment, production Supabase, DNS, secrets and payments untouched. No merge or deployment. No new OSS installed.

P0_SOURCE_READY = YES
P1_STARTED = YES
P1_MODEL_GATEWAY = PASS (requested foundation scope)
