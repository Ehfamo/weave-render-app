# FI1 Core Execution Closure — 2026-09-14

## Source and scope

- Authoritative source branch: `feature/xeomx-p9-intelligence-excellence-20260914`
- Authoritative source HEAD: `e14edacdcbb9705298a4865ca5d38e3f746ef202`
- FI1 branch: `feature/xeomx-fi1-core-execution-20260914`
- Final FI1 HEAD: the commit containing this closure document; the immutable SHA is recorded in the final FI1 report after commit creation.
- P0–P9 source state: `SOURCE_PASS`
- FI1 source integration: `INTEGRATION_PASS`
- Rendered-browser validation: `NOT_STARTED` (FI7)
- Credentialed live-provider validation: `NOT_CONFIGURED`
- Production deployment: `NOT_STARTED`

FI1 changes only the source execution path. Main, Production, DNS, Production Supabase, payments, and payouts were not modified.

## Baseline validation

The exact P9 source HEAD reproduced the authoritative baseline before FI1 changes:

- Full tests: 303/303 `SOURCE_PASS`; 0 failed; 0 skipped
- Typecheck: `SOURCE_PASS`
- Lint: `SOURCE_PASS`; 0 errors and the same 9 pre-existing Fast Refresh warnings
- Production build: `SOURCE_PASS`

## Canonical architecture reused

FI1 composes the existing architecture rather than introducing parallel systems:

- P9 structured intent: `createExecutionIntent`
- P9 bounded capability planning: `planCapabilities`
- P9 bounded quality loop: `generateEvaluateRepair`
- P9 safe trace: `createExecutionTrace`
- Agent inventory: `AgentRegistry` and `DEFAULT_AGENTS`
- Skill inventory: `canonicalSkills`
- Tool inventory: `createCanonicalTools`
- Orchestration: existing `TaskOrchestrator`
- Approval: existing `InMemoryApprovalStore` boundary and P9 approval requirements
- Model execution: `createModelGatewayRuntime` / existing Model Gateway runtime
- Optional authorized project context: existing Project Brain and Global Search services

## Canonical Goal to Result path

`Home goal → private pending-goal handoff → fixed auth return → authenticated server function → strict request validation → createExecutionIntent → bounded authorized context → planCapabilities with canonical registry inventory → TaskOrchestrator → canonical tool runtime → Model Gateway → generateEvaluateRepair → createExecutionTrace → actual result workspace`

The `/xeomx-ai` route now renders a dedicated executable workspace. The previous `ProductEnvironmentPage` remains available for architecture preview surfaces but is no longer the executable AI workspace.

## Auth handoff and privacy

- Home stores the pending goal in same-origin browser storage with a 10-minute TTL and an opaque UUID idempotency key.
- Navigation uses `/xeomx-ai`; raw goal text is not placed in a query string or callback URL.
- Unauthenticated users return through the existing auth architecture using the fixed `/auth?next=/xeomx-ai` destination.
- The pending goal is removed before it is returned to the workspace, providing consume-once behavior.
- The handoff carries no provider ID, agent ID, tool permission, credential, or authorization grant.
- The handoff is temporary execution state and is not a second Memory or Project Brain.

## Server boundary and idempotency

The authenticated TanStack server function accepts only `goal`, `idempotencyKey`, optional `projectId`, optional canonical `quality`, and optional supported `locale`. It rejects empty/oversized goals, malformed UUIDs, unknown fields, provider or agent selection, capability injection, and unsupported values.

A bounded server idempotency cache coalesces concurrent duplicate requests and rejects reuse of a key with different input. Explicit Retry creates a new idempotency key. Distributed/multi-worker idempotency validation is deferred to FI7; FI1 does not claim `LIVE_VERIFIED` for that environment.

## Model Gateway evidence

The FI1 server composition creates the existing server-only Model Gateway runtime and injects its `execute` boundary into the canonical tools and orchestrator. Quality mode is propagated as `FAST`, `BALANCED`, or `BEST`. No FI1 client component or server action calls a provider directly, and no provider credential is sent to the client.

Without an actually configured provider, execution returns `NOT_CONFIGURED`; it does not fabricate output or a provider success. No credentialed live call was performed, so provider status is `NOT_CONFIGURED`, not `LIVE_VERIFIED`.

## P9 runtime, quality, and safe trace evidence

The server execution service calls the real P9 brief, planner, quality, and trace modules. It does not copy their logic into UI code. Evaluation absence remains `NOT_EVALUATED`. Repairs are bounded to at most two attempts and additionally constrained by abort, timeout, and bounded quality cost. The trace records route and context reference identifiers but not raw goal text, context contents, hidden reasoning, credentials, or stack traces.

## Orchestrator and approval evidence

The P9 plan is adapted to the existing `TaskOrchestrator` task model with enabled canonical agents, skills, tools, and allowed tool IDs. The planner receives no authority to grant permissions. An approval-required intent terminates as `APPROVAL_REQUIRED` before orchestration, so no consequential action is executed. Capabilities outside FI1's general/research runtime scope return an actionable capability-not-yet-integrated failure instead of fake execution.

## User-visible failure truth

The workspace distinguishes completed, approval-required, not-configured, budget-stopped, cancelled, and failed outcomes. It renders the actual server result, grounded quality/verification status, actual sources only when present, a bounded trace disclosure, and a specific next action such as retry, configure provider, review approval, reduce scope, or return to the goal.

## Material files changed

- `src/lib/core-execution/contracts.ts`
- `src/lib/core-execution/handoff.ts`
- `src/lib/core-execution/idempotency.ts`
- `src/lib/core-execution/service.ts`
- `src/lib/core-execution/runtime.server.ts`
- `src/lib/core-execution/functions.ts`
- `src/components/xeomx/ai/XeomxAiWorkspace.tsx`
- `src/components/xeomx/os/HomeExperience.tsx`
- `src/routes/xeomx-ai.tsx`
- `src/lib/agents/orchestrator.ts`
- `src/lib/agents/runtimes.ts`
- `src/lib/agents/tools.ts`
- `messages/en.json`, `messages/fa.json`, `messages/ar.json`, `messages/zh.json`, `messages/hi.json`
- `tests/fi1-core-execution.test.mjs`

## FI1 validation

- FI1 focused behavioral integration tests: 13/13 `INTEGRATION_PASS`; 0 failed; 0 skipped
- Full source suite: 316/316 `INTEGRATION_PASS`; 0 failed; 0 skipped
- Typecheck: `INTEGRATION_PASS`
- Lint: `INTEGRATION_PASS`; 0 errors, unchanged 9 Fast Refresh warnings
- Production build: `INTEGRATION_PASS`
- Rendered browser, RTL measurement, and accessibility measurement: `NOT_STARTED` (FI7)
- Live provider execution: `NOT_CONFIGURED`

## Explicit deferred items

- FI2: persistent Projects, Project Brain continuity, history, and Memory controls — `NOT_STARTED`
- FI3: Creative, Business Agents, Automation, Team runtime wiring, and complete approval operations — `NOT_STARTED`
- FI4: Marketplace discovery, trust, trial, MCP, and security closure — `NOT_STARTED`
- FI5: Marketplace commerce, creator economy, lifecycle, and private marketplace — `NOT_STARTED`
- FI6: enterprise, global, mobile, low-data, connectors, and product excellence closure — `NOT_STARTED`
- FI7: rendered browser E2E, real-user validation, credentialed live-provider validation, live payment sandbox, staging, and release evidence — `NOT_STARTED`
- Production release — `NOT_STARTED`

No deferred item is reported as `RENDERED_PASS` or `LIVE_VERIFIED`.
