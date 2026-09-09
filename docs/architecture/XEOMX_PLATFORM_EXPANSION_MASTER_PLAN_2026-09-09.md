# XEOMX Platform Expansion Master Plan — 2026-09-09

Status: **PLANNING / NO MERGE / NO PRODUCTION CHANGES**

## Mandatory OSS Governance Rule

> Never install, copy, vendor, or merge an open-source project blindly. Before any code adoption, evaluate License, Stack Compatibility, Security, Maintenance, Dependency Risk, and whether the useful value can be extracted as a Pattern/Component instead. Every candidate must receive exactly one decision: **ADOPT / ADAPT / REFERENCE / REJECT**.

This rule is a release gate, not a suggestion.

## Safety Invariants

- Do not merge this planning branch into `main` during P0 recovery.
- Do not deploy or modify Production.
- Do not modify Production Supabase (`rvqexyiegtunkthtgrna`).
- Do not modify production DNS.
- Do not begin Stage 6 until the Stage 5.4 canonical source and pre-production gates are closed.
- No new framework dependency is allowed while the canonical Golden source is not reproducible.
- GPL/AGPL/BSL/source-available code must not enter proprietary XEOMX code without explicit legal review and an approved isolation strategy.

## Current Baseline / Why P0 Comes First

The latest Stage 5.4 evidence reports a strong internal verification baseline (build, typecheck, lint, tests, integration, migrations, smoke), but a later continuation audit found that the currently sealed Golden package cannot be independently reconstructed as the complete prior Golden source. Four architecture files are missing from the current Golden package / current verification source path, and prior reconstruction payloads failed integrity checks.

Therefore the next task is **not feature expansion**. The first task is to restore a single, reproducible canonical source and then re-run the release evidence from that source.

### Canonical source files currently requiring recovery / reconciliation

- `src/lib/product-architecture.ts`
- `src/lib/core-workflows.ts`
- `src/lib/platform-contracts.ts`
- `src/components/xeomx/product/ProductWorkspacePreview.tsx`

## Target Product Architecture

```text
XEOMX
  |
  +-- AI Command Center
  |     |
  |     +-- Memory
  |     +-- Projects / Project Brain
  |     +-- Global Search
  |     +-- Orchestrator
  |           |
  |           +-- Agents
  |           +-- Skills
  |           +-- Tools
  |           +-- Approval / Policy / Audit
  |
  +-- Task Router
  |     +-- Quality Requirement
  |     +-- Budget / Cost Policy
  |     +-- Latency Policy
  |     +-- Capability Requirements
  |
  +-- Model Router
  |     +-- LLM
  |     +-- Image
  |     +-- Video
  |     +-- Voice / TTS
  |     +-- Music
  |     +-- Embeddings
  |     +-- Search
  |     +-- Upscaling
  |
  +-- Creative Workspace
  |     Idea -> Create -> Edit -> QA -> Publish -> Sell
  |
  +-- Automation
  +-- Team Workspace
  +-- Marketplace / Creator Economy
  +-- Analytics / Evals / Observability
```

## Core Platform Contract

Existing core stack remains the default unless an ADR explicitly changes it:

- React + TypeScript + TanStack
- Supabase: Auth / PostgreSQL / Storage / RLS
- Cloudflare Workers
- Tailwind + shadcn/ui + Radix
- Paraglide / Inlang for i18n
- Global Core -> Localization Layer -> Country Experience
- Credits / Subscription / Marketplace / Creator Economy / Payout
- Provider-neutral Model Gateway

The browser UX must never be coupled directly to a provider SDK.

```text
XEOMX UI -> Task Router -> Model Router -> Provider Adapter
```

Advanced users may select models. Default users receive automatic selection based on task, quality, speed, cost, safety, and availability.

---

# P0 — Restore and Complete the Current Product

## P0.1 Canonical Source Recovery [BLOCKING]

Goal: create one hash-stable, reproducible source tree before adding any new framework.

Acceptance criteria:

1. Recover/reconcile the four missing Golden architecture files from verified evidence or a trusted prior artifact.
2. Identify one canonical commit/branch as the sole release candidate source.
3. Remove dependence on corrupt sealed reconstruction payloads.
4. Fresh dependency installation using the exact lockfile is successful.
5. Build / typecheck / lint pass from the canonical source.
6. Full regression, integration, migration, smoke, and secret scans are re-run from that exact source.
7. New manifest + SHA256 + source inventory is generated.
8. No PASS is inherited from an older source tree without re-execution.

## P0.2 External Pre-Production Gates [BLOCKING]

- Cloudflare isolated staging deployment permission/token.
- Supabase leaked-password protection / plan configuration.
- Gemini staging credential.
- Groq staging credential.
- Approved payment provider + sandbox configuration.

## P0.3 Browser Release Verification [BLOCKING]

After exact isolated staging deployment:

- J01-J12 Route E2E.
- J01-J12 Action E2E.
- Browser security checks.
- axe accessibility gate.
- Lighthouse performance gate.
- Cross-locale critical journey sampling.
- Mobile critical journey sampling.

## P0.4 Payments / Credits / Auth / DB Truth

- Verify subscription lifecycle.
- Verify credit reserve / charge / release / refund semantics.
- Verify payment webhook idempotency.
- Verify cancellation / failed payment / retry behavior.
- Verify RLS and role boundaries.
- Convert remaining mock-backed release-critical surfaces to real adapters.

P0 exit: `READY_FOR_USER_APPROVAL`. Stage 6 remains forbidden until this exit condition is met.

---

# P1 — Smart Foundation

Build only after P0 canonical-source gate is green.

## P1.1 Provider-Neutral Model Gateway

Introduce typed internal contracts rather than provider-specific UI state.

Core entities:

- `CapabilityKind`
- `ProviderId`
- `ModelId`
- `ModelCapability`
- `RoutingPolicy`
- `QualityMode = fast | balanced | best`
- `CostEstimate`
- `ProviderHealth`
- `GenerationRequest`
- `GenerationResult`
- `RoutingDecision`

Routing factors:

- task capability
- quality requirement
- budget
- latency target
- provider health
- locale
- safety / content policy
- context window / media limits
- historical success rate

Estimated cost must be available before execution wherever the provider exposes enough pricing metadata.

## P1.2 Memory + Project Brain

Default architecture:

```text
Memory API / Policy Layer
       |
       +-- User Memory
       +-- Project Memory
       +-- Character Memory
       +-- Voice Memory
       +-- Conversation Memory
       +-- Agent Memory
       +-- Brand Memory
       |
       +-- Supabase Postgres
       +-- Vector Search
       +-- Object/Asset references
```

Required controls:

- view memory
- edit memory
- delete memory
- disable memory
- per-scope permissions
- retention controls
- provenance/source
- timestamps
- confidence
- conflict resolution
- explicit pinned facts vs inferred facts

Memory is user-owned product data. No third-party memory framework is allowed to become the canonical ownership layer.

## P1.3 Global Search

Search across:

- projects
- conversations
- memories
- assets
- files
- generations
- agents
- skills
- marketplace objects
- team content

Use hybrid retrieval where justified: structured filters + text search + vector search.

## P1.4 Command Center Foundation

Natural-language goal -> plan -> capability graph -> cost preview -> approval -> execution -> progress -> result.

The user must not need to know how many agents or models are used.

---

# P2 — Agent Core

## Orchestrator

Must support:

- state
- checkpoints
- resumability
- deterministic tool contracts
- human approval
- cancellation / stop control
- max-step limits
- budget limits
- retries with idempotency
- tracing
- audit logs
- tool permissions

## Agent Roles

Coding pipeline:

```text
Requirement -> Plan -> Code -> Test -> Debug -> Review -> PR
```

Roles:

- Architect Agent
- Frontend Agent
- Backend Agent
- Database Agent
- Test Agent
- Security Agent
- Code Review Agent
- Debug Agent

Other base agents:

- Research
- Browser
- Creative Director
- Data Analyst

## Skills over Agent Explosion

Prefer a small set of capable agents with composable skills.

Example Video Agent skills:

- Storyboard
- Cinematography
- Prompt Engineering
- Continuity
- Editing
- Color
- Sound Design

## Browser / Computer Safety Contract

Every high-impact browser operation must pass:

```text
Sandbox -> Permission -> Preview -> Approval -> Execute -> Log -> Stop/Undo where possible
```

No silent purchasing, publishing, deletion, credential changes, financial actions, or destructive external actions.

---

# P3 — Creative Workspace

## Unified Flow

```text
Prompt -> Image -> Video -> Voice -> Music -> Edit -> Review -> Export
```

Modes:

- Simple Mode: goal-driven, minimal choices.
- Pro / Node Mode: explicit graph, reusable nodes, model overrides, batch controls.

## Video Production Pipeline

```text
Idea
-> Research
-> Script
-> Director
-> Storyboard
-> Character Consistency
-> Shot Planning
-> Image Generation
-> Video Generation
-> Voice
-> Music
-> Editing
-> Critic / QA
-> Fix
-> Export
```

## Central Asset Library

Asset types:

- Characters
- Faces / References
- Voices
- Products
- Logos
- Clothing
- Locations
- Props
- Music
- Brand Assets
- Prompt Presets

Every asset has ownership, version, provenance, project/global scope, permissions, and memory links.

## Character Consistency

Character identity must be represented as structured references, not only prompts. Support reusable reference sets, wardrobe/look versions, voice links, continuity notes, and shot-level locks.

---

# P4 — Automation + Team Workspace

## Automation

Preferred product UX is native XEOMX. External workflow engines are adapters, not the identity of the product.

Example:

```text
Generate Content -> QA -> Approve -> Schedule -> Publish -> Analytics
Lead -> Research Agent -> CRM -> Email Agent -> Follow-up
```

## Team Workspace

```text
Workspace
 -> Projects
 -> Tasks
 -> Team
 -> AI Agents
 -> Files
 -> Comments
 -> Approvals
 -> Activity
 -> Docs
```

Agents appear as first-class team members while always remaining distinguishable from humans.

---

# P5 — Business Agents

Research:
- Web Research Agent
- Competitor Agent
- Market Research Agent

Marketing:
- Marketing Agent
- SEO Agent
- Social Media Agent
- Campaign Agent
- Copywriter Agent

Sales:
- Sales Research Agent
- Lead Generation Agent
- SDR Agent
- Follow-up Agent
- Sales Ops Agent

Support:
- Customer Support Agent
- Ticket Agent
- Knowledge Agent

Data:
- Data Analyst Agent
- Report Agent
- Visualization Agent
- KPI Agent

All use shared Orchestrator / Skills / Memory / Approval contracts.

---

# P6 — Marketplace / Creator Economy

Marketplace objects:

- Prompts
- Workflows
- Agent Skills
- Agents
- Templates
- Characters
- Voices
- Creative Assets

Creator journey:

```text
Create -> Publish -> Sell -> Earn
```

XEOMX monetization:

- subscription
- credits
- commissions

Required controls include content provenance, versioning, license metadata, payout eligibility, abuse review, refund semantics, and compatibility/version constraints.

---

# P7 — Scale, Quality, Localization, Mobile

## QA / Critic Layer

```text
Generate -> Critic -> Score -> Fix -> Deliver
```

Critics:

- Prompt QA
- Image QA
- Video QA
- Character Consistency
- Brand Consistency
- Code QA
- Security QA
- Hallucination checks
- Cost checks

Critic loops require bounded retry/cost policies. Do not allow unbounded self-correction loops.

## Cost Router

```text
Task -> Quality Requirement -> Budget -> Provider Selection
```

Modes:

- Fast
- Balanced
- Best

Cost estimate appears before generation when possible. Actual charge and variance are persisted for observability.

## Localization

Global core remains shared. Localization engine supports at minimum:

- English
- Persian
- Arabic
- Chinese
- Hindi
- RTL
- date / number / currency formatting
- high-quality Persian conversational behavior
- Jalali where appropriate
- country-specific templates

Iran is a localization/country experience, not a forked product.

## Mobile

Critical goals:

- mobile-first navigation
- creation flows that do not require desktop
- resumable long-running tasks
- compact approvals
- responsive timeline/node fallback UX
- upload/capture from device

---

# UX Product Principles

1. Unified Experience
2. AI-first Navigation
3. Create -> Generate -> Edit -> Publish -> Sell
4. Model Abstraction
5. Strong Workspace
6. Clear Generation Feedback
7. Compare & Iterate
8. Discover -> Create
9. Mobile-first UX
10. Premium Micro-interactions

North star:

> **Minimum Clicks + Minimum Complexity + Maximum Control**

High-priority convenience capabilities:

1. Memory
2. Project Brain
3. One-Click Create
4. Global Search
5. Command Center

Also required:

- Continue Anywhere
- Auto Save
- Version History
- Undo
- Favorites
- Presets
- Smart Defaults
- Compare Models
- Unified Inbox
- Smart Templates
- Personal AI Settings
- Share & Collaborate

---

# Architecture Rules That Prevent a Patchwork Product

- Do not copy entire OSS UIs into XEOMX.
- Do not create one dashboard per framework/capability.
- Do not expose framework names as product concepts unless an advanced developer surface requires it.
- Do not force model selection for every task.
- Do not create memory without user controls.
- Do not allow browser agents to bypass permission/approval.
- Do not let external engines own canonical project/memory/asset data.
- Do not couple billing semantics to a provider response shape.
- Do not make Python-only frameworks a mandatory dependency of the TypeScript/Cloudflare web request path without an explicit service boundary ADR.

# Required Evidence for Each Future Adoption

Before dependency addition or copied component:

- canonical repository/package identity
- exact license and relevant subdirectory license
- last meaningful release/maintenance activity
- supported runtimes
- browser/server/edge compatibility
- transitive dependency review
- known security advisories
- network/telemetry behavior
- data/storage ownership
- auth/permission model
- bundle/runtime impact
- exit strategy
- decision: ADOPT / ADAPT / REFERENCE / REJECT
- ADR link

# Execution Rule

P0 must close first. P1-P7 architecture may be designed in parallel, but feature dependencies and implementation work may not be merged into the release source until the canonical Stage 5.4 baseline is reproducible and its release gates can be re-run from one exact source tree.
