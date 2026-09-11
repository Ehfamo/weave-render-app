# P1.2 Model Gateway runtime completion

Branch: feature/xeomx-p1-model-gateway-20260911.
Starting HEAD: 453281e85e742d6c73f4211f8c85dbfa59fc203d.
Validated source HEAD: 9853826f3f011865f8982b38cfdc2fffaf32b203.

P1_MODEL_GATEWAY_RUNTIME = PASS (source/runtime integration)
P1_LIVE_PROVIDER = MOCK_ONLY
Live execution = BLOCKED_BY_CREDENTIAL
P1_MEMORY_STARTED = NO

## Existing paths and migrated path

The existing authenticated Supabase generation worker calls Cloudflare AI, Gemini and Groq via REST. Existing configured models are @cf/meta/llama-3.1-8b-instruct-fast, gemini-3.5-flash, and llama-3.1-8b-instant respectively. No provider SDK was added.

Only the Groq route was migrated: existing job submission → queue/worker-token authorization → existing worker selection → groq-gateway.ts bridge → XEOMX registry/runtime/gateway → Groq adapter → normalized response → existing completion RPC. The default Cloudflare route and Gemini calls remain unchanged. Queue claiming, credit reservation, access controls, research citation validation, and completion/failure persistence stay with their original owners.

The bridge imports the single canonical gateway implementation by relative paths. It does not copy source or import the TanStack/Node server factory into Deno. An esbuild dependency-graph test bundles the entire worker with npm Supabase import external and confirms shared gateway inclusion. This is not a deployed Deno integration test; no function was deployed and Deno CLI is absent locally.

## Defects closed

Previously the adapter dropped usage unless both counts existed and the normalized boundary discarded provider request ID/finish reason. Partial counts are now optional and retained individually; absent values remain absent/null. Supplied totalTokens is preserved, not estimated. Canonical completion metadata retains only requestId and finishReason so the worker can keep its existing persistence contract.

Worker errors now preserve the normalized retryability decision. Authorization, permission, malformed request and policy errors do not trigger outer fallback. The bridge uses one internal attempt, since the worker already controls provider transitions/citation retries. This avoids multiplying retry budgets.

## Registry/runtime

Registry supports duplicate rejection, enable/disable, safe provider/model/capability/health snapshots. Runtime executes canonical requests through ranked available adapters. FAST/BALANCED/BEST keep provider-independent deterministic ranking and identity tie-breaks. Runtime records each attempted model/provider, attempt latency, overall latency, selected model, mode and fallbackOccurred. Default maximum is three attempts, alternate eligible models first; no more than three even for transient failures. Hard attempt deadline defaults to 25 seconds and aborts cooperative transport. Cancellation stops further attempts. Registry discovery is also bounded. A non-cooperative underlying implementation may continue after caller timeout; concrete Groq fetch receives AbortSignal.

Health means configured/last-observed availability, not a periodic live health probe. Model discovery is configured-model discovery. Current default ranking estimates are configuration placeholders for the single model and are not billing prices, measured performance or provider usage.

## Environment and security

The Groq runtime requires only GROQ_API_KEY, server-side. runtime.server.ts has the TanStack server-only import guard and accepts process.env or explicit server bindings. The Deno bridge receives the key from the existing Deno.env.get("GROQ_API_KEY") lookup. No VITE-prefixed key, SDK response type, secret logging or frontend endpoint was added. The original worker independently continues requiring its existing Supabase service configuration and validated worker token; these were not replaced or bypassed.

A fresh presence-only local check found GROQ_API_KEY absent. No key values were printed and no live provider request was attempted. Live result BLOCKED_BY_CREDENTIAL. Mocks test the real adapter/HTTP mapping and full bridge; they do not establish provider connectivity.

Groq REST mapping follows https://console.groq.com/docs/api-reference : chat/completions, max_completion_tokens, provider usage and normalized completion metadata. Redirects are rejected so Authorization cannot be forwarded to an arbitrary redirect target. Error bodies/messages are not returned to product code. No prompt/private output logging added.

## Fresh validation

- Dedicated gateway/runtime/worker integration: 22/22 PASS, no skips.
- Full unit/contract suite: 148/148 PASS, no skips or cancellations (prior committed suite 145/145).
- Typecheck: PASS using local tsc --noEmit.
- Lint: PASS, 0 errors / 9 existing warnings.
- Build: PASS using loopback Supabase configuration; no deployment. Full suite includes smoke checks against this newly built artifact.
- Worker shared-source dependency bundle: PASS in the integration test. No external provider call or DB mutation.

Source commits: b2f6b6f7864f14be6f03a613c8786fb6545880d8 (migration/metadata), 9853826f3f011865f8982b38cfdc2fffaf32b203 (integration tests). This evidence commit follows validation; its SHA is obtained from Git rather than self-embedded.

## Boundaries

Production, main, production Supabase, DNS, Cloudflare production configuration, secrets and payments untouched. No canonical P0 source edits, OSS installation, memory work, merge, or deployment. P0 and its deferred environment/evidence tasks were not revisited. Next operational step is a single non-production live request once an authorized credential and execution environment are available.
