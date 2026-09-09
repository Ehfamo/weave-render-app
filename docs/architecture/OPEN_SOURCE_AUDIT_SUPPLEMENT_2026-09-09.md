# XEOMX Open Source Audit Supplement — 2026-09-09

Status: **GOVERNANCE EVIDENCE / NO INSTALL APPROVAL**

This supplement extends `OPEN_SOURCE_ADOPTION_REGISTRY_2026-09-09.md`. It resolves several previously ambiguous candidates and records explicit license/maturity boundaries.

## Mandatory rule

No candidate in this file may be installed, copied, vendored, or merged merely because it is listed as `ADAPT`. Every actual code adoption still requires:

- exact canonical repository/package identity
- exact current license, including subdirectory/component exceptions
- dependency and supply-chain review
- runtime/deployment compatibility proof
- security review
- maintenance/release-health review
- ADR and rollback/exit strategy

Decisions: `ADOPT / ADAPT / REFERENCE / REJECT`.

---

## Browser / Computer Agents

### Cereon Browser Operator

Initial decision: **ADAPT — isolated technology spike only**

Observed characteristics:

- MIT-licensed project
- designed to control a real logged-in Chromium/browser through a self-hosted/operator bridge
- model/framework agnostic
- useful for embedded/white-label user-browser execution rather than forcing a hosted browser product

XEOMX boundary:

```text
XEOMX BrowserTool
 -> Permission Policy
 -> Domain/Tab Scope
 -> User Approval
 -> Cereon Adapter
 -> User Browser
 -> Audit Log
```

Do not expose the operator directly to agents. The XEOMX policy layer must own domain allowlists, tab scope, destructive-action approval, stop control, secret boundaries and audit events.

### ClawBridge

Initial decision: **REFERENCE / isolated spike**

Observed characteristics:

- Apache-2.0 project
- combines browser and desktop/computer-use capabilities
- local-first orientation
- much broader impact surface than browser-only automation

Reason not to adopt as core: desktop control materially expands permission, secret, filesystem and destructive-action risk. Evaluate only in a sandboxed desktop/runtime research environment.

### Browser Use

Decision remains: **ADAPT** behind XEOMX `BrowserTool` / `ComputerTool` contracts.

It is a stronger default framework candidate for controlled browser-agent execution than exposing multiple browser frameworks to the product.

### `web-agent`

Decision: **PENDING EXACT IDENTITY / REFERENCE only**

The name is ambiguous across research and product repositories. Do not add a dependency until the exact intended repository is named and audited.

---

## Memory Candidates Resolved Further

### LightMem

Initial decision: **REFERENCE / algorithm spike**

- permissive MIT project/research implementation
- lightweight memory optimization/retrieval ideas are relevant
- Python/research orientation makes it unsuitable as the canonical web-platform storage contract

Use for measured memory algorithm comparisons only.

### Memoria Chat

Initial decision: **REFERENCE**

- MIT
- useful structured concepts around identity, preferences, events and persona versions
- lightweight file/JSON-oriented implementation is not suitable as XEOMX canonical multi-tenant memory infrastructure

Extract product/schema ideas; do not adopt storage architecture.

### OpenPersistentMemory

Initial decision: **REFERENCE**

- permissive project
- very small/maturing implementation
- useful only as a pattern/reference until maintenance and production behavior justify more

### OneBrain

Decision: **PENDING EXACT IDENTITY**

Multiple materially different repositories/products use the OneBrain name, including different license models. Never infer license or integration strategy from the name alone.

### OpenMemory

Decision: **PENDING EXACT IDENTITY**

Multiple unrelated implementations exist (Postgres/OpenSearch/Redis/Rust, TypeScript/SQLite, Postgres-native cognitive memory, and others). Exact repository identity is required before scoring.

### Mnemosyne

Decision: **PENDING EXACT IDENTITY**

The name maps to several unrelated memory/agent projects. No adoption action is allowed from the generic name.

### total-agent-memory

Decision: **PENDING EXACT IDENTITY**

No verified canonical repository was resolved in the current audit. Keep out of dependency plans.

### Memory shortlist after this audit

1. **Native XEOMX Postgres/vector baseline** — canonical ownership.
2. **Mem0 — ADAPT** for extraction/consolidation/memory algorithms.
3. **Cognee — ADAPT/compare** for structured/graph augmentation.
4. **Graphiti — dedicated follow-up audit** for temporal KG use.
5. LightMem/Memoria — research/reference only.

---

## AI Video / Creative Production

### ViMax

Initial decision: **ADAPT / REFERENCE — strong pipeline candidate**

- MIT
- active agentic video-production project
- relevant Idea-to-Video / Script-to-Video / longer-form production patterns
- useful character-consistency and multi-stage agent pipeline concepts

Integration boundary: do not put a Python media-agent system in the web request path. If a capability proves valuable, expose it through a durable media-worker/service adapter behind XEOMX creative contracts.

### BlueFish

Initial decision: **ADAPT / REFERENCE**

- Apache-2.0
- useful provider-adapter, storyboard/reference consistency, timeline, TTS and cost-estimation patterns

High-value areas to compare with XEOMX:

- provider adapter contract
- character/reference state
- storyboard-to-generation workflow
- cost preview
- mock/test provider mode

### CineGen

Initial decision: **REFERENCE**

- MIT
- useful timeline + node-workflow + LLM assistant concepts
- project maturity/scale is not sufficient to justify a strategic dependency without a stronger spike result

### HitPop

Initial decision: **REFERENCE**

- MIT
- multi-agent/skills pipeline and explicit safety/approval concepts are useful
- current maturity is too low for a release-critical dependency

### content-agent

Initial decision: **REFERENCE**

- permissive project
- storyboard/keyframe/coherence patterns are useful
- current maturity/activity does not justify adopting it as XEOMX core

### OpenMontage

Decision: **REFERENCE ONLY — license boundary**

- canonical project is AGPLv3
- do not copy or merge its code into proprietary XEOMX without an explicit legal architecture decision
- patterns around pipelines/tools/skills can be studied independently
- repository identity must be verified carefully because similarly named/typosquat clones have existed

### AI Video Production Editor

Decision: **REFERENCE ONLY — license boundary**

- GPL-3.0-or-later
- timeline/node/consistency/auto-routing ideas can be studied
- no direct code copy into the proprietary XEOMX product path

### Vision Flow

Decision: **REFERENCE ONLY — noncommercial license**

- noncommercial/source-available license boundary makes it unsuitable for direct proprietary commercial adoption
- React/TypeScript/node-canvas UX can still inform pattern research

### SPITE

Decision: **REFERENCE / PENDING EXACT LICENSE REVIEW**

- useful filmmaking canvas and Flow-vs-Node UX concepts
- no code adoption until exact current license/component audit is complete

### VideoAgent

Decision: **PENDING INTENDED PROJECT**

One known project with that name is research code for self-improving video policies rather than an end-user production studio. Do not assume it matches the requested concept.

### open-ai-video-agent

Decision: **PENDING EXACT IDENTITY**

Canonical project not yet resolved with enough confidence for a license/security decision.

---

## Skills Collections

### `agent-skills-collection`

Decision: **REFERENCE — never bulk install**

The name is ambiguous, but one large collection demonstrates especially useful registry patterns:

- skill provenance
- checksums
- quarantine
- static-analysis/security signals
- catalog metadata
- explicit warning that mirrored skills are not automatically trusted

These are valuable design patterns for XEOMX Marketplace/Skill Registry.

XEOMX requirement:

```text
Skill Submission
 -> Identity/Source
 -> License
 -> Static Scan
 -> Permission Manifest
 -> Dependency Scan
 -> Quarantine
 -> Human/Automated Review
 -> Signed Version
 -> Publish
```

Marketplace skills never become trusted simply because they are listed.

---

## Automation License Boundary Reminder

### n8n

Decision remains: **ADAPT AS EXTERNAL INTEGRATION**

n8n uses a fair-code/source-available licensing model rather than a normal permissive OSS license for arbitrary embedding/forking. The XEOMX plan therefore treats n8n as an optional external workflow adapter, not as code to absorb into the proprietary platform.

### Activepieces

Decision remains: **ADAPT candidate**

The permissive community edition is a useful alternative for technical comparison and reduces license risk relative to embedding a fair-code engine.

---

## Maintenance Rejections

### Continue

Decision: **REJECT as a new dependency**

The previously relevant repository is no longer an actively maintained strategic base. Historical chat/coding UX patterns may be referenced, but XEOMX should not build a new release-critical subsystem on it.

### SWE-agent

Decision: **REJECT as the new primary coding-agent base**

The project itself points new development toward mini-SWE-agent. If this family remains desirable, audit mini-SWE-agent directly instead of adopting the superseded path.

---

## Shortlist After Current Audit

These are **spike candidates after P0**, not install approvals:

### Agent orchestration
- OpenAI Agents SDK JS — adapter spike
- Mastra permissive-core paths — adapter spike
- LangGraph — durable graph/checkpoint semantics where needed

### Memory
- native Supabase/Postgres/vector foundation
- Mem0 adapter
- Cognee comparison

### Browser
- Browser Use adapter
- Cereon spike for logged-in user-browser scenarios

### Coding
- OpenHands
- Cline
- Aider
- mini-SWE-agent follow-up audit

### Automation
- n8n external connector
- Activepieces alternative

### Creative/video
- OpenCut architecture/components after scoped review
- ViMax pipeline/consistency service spike
- BlueFish provider/storyboard/cost patterns
- Rendiv/OpenScene/Noder/Franklin patterns after exact licenses are pinned

---

## Explicitly Not Approved for Direct Proprietary Merge

- OpenMontage — AGPLv3
- NodeTool — AGPLv3
- Plane — AGPLv3
- AppFlowy — AGPLv3
- AI Video Production Editor — GPL-3.0-or-later
- Vision Flow — noncommercial license
- Dify — custom open-source license/additional conditions
- Outline — BSL boundary
- n8n — fair-code/source-available boundary

These may still be useful references or external integrations where legally/technically appropriate.

## Next gate

No candidate advances from governance research to dependency installation until Issue #3 (canonical source recovery/reconstruction) is closed and the fresh Stage 5.4 baseline is reproducible.
