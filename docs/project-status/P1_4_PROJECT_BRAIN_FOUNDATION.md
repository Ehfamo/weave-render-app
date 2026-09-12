# P1.4 Project Brain foundation evidence

Date: 2026-09-12 UTC.
Repository: Ehfamo/weave-render-app.
Branch: feature/xeomx-p1-project-brain-20260912.
Exact starting HEAD: 40c1144b289a2c2a4524886c3169d964e597913e.
Validated source HEAD: 709d0660379f570aa766ccbff0164d5480f5563a.
Evidence commit: subsequent commit containing this document, avoiding self-referential hashing.

P1_PROJECT_BRAIN = PASS (source foundation, serial user edits).
P1_GLOBAL_SEARCH_STARTED = NO.
P1_COMMAND_CENTER_STARTED = NO.
P2_AGENTS_STARTED = NO.

## Implementation

Added `src/lib/project-brain/contracts.ts`, `service.ts`, `native-domain.ts` and `runtime.server.ts`; added `tests/project-brain.test.mjs` and `docs/architecture/ADR-0003_PROJECT_BRAIN.md`.

Canonical contracts cover project identity, goal, instruction, decision, constraint, entity, open item, state, summary, snapshot and bounded context. The service supports explicit entry IDs and updates, goal replacement, decisions, constraints, entities, resolved/open work, facts/preferences, relevant project memory and continuity across conversation changes. Character/voice/brand memory categories are reused. A new service reconstructs state from the same underlying MemoryService.

The native domain checks current membership through xeomx_project_role, reads existing project metadata and authorized conversations with the caller's JWT/RLS, and validates project/conversation correspondence. The server factory verifies the user and binds memory and domain to the same actor. No public route/UI is added. Existing domain and Memory Core files were not redesigned or modified. No migration or dependency change is required.

Snapshots include categorized project state, relevant project and explicitly requested conversation memories, recent conversation metadata, a deterministic summary and persisted-source updatedAt. Context is valid JSON, capped by configurable serialized character budget with whole-section truncation. It does not carry an unbounded snapshot. No live AI or GROQ_API_KEY is used. The future summary adapter is optional and provider neutral.

## Validation

Node 24.19.0; npm 11.9.0. Fresh checks on the source HEAD above:

| Gate | Result |
| --- | --- |
| Previous full suite | 158/158 PASS (parent evidence) |
| Full unit/contract suite | 170/170 PASS, zero skips/cancellations |
| Project Brain tests | 12/12 PASS |
| Memory regression tests | 10/10 PASS |
| Brain + Memory + Request 7 integration subset | 34/34 PASS |
| Typecheck | PASS |
| Lint | 0 errors; 9 pre-existing warnings |
| Build | PASS; localhost Supabase URL/dummy publishable value |

Commands: `node --experimental-strip-types --test --test-reporter=tap tests/*.test.mjs`; focused subset uses `tests/project-brain.test.mjs tests/memory*.test.mjs tests/request-7-vertical-slice.test.mjs`; local `tsc --noEmit`, `eslint .`, and `npm run build`. Final full suite ran after the final build completed. Logs are under `p1-project-brain-validation/` (build asset list omitted).

Tests cover actual MemoryService integration, user/project separation, membership revocation, native domain authorization, goal persistence, all entry kinds, conversation continuity/isolation, deterministic snapshots, metadata updatedAt, context size and valid JSON, disabled memory, capacity errors, corrupt/duplicate documents and provider independence. An initial capacity fixture did not exceed the documented cap; its data size was corrected to exercise a genuine overflow. No production assertion or unrelated test was weakened/skipped.

## Commits

- 00f85d4178c910f5482a700ab68253be00b9cc57 — contracts and memory-backed service.
- 8892de219c61f9c98abd387d5fd6d6c040f948df — native authorization/runtime and continuity tests.
- 7cab01ef594b9d6e487537d8b4c48f7ef2efb856 — bounded valid context without attached full snapshot.
- 709d0660379f570aa766ccbff0164d5480f5563a — ADR and persisted metadata timestamp coverage.

## Deferred items and safety

Native database execution/RLS validation remain deferred from Memory Core; this run uses controlled storage fixtures and source integration tests, not a deployed database. No migrations were applied or remote environments retried. Multi-writer atomic updates/CAS and conflict merging are not supplied by the existing MemoryAdapter: serial edits are supported, simultaneous edits are last-writer-wins, duplicate initial documents fail closed. The ADR describes document/candidate/context limits. Vector retrieval, AI summaries, UI and automatic history extraction remain future work.

All changes are additive Project Brain source/tests/docs on the new branch. Main, canonical P0 source, Model Gateway, Memory Core, package/lockfile, Production, Supabase, Cloudflare, DNS, secrets and payments remain unchanged. No deployments, live model calls or private data logging occurred.
