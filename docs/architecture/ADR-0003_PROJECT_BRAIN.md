# ADR-0003: Project Brain foundation

Date: 2026-09-12. Status: accepted for source foundation.

## Ownership and domain reuse

ProjectBrainService composes the existing MemoryService and caller-bound ProjectDomain. MemoryAdapter and XEOMX Postgres remain canonical persistence. Existing projects, project_members, conversations and xeomx_project_role from the Request 7 migration are reused. No new entity, table, migration, provider or dependency is introduced. This preserves ADR-0001 and ADR-0002.

User Memory describes an individual across projects. Project Brain describes that individual's working understanding of one authorized project. It is private per user/project, not a shared editable team brain. Membership alone does not expose another member's memories. Global user memories are not silently included.

## State and continuity

One bounded ProjectMemory document per user/project stores versioned entries for goal, instructions, decisions, constraints, entities, facts, preferences and open work. Source reference and document format are `xeomx.project-brain.v1`. The document uses existing content/provenance fields, not a second storage system. Stable entry IDs support updates; one goal is retained. Open items can be resolved. Document limits are 32 entries, 1,500 characters per entry and 7,500 serialized characters overall. Capacity errors preserve existing data. Users may inspect/edit/archive/delete the backing memory with MemoryService controls.

Construction of a new service or switching conversation does not reset the project document. Conversation context comes from exact conversation-scoped memory, after confirming it belongs to the authorized project. Character, voice, brand and preference records are retrieved through existing project-scoped categories. Recent activity consists of at most ten authorized conversation titles/timestamps; raw message history is not harvested automatically.

The current MemoryAdapter has no transaction/CAS operation. Concurrent edits to the same document use last-writer-wins; concurrent initial creation producing duplicate documents fails closed with BRAIN_CONFLICT on subsequent reads. This foundation targets serial user edits. Multi-writer merging/atomic concurrency is deferred before collaborative/agent editing; this is not a claimed collaborative synchronization mechanism. Versioned document lookup uses the existing filtered MemoryService list with a 100-candidate cap.

## Context and snapshots

Snapshots contain canonical project identity, entries, categorized goal/instructions/decisions/constraints/entities/open work, relevant memories, recent activity, summary and updatedAt. Deterministic ordering uses category/ID, existing memory relevance ordering, and activity timestamp/ID; updatedAt derives from persisted sources, never the current clock. Summary is a deterministic goal/name fallback. ProjectSummaryAdapter is an optional future abstraction; no live AI request is necessary or executed.

Context is serialized structured JSON with whole sections, configurable from 128 to 32,000 UTF-16 characters (default 12,000), including serialization escapes. Identity, goal and instructions precede lower-priority material. Sections stop when the budget is reached, and truncated is explicit. Full snapshots are returned separately, not attached to bounded context. Consumers must use context.text for the bounded model input. The limit is characters, not a token estimate. Snapshot retrieval considers at most 100 project memories plus 20 explicitly selected conversation memories; it is bounded lexical retrieval rather than exhaustive semantic recall. Archived/disabled memory is excluded from automatic context. Inspection remains available while disabled, and disabled ProjectMemory also blocks brain writes.

## Authorization and server integration

createProjectBrainService verifies the JWT with Supabase Auth, binds both native memory and project domain to the same user, and uses the existing publishable-key/user-token client. It requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY plus a caller JWT. The server-only import guard prevents client import of this factory. No service-role or provider key is used.

Every public brain operation checks project authorization. Native domain reads explicitly check xeomx_project_role (owner/editor/viewer), then read project/conversation rows through RLS. Conversation IDs are checked against the requested project. Returned memory owner and exact scope are checked too. Viewers can manage their own private project memory, not modify shared project metadata. Adapter/domain ports are trusted backend components; arbitrary callers cannot substitute them through a public route. Storage errors are normalized without exposing query/token/private response details. No private content logging was added.

The [Supabase select documentation](https://supabase.com/docs/reference/javascript/select) was checked for the existing query API. The changelog markdown fetch returned unsupported content type; no newly introduced Supabase feature is relied on.

## Validation and deferred deployment

Tests exercise the real ProjectBrainService with real MemoryService and controlled storage fixtures; native domain tests cover membership and row mapping. They do not constitute live database RLS validation. Prior Memory Core migration application and executed RLS checks remain prerequisites for deployment. No database was contacted, schema applied or environment retried in this run.

Future Search, Command Center and Agents may consume snapshots/context via these contracts after authorization. None is implemented here. UI, AI summarization, vector retrieval, automatic extraction and collaborative conflict resolution remain separate work.
