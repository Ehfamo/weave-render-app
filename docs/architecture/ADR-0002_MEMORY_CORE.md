# ADR-0002: XEOMX Memory Core

Date: 2026-09-11. Status: accepted for P1.3 foundation. Preserves ADR-0001.

## Ownership and existing storage

XEOMX owns memory contracts, identity, authorization and canonical records. Features use MemoryService, which uses a caller-bound MemoryAdapter and native Supabase/Postgres storage. External extraction or indexing engines may only provide replaceable derived data.

The existing schema contains profiles, projects, project_members, conversations, messages and assets. The Request 7 migration (`20260811000000_request_7_backend_vertical_slice.sql`) supplies project membership and `xeomx_project_role`. The profile migration (`20260621060717_f63c7e99-8137-4c9b-8dcc-6f9f64d46285.sql`) remains authoritative for profiles. Product references to characters, voices, brands and preferences do not establish an existing persistent memory table. No existing vector storage was found. This change does not duplicate those domain entities or copy conversation history into memory automatically.

## Contracts and controls

Eight categories share MemoryRecord: UserMemory, ProjectMemory, ConversationMemory, CharacterMemory, VoiceMemory, BrandMemory, PreferenceMemory and InstructionMemory. Each record has a user owner, exact user/project/conversation scope, source/provenance, bounded content, importance, status and timestamps. ProjectMemory requires project scope; ConversationMemory requires conversation plus project scope. Other categories may be scoped explicitly.

MemoryService supports create, get, list, relevant retrieval, update, archive, permanent delete and settings. Memory defaults to disabled. Users opt in globally and can disable individual categories. Disabling blocks new writes and automatic retrieval, while inspection, editing and deletion remain available. Archive excludes records from automatic retrieval. Scope, category, owner and provenance are immutable; moving a memory requires a deliberate new record and deletion of the old one. No UI or automatic collection is introduced.

## Native persistence and authorization

`20260912000000_p1_memory_core.sql` adds only `xeomx_memories`, `xeomx_memory_settings`, indexes, policies, a scope helper, an immutable-identity trigger and the `xeomx_memory` RPC. It depends on existing projects/conversations and membership migrations being applied first. It is forward-only source, not applied by this run. Memory content is private to its user even inside a shared project.

The server-only factory verifies the supplied user JWT with Supabase Auth, then binds the adapter to that authenticated user. Environment variables are `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the JWT is a per-request argument, never a committed value. A service-role client must not be substituted. RPC functions are SECURITY INVOKER and retain caller RLS. Ownership, project membership and conversation/project agreement are checked in storage; INSERT additionally requires enabled settings/category. Identity and provenance cannot be changed through direct UPDATE. Anonymous execution is revoked. Deletes preserve user control. Account/project/conversation deletion cascades memory deletion.

The service validates inputs and checks returned ownership/scope. The native adapter maps unknown storage data to canonical records and hides storage/transport error details. No private memory logging, provider SDK types, external network memory calls or new dependency is introduced. Adapter implementations are trusted backend components and must enforce the same storage authorization contract; the service is not a sandbox for malicious executable adapters.

## Retrieval and replacement

Current retrieval is bounded lexical substring matching, with type/scope, updated-since and minimum-importance filters. Results are ranked by lexical match and importance, then recency and ID for deterministic ties. At most 100 recent candidates are considered before returning the requested limit (1–100). It is not exhaustive semantic retrieval; archived candidates can reduce the returned active result count. Global memory is never implicitly mixed into project/conversation retrieval.

MemoryQuery and MemoryMatch are provider-neutral. A future adapter/retrieval extension may maintain a derived vector index, but must retrieve authorized canonical records before returning results and propagate deletes/disable controls. No embeddings, vector extension or provider model is selected in this foundation. Rebuilding an optional index from XEOMX records is the exit path; the only copy of memory must never live in an external engine.

## Mem0 evaluation

Decision: **REFERENCE**, installation deferred. This is a scope decision, not a claim that Mem0 is unsafe or incompatible.

Reviewed [Mem0 source](https://github.com/mem0ai/mem0/tree/c7ee362aff94a369af70f13f2b4f853f6793ff4c) and its TypeScript package at revision `c7ee362aff94a369af70f13f2b4f853f6793ff4c` (commit dated 2026-09-11), package version 3.1.8.

| Dimension | Assessment |
| --- | --- |
| License | Apache-2.0 as declared by repository/package; no source copied. |
| Maintenance | Recent upstream activity observed at the pinned revision; not a guarantee of future support. |
| Stack/dependencies | TypeScript SDK available; package includes axios, openai, uuid and zod dependencies. None added to XEOMX. A new SDK and its transitive dependencies would expand maintenance and server runtime scope. |
| Security/privacy | Extraction and hosted memory may transfer private content to external processors. Authorization, retention, deletion propagation, prompt-injection handling and provider settings require integration-specific review. No independent security audit or vulnerability-free claim is made. |
| Self-hosting | Open-source self-hosting/server code exists; operational LLM/storage configuration still needs ownership and deployment work. |
| Canonical ownership | An optional derived retrieval/extraction adapter could fit; Mem0 identity/storage must not replace XEOMX Auth, RLS or canonical memory. |
| Integration cost | No material need for another extraction/vector engine in this scoped CRUD foundation. Defer installation and any prototype. |
| Exit strategy | Keep canonical records and IDs in Postgres, rebuild/delete derived indexes, replace adapter without changing feature contracts. |

Future ADAPT requires a separate justified decision, deletion/isolation tests and privacy review. No Mem0 dependency, API call or code copy is present.

## Validation boundary

Unit tests exercise the real service and native adapter through controlled storage/RPC fixtures. Migration tests inspect source constraints and RLS declarations. Supabase CLI/Postgres runtime are unavailable here; SQL execution and live RLS integration remain deferred before deployment. This source foundation does not claim a deployed persistence service. Follow the existing [Supabase RLS model](https://supabase.com/docs/guides/database/postgres/row-level-security) when validating against an isolated database.
