# ADR-0001 — XEOMX Platform Intelligence Foundation

Date: 2026-09-09
Status: **PROPOSED — implementation blocked by P0 canonical-source recovery**

## Context

XEOMX needs Model Gateway, Memory, Project Brain, Global Search, Agent Orchestration, Browser/Computer tools, creative workflows, automation, team agents, and a marketplace without becoming a collection of unrelated third-party frameworks.

The current core is TypeScript/React/TanStack with Supabase and Cloudflare. The platform already has provider routing, generation, research and sandbox-agent foundations in staging. The next architecture must preserve those investments and keep provider/framework choices replaceable.

## Decision

### 1. XEOMX owns all public contracts

Third-party frameworks sit behind adapters.

```text
UI
 -> Command / Task API
 -> Orchestrator Contract
 -> Skill Registry
 -> Tool Registry
 -> Model Gateway
 -> Provider Adapters
```

No UI route may depend on LangGraph, CrewAI, Mastra, Mem0, n8n or any other framework-specific object model.

### 2. Canonical data remains in XEOMX storage

Supabase/Postgres remains canonical for product state unless a later ADR replaces it.

Canonical objects include:

- users / organizations / workspaces
- projects
- conversations
- memories
- assets
- generations
- tasks / runs
- agent definitions
- skills
- workflow definitions
- approvals
- audit events
- credits / billing records
- marketplace objects

External tools may maintain execution caches/checkpoints but must be reconstructable or safely disposable.

### 3. Memory is a product capability, not a vendor feature

Memory scopes:

```text
user
project
character
voice
conversation
agent
brand
```

Required fields/concepts:

- owner / workspace
- scope
- subject
- normalized content
- source/provenance
- confidence
- pinned vs inferred
- embedding reference
- created/updated/last-used timestamps
- expiration/retention
- permissions
- soft-delete/audit semantics

Memory UX must expose view/edit/delete/disable controls.

Mem0 is an adapter/algorithm candidate, not the canonical store contract.

### 4. Project Brain composes existing primitives

Project Brain is not a second database. It is a retrieval/context service across:

- project metadata
- files
- conversation context
- project memory
- assets
- tasks/runs
- decisions
- generated artifacts

It produces a bounded, provenance-aware context package for models/agents.

### 5. Global Search uses one result contract

All search providers map into a single result type with:

- object type
- object id
- title/preview
- structured filters
- relevance score
- source/provenance
- permissions
- deep link/action

Search implementation may combine PostgreSQL FTS, vector retrieval and specialized external search, but the UX sees one search product.

### 6. Orchestration is layered

Use the lightest layer that satisfies a job:

- simple single-tool task: direct typed execution
- multi-step deterministic flow: internal workflow runner
- agentic tool loop: agent runtime adapter
- long-running/durable graph: durable orchestrator adapter/service

This avoids routing every feature through a heavyweight agent framework.

### 7. Approval and policy are independent of agent frameworks

Every tool declares:

- risk level
- required permissions
- data domains
- network domains
- secret requirements
- reversibility
- approval policy
- cost class

The XEOMX policy layer decides whether execution proceeds. Framework-native approvals can supplement but never replace this control.

### 8. Cost routing is a first-class contract

Before an eligible run:

```text
task
 -> capability candidates
 -> quality mode
 -> provider health
 -> estimated cost
 -> budget check
 -> routing decision
```

The execution ledger records predicted and actual cost.

### 9. Creative workspace has one composition model

Simple and Pro/Node modes are two views over the same project graph. Media types and operations are typed, reusable project objects rather than vendor-specific nodes.

### 10. Automation engines are connectors

n8n/Activepieces/Kestra/etc. are optional execution integrations. XEOMX keeps the canonical workflow definition or a portable mapping sufficient to migrate away.

## Initial Adapter Strategy

| Domain | Preferred first spike | Fallback/reference |
|---|---|---|
| TS agent runtime | OpenAI Agents SDK JS / Mastra | internal minimal runner; LangGraph JS/service |
| durable graph | LangGraph semantics/service where justified | internal workflow runner |
| memory | native Postgres/vector + Mem0 adapter | Cognee/graph augmentation |
| browser | Browser Use behind XEOMX BrowserTool | other browser agents after exact audit |
| coding | OpenHands/Cline patterns/adapters | Aider; mini-SWE-agent evaluation |
| automation | n8n external connector + Activepieces evaluation | Kestra; Node-RED patterns |
| creative | native XEOMX graph using OpenCut/Rendiv patterns | NodeTool/OpenScene/Node Banana as references |

## Non-Goals

- importing entire external dashboards
- exposing framework choice to normal users
- maintaining separate project/memory stores per agent framework
- giving browser/coding agents unrestricted host access
- creating hundreds of narrowly named agents when reusable skills suffice

## P0 Dependency

This ADR may guide schemas/interfaces now, but no new runtime dependency is approved until:

1. canonical Stage 5.4 source is restored,
2. fresh exact install/build/test evidence passes,
3. isolated staging deploy is available,
4. release-critical E2E gates can run against one exact source.

## Consequences

Positive:

- provider/framework portability
- cleaner licensing boundaries
- consistent UX
- central permissions/cost/audit
- lower migration risk

Tradeoffs:

- additional adapter code
- some framework features cannot be exposed immediately
- internal contracts must be maintained carefully
- durable orchestration may require a separate service boundary instead of a pure edge-only runtime
