# ADR-0005: XEOMX-owned agent platform

Date: 2026-09-12

## Decision

XEOMX owns provider-neutral task, agent, skill, tool, approval, result and trace contracts. The bounded `TaskOrchestrator` selects an XEOMX runtime deterministically, obtains authorized context only through `ProjectBrainService` (which preserves MemoryService settings and scope), invokes registered tools, and sends model work only through `ModelGateway` using FAST/BALANCED/BEST routing semantics.

No external agent framework is installed. OpenAI Agents SDK, LangGraph and Mastra are classified **REFERENCE**, not runtime dependencies: the existing XEOMX services and Stage 5.3 control-plane primitives already provide the required product ownership, risk and state boundaries. Adopting a framework now would duplicate state and add dependency risk without reducing the implementation.

## Safety and bounds

- Default limits: eight plan steps, eight tool calls, two retries, 24,000 context characters and a 30-second deadline. Constructor bounds prevent unbounded configuration.
- States are queued, planning, waiting_approval, running, completed, failed and cancelled. Tool calls and approval requests are trace events.
- SAFE_READ may execute. LOW_RISK_WRITE, EXTERNAL_ACTION, DESTRUCTIVE and SENSITIVE require explicit approval. The registry never treats a rejected decision as authority.
- Browser reads are separated from approval-gated interaction. The adapter validates allowed HTTP(S) origins and an action allowlist. No browser implementation, shell, database or arbitrary filesystem primitive is exposed.
- Coding is split into restricted read and model-produced proposal. Execution is not enabled by default; future validators must be fixed allowlisted commands behind approval.
- Research cites returned workspace results. External research is absent unless a separately approved adapter is supplied; it cannot be fabricated.
- Traces contain identifiers, status, timestamps, risk classes, retries, model/tool identities and normalized errors, never credentials or raw provider errors.

## Existing primitives reused

`ModelGateway`, `MemoryService`, `ProjectBrainService`, `GlobalSearchService`, Command Center intent contracts, Stage 5.3 risk/approval/audit semantics, project membership/RLS boundaries and existing generation job infrastructure remain canonical. No database, queue, auth, memory store or provider integration was duplicated. No migration or dependency was added.

## Live classification

Source behavior is covered with deterministic adapters and tests. `LIVE_MODEL`, `LIVE_RESEARCH` and `LIVE_BROWSER` remain separately dependent on configured external adapters/credentials. The earlier Cloud Browser localhost policy limitation is not retried and does not invalidate source implementation.
