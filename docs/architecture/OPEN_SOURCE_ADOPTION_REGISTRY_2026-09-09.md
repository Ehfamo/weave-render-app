# XEOMX Open Source Adoption Registry — 2026-09-09

Status: **INITIAL AUDIT / DECISIONS ARE GOVERNANCE INPUT, NOT INSTALL APPROVAL**

## Decision Vocabulary

- **ADOPT** — dependency/service may be adopted after a scoped technical/security spike and ADR.
- **ADAPT** — adopt the architecture/protocol selectively or integrate behind an XEOMX-owned abstraction; do not let it own product UX/data contracts.
- **REFERENCE** — study patterns/UX/architecture only; do not copy code into proprietary XEOMX without a separate license/component review.
- **REJECT** — do not use as a new primary dependency for the stated XEOMX purpose.

Every `ADOPT`/`ADAPT` still requires a component-level license, security and dependency review before code enters the release source.

## Current Product Constraint

No candidate below may be installed on the current release branch until the Stage 5.4 canonical source integrity blocker is closed and the exact source can reproduce its verification baseline.

---

## A. Agent Orchestration

| Candidate | Current audit | Stack fit | Initial decision | XEOMX use |
|---|---|---:|---|---|
| LangGraph | Official project; permissive MIT; active; durable/stateful orchestration and HITL | Medium: Python core; JS/TS ecosystem exists | **ADAPT** | Graph/state/checkpoint semantics; isolated durable orchestration where needed |
| OpenAI Agents SDK (JS/TS) | Official SDK; MIT; agents/tools/handoffs/guardrails/sessions/tracing; Cloudflare support requires compatibility validation | High | **ADAPT** | TS agent contracts, handoffs, tracing patterns behind provider-neutral XEOMX interfaces |
| CrewAI | Official project; MIT; Python; Crews/Flows | Medium/Low for core edge runtime | **REFERENCE** | Team-agent UX and flow concepts; avoid core runtime coupling |
| Mastra | TS-first; core Apache-2.0 with separate enterprise-licensed areas | High | **ADAPT** | TS-first orchestration spike; only permissively licensed paths |
| Dify | Source available under Dify Open Source License with additional conditions | Low for embedded proprietary core | **REFERENCE** | Visual workflow/agent builder UX and model management patterns |
| LlamaIndex | Official MIT project; mature RAG/agentic data framework | Medium | **ADAPT** | RAG/knowledge patterns or isolated service; XEOMX owns data model |
| Pydantic AI | MIT; strongly typed Python agent framework | Medium/Low for web core | **REFERENCE** | Typed tool/response design; optional Python service evaluation |
| Google ADK | Apache-2.0; Python; model/deployment agnostic, Google-optimized | Medium | **REFERENCE** | Google ecosystem compatibility patterns; not primary core |
| Microsoft Agent Framework | MIT; Python/.NET; graph/durability/governance/HITL | Medium | **REFERENCE** | Enterprise governance/observability patterns |
| AutoGen | Not selected as the new XEOMX primary architecture | — | **REJECT** as primary | Legacy/reference only where migration context requires it |

### Orchestration direction

Use an **XEOMX-owned orchestrator contract**. Frameworks are implementation adapters, not public product concepts. Prefer TS/edge-compatible options for the request path; place Python frameworks behind explicit service boundaries when their capabilities justify the operational cost.

---

## B. Coding Agents

| Candidate | Current audit | Initial decision | Reason |
|---|---|---|---|
| OpenHands | MIT; active; strong sandboxed software-agent/control-center patterns | **ADAPT** | Best reference/integration candidate for autonomous software work; sandbox contract is essential |
| Aider | Apache-2.0; active CLI coding workflow | **ADAPT** | Useful patch/edit loop and git-centric interaction patterns |
| SWE-agent | MIT, but official project now directs new development toward mini-SWE-agent | **REJECT** as new primary | Do not anchor new XEOMX architecture on superseded primary path |
| mini-SWE-agent | Follow-up candidate; exact audit still required | **PENDING** | Evaluate instead of SWE-agent before adoption |
| Cline | Apache-2.0; active IDE/CLI/SDK ecosystem | **ADAPT** | Tool approval, coding UX, context/tool patterns |
| Continue | Apache-2.0 repo but officially no longer actively maintained/read-only | **REJECT** as dependency | Reference historical UX only; maintenance risk too high |

Target XEOMX pipeline remains:

```text
Requirement -> Plan -> Code -> Test -> Debug -> Review -> PR
```

No coding agent receives unrestricted host access. All execution uses scoped repositories/worktrees, sandboxed commands, explicit secrets policy and auditable actions.

---

## C. Browser / Computer Agents

| Candidate | Current audit | Initial decision | Notes |
|---|---|---|---|
| Browser Use | MIT; active browser-agent project | **ADAPT** | Strong candidate behind XEOMX Browser Tool contract and sandbox/approval layer |
| Cereon Browser Operator | Exact canonical repository/license not yet resolved in this audit | **PENDING** | No installation until identity/license verified |
| ClawBridge | Exact canonical repository/license not yet resolved | **PENDING** | No installation until identity/license verified |
| web-agent | Ambiguous project name; exact repository required | **PENDING** | Must resolve identity first |

Required XEOMX policy: `Sandbox + Approval + Permissions + Logs + Stop Control`.

---

## D. Memory / Knowledge

| Candidate | Current audit | Initial decision | XEOMX direction |
|---|---|---|---|
| Mem0 | Apache-2.0; active; dedicated memory layer | **ADAPT** | Primary semantics/algorithm candidate; canonical storage and user controls remain XEOMX-owned |
| Letta / MemGPT | Apache-2.0 legacy server; active direction has moved to newer Letta agent/app-server path | **REFERENCE** | Study long-lived agent memory; avoid making legacy server the base |
| Zep | Current OSS repo is mainly examples/integrations for Zep Cloud; Graphiti is pointed to for OSS temporal KG | **REFERENCE** | Do not assume Zep Cloud product is the OSS memory backend |
| Graphiti | Follow-up audit required | **PENDING** | Evaluate temporal knowledge graph layer separately |
| Cognee | Apache-2.0; active memory/knowledge graph project | **ADAPT** | Compare with Mem0 for structured/graph memory and ingestion |
| LightMem | Exact repo/license audit pending | **PENDING** | — |
| Memoria Chat | Exact repo/license audit pending | **PENDING** | — |
| OpenMemory | Ambiguous name / exact canonical repo required | **PENDING** | — |
| OneBrain | Exact repo/license audit pending | **PENDING** | — |
| OpenPersistentMemory | Exact repo/license audit pending | **PENDING** | — |
| Mnemosyne | Ambiguous project name; exact repo required | **PENDING** | — |
| total-agent-memory | Exact repo/license audit pending | **PENDING** | — |

### Memory architecture decision

**ADAPT Mem0 concepts + Supabase/Postgres + vector search** is the current preferred direction, not “hand all memory to Mem0.” XEOMX owns:

- memory schema
- scope/permissions
- provenance
- delete/edit/disable controls
- retention
- conflict resolution
- audit trail
- project/asset links

---

## E. Automation

| Candidate | Current audit | Initial decision | Notes |
|---|---|---|---|
| n8n | Fair-code / Sustainable Use License plus enterprise licensing; not a normal permissive OSS dependency | **ADAPT via external integration** | Do not embed/fork into proprietary XEOMX without legal approval; connect as optional workflow engine |
| Activepieces | Community Edition MIT; commercial enterprise areas separate | **ADAPT** | Strong permissive alternative/integration candidate |
| Windmill | Mixed AGPL/Apache/proprietary boundaries; embedding/re-exposure requires care | **REFERENCE** | External integration only if later justified and legally reviewed |
| Kestra | Apache-2.0; active orchestration platform | **ADAPT/REFERENCE** | Evaluate server-side event/workflow use; avoid duplicating XEOMX orchestration |
| Node-RED | Apache-2.0; mature visual flow project | **REFERENCE** | Flow-editor UX and node concepts rather than core engine |

XEOMX keeps workflow definitions in an internal portable contract so an automation provider can be changed.

---

## F. Team / Knowledge Workspace

| Candidate | Current audit | Initial decision | Notes |
|---|---|---|---|
| Plane | AGPL-3.0 | **REFERENCE** | UX/domain patterns only unless isolated/legal strategy approved |
| Mattermost | Component/license boundary still requires exact audit | **REFERENCE / PENDING legal detail** | Messaging/team patterns only for now |
| AppFlowy | AGPLv3 | **REFERENCE** | Do not copy code into proprietary XEOMX |
| Outline | BSL 1.1 | **REFERENCE** | Docs/knowledge UX patterns |
| AFFiNE | Repository exposes MIT-related licensing but exact component mapping must be checked before reuse | **REFERENCE** | Study local-first/collaboration patterns |

Direction: build a **native XEOMX Team Workspace** on the existing Supabase ownership/auth model instead of merging an external team suite.

---

## G. Creative Workspace / Media Editing

| Candidate | Current audit | Initial decision | Notes |
|---|---|---|---|
| OpenCut (`OpenCut-app/OpenCut`) | MIT; active rewrite; editor/plugin/headless directions | **ADAPT/REFERENCE** | High-value editor architecture and UX candidate; component-level review before reuse |
| `floomhq/OpenCut` | Name/fork identity must not be conflated with current official OpenCut | **PENDING** | Resolve exact repo before evaluation |
| Noder | Local-first Tauri/React/React Flow/Rust node-media workspace; license not yet verified here | **REFERENCE / PENDING license** | Node UX and local BYOK patterns |
| OpenScene | Electron/React Native local-first video editor/AI agent patterns; exact license pending | **REFERENCE / PENDING license** | Typed bridge, local media, secure storage patterns |
| Rendiv | React/TypeScript code-first deterministic video-editor architecture; exact license pending | **REFERENCE / PENDING license** | Strong deterministic render/automation concept |
| Franklin Canvas | Node-based multimodal canvas; exact license pending | **REFERENCE / PENDING license** | Model compare + canvas/agent UX patterns |
| NodeTool | AGPL-3.0; feature-rich agent-first creative workspace | **REFERENCE** | Node canvas/timeline/agent tool patterns only; do not copy proprietary code path |
| OpenCanvas | MIT; small project | **REFERENCE** | Lightweight node/canvas concepts, not a strategic dependency |
| Node Banana | MIT; local/BYOK node workflows | **REFERENCE** | Reusable node/preset UX ideas; limited strategic dependency value |
| Zamili Studio | Remotion/React-oriented creative studio; relatively small project | **REFERENCE** | Pattern inspiration only |
| Vision Flow | Exact canonical project/license unresolved | **PENDING** | — |
| SPITE | Exact canonical project/license unresolved | **PENDING** | — |

Direction: create one native workspace with Simple Mode and Pro/Node Mode. Do not import multiple editors.

---

## H. AI Video Production Agents

The following names require exact canonical repository identity + license verification before any adoption decision beyond reference status:

- HitPop
- VideoAgent
- ViMax
- content-agent
- open-ai-video-agent
- OpenMontage
- BlueFish
- CineGen
- AI Video Production Editor

Initial decision for all: **REFERENCE / PENDING EXACT AUDIT**.

No GPL/AGPL code may be copied into XEOMX’s proprietary creative workspace without an explicit legal architecture decision.

---

## I. Autonomous Worker / Skills / Business Agent References

| Candidate / class | Initial decision | Direction |
|---|---|---|
| Suna | **REFERENCE / pending exact license recheck** | Goal-to-execution UX, tool selection, progress visibility |
| digitalcrew | **REFERENCE / pending exact identity/license** | Multi-role autonomous worker patterns |
| agent-skills-collection | **REFERENCE / pending exact repo audit** | Skill taxonomy and packaging ideas |
| sales-research-agent | **REFERENCE / pending exact repo audit** | Business agent workflow patterns |
| Enverif | **REFERENCE / pending exact repo audit** | Sales/research pattern only until verified |
| LangGraph customer-support-agent examples | **REFERENCE** | Support workflow/state patterns |

XEOMX business agents must be built on shared internal Agent/Skill/Tool contracts rather than importing separate vertical agent apps.

---

## J. UX/UI Pattern Sources

Candidates:

- shadcn/ai-chatbot
- shadcn-ui/chatbot-template
- Omm2005/chat-bot
- react-cmdk
- timeline-editor
- next-shadcn-dashboard
- shadcn-dashboard

Initial decision: **REFERENCE**, with component-level ADAPT allowed only after exact license/repository review.

Patterns to extract:

- Command Palette
- AI Chat
- Tool Status
- Streaming
- Sources
- Artifacts
- Side Panel
- Dashboard
- Timeline
- Responsive Navigation

Do not import an entire template as a second design system.

---

# Current Shortlist for Technical Spikes AFTER P0

## Spike 1 — TS Agent Runtime

Compare:

1. XEOMX internal minimal orchestrator contracts
2. OpenAI Agents SDK JS adapter
3. Mastra adapter
4. LangGraph JS/durable service option where durable graph semantics exceed the internal layer

Success criteria: Cloudflare compatibility, streaming, cancellation, tracing, approval, tool permissions, checkpoints, vendor neutrality and low bundle/runtime risk.

## Spike 2 — Memory

Compare:

1. XEOMX native Postgres/pgvector baseline
2. Mem0-inspired extraction/consolidation adapter
3. Cognee/graph augmentation where graph retrieval materially improves measured tasks

Success criteria: user control, retrieval quality, latency, deletion guarantees, provenance, per-scope isolation and predictable cost.

## Spike 3 — Browser Agent

Browser Use behind an internal `ComputerTool`/`BrowserTool` contract.

Must prove sandbox isolation, domain permissions, approval boundaries, stop control, logs, secret handling and replay evidence before release.

## Spike 4 — Automation

Use an internal Workflow Definition contract. Evaluate n8n as an optional external connector and Activepieces as a permissive alternative. Do not make either system the canonical XEOMX project database.

## Spike 5 — Creative Editing

Study OpenCut + Rendiv + NodeTool + OpenScene + Node Banana patterns, then implement a single native XEOMX composition model. Prefer permissive reusable components only when they reduce cost without fragmenting UX.

---

# Rejection / Escalation Triggers

A candidate becomes `REJECT` if any of these cannot be mitigated:

- incompatible license for intended distribution/use
- abandoned/unmaintained for a release-critical dependency
- unsafe default execution/secret model
- mandatory provider lock-in that violates Model Gateway goals
- canonical data ownership outside XEOMX without a portable export path
- excessive transitive dependency or runtime risk
- inability to run in the required deployment boundary
- duplicate functionality with no measurable advantage
- UX fragmentation

# Next Review

After P0 canonical-source recovery, update every P1/P2 candidate from `INITIAL` to a versioned ADR-backed decision before adding dependencies.
