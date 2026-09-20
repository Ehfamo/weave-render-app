# FI2 Projects, Memory and Continuity — source/integration closure

Repository: `Ehfamo/weave-render-app`

Evidence recorded: 2026-09-20T09:54:15.646624+00:00

SOURCE BRANCH: `feature/xeomx-fi1-core-execution-20260914`

SOURCE HEAD: `dcafa525ebae0cf126e7470be3ca9de8065274aa`

PRESERVED CANDIDATE HEAD: `8c555d9f375fdd5477e0e2365fc1e366abb41546`

FI2 BRANCH: `feature/xeomx-fi2-projects-memory-continuity-20260915`

VALIDATED SOURCE HEAD: `c65f2c5978cab42d0533c16234aa276294a0e5ea`

VALIDATED SOURCE TREE: `4e6a0b76fd82e839063efe35a123316c603f0cf3`

FINAL HEAD is the evidence closure commit containing this document. Resolve its exact SHA with
`git log -1 --format=%H -- docs/FI2_PROJECTS_MEMORY_CONTINUITY_EVIDENCE.md`.
The accompanying `XEOMX_FI2_FINAL_CLOSURE_20260920.manifest.json` records the literal final HEAD,
its evidence blob, bundle HEAD and bundle SHA-256 after creation. A commit cannot embed its own
hash; the validated source SHA above is explicitly distinguished from the final evidence commit.

## Closure scope and commits

Source behavior: **SOURCE_PASS**. Deterministic service and PostgreSQL integration: **INTEGRATION_PASS**.
Rendered checks and live providers are **NOT_STARTED**; neither RENDERED_PASS nor LIVE_VERIFIED is claimed.
FI3 has not started. All checks below were actually executed for this closure.

Preserved existing work:

- `635838e081a2bbda36f86c31bc4f23a53a50ef3c` — initial FI2 candidate preservation.
- `8c555d9f375fdd5477e0e2365fc1e366abb41546` — emergency preservation of Projects, Memory, continuity and tests.
- `c65f2c5978cab42d0533c16234aa276294a0e5ea` — closure formatting fixes and the missing Projects effect dependency.
- This evidence-only closing commit — `docs(fi2): close projects memory continuity with evidence`.

The preserved candidate was revalidated before fixes: FI2 18/18, Brain 12/12, Memory 8/8,
PostgreSQL 6/6, FI1 13/13, Search/Command Center 14/14, full suite 340/340 and typecheck passed.
Lint found 591 formatting errors and one new effect dependency warning. The closure changes
fix those issues using the repository Prettier configuration and the actual `query.user` dependency.
Affected behavior was rerun (80/80), followed by the entire ordered final matrix below.
No assertion was removed or relaxed by the closure fixes.

## Projects and Project Workspace

`/projects` lists authorized persisted projects, names, goals, update times and recent real activity.
It has loading, empty, error/retry and ready states. The minimal create form calls the canonical
`xeomx_create_project` path through existing backend functions; generated UUIDs survive new sessions.
Goal-first Home can intentionally create durable work and carry the pending goal into that project.
A partial goal-save failure returns the created project with an explicit warning, avoiding duplicate creation.

`/projects/$projectId` opens through authenticated server functions and authorization before loading
metadata or context. It exposes name, durable goal, Continue input, recent conversations/executions,
saved assistant output, structured context/open items, existing file metadata and Memory controls.
Name and goal edits use canonical authorization and deliberate backend operations. Ordinary tasks
never replace the durable goal. No destructive Project delete UI was added.

`ProjectsService` composes existing project persistence, `ProjectBrainService`, `MemoryService`,
conversations and messages. It is not a second database or execution engine. Production uses
user-token Supabase adapters; deterministic in-memory storage exists only in the test helper.
Canonical identities and work are never stored in localStorage. The existing short-lived private
pending-goal handoff remains a one-time transfer, with actor/project binding and expiry.

The active Project context binds an authorized server result to the current actor. Empty, signed-out
and changed-actor states expose no active Project. Query caches are actor-scoped and unavailable
responses hide stale data. Auth session initialization cannot overwrite a newer auth event.

## Project Brain and Memory

History, Memory and Project Brain remain separate canonical concepts:

- Brain entries reside on the existing `projects.brain_entries` column, validated and updated through
  `xeomx_put_project_brain` with writer authorization and expected-state conflict checks.
- Memory records/settings retain `MemoryService` and existing `xeomx_memories` / `xeomx_memory_settings`.
- Work history uses existing conversations/messages with controlled execution metadata.

`ProjectBrainService` builds bounded structured JSON containing the supported goal, instructions,
constraints, decisions, entities, unresolved open items, optional relevant memories and recent activity.
Selected conversation messages are bounded; an omitted assistant result is not advertised as a
continuation reference. The FI2 context budget is 12,000 serialized characters. The existing
Orchestrator retains its configured bound; no unbounded history snapshot is passed to a provider.

Memory OFF and disabled memory types suppress automatic relevant-memory retrieval and Memory writes.
They preserve Brain goal/instructions, project execution and canonical history. Tests verify zero
automatic memory list contributions and no automatic writes during execution while OFF. Brain edits
continue independently. FI2 does not automatically turn prompts, outputs or transcripts into memory.

`/memory` provides the canonical supported controls: global enable/disable, supported type disabling,
scoped inspection, content/importance editing, archive and confirmed delete. It displays active/archive
state, canonical source kind and update time. Project-scoped entry is available from the workspace;
validated conversation scope is supported. Archive/delete/disabled types change subsequent retrieval,
including execution behavior; changes are not UI-only. Legacy Brain marker documents are excluded
from Memory controls and automatic retrieval.

## FI1 integration and continuity

Authenticated goal plus project ID → project authorization → bounded canonical Brain and authorized
Memory → existing P9 intent and capability plan → canonical registries/tools → existing TaskOrchestrator
→ existing Model Gateway → existing quality loop/safe trace → actual result → canonical persistence.

The Orchestrator consumes bounded Brain data; the research reasoning prompt materially changes when
an authorized instruction or memory changes. Missing providers remain NOT_CONFIGURED and missing
evaluators remain honest. FI3 capability expansion and broader approval UI are not introduced.

Project execution starts one canonical conversation with its user message. Completion stores the
actual assistant output once in `messages`, with state/result metadata on that conversation.
Persisted actor/idempotency keys and request hashes guard duplicate/concurrent/replayed requests.
A storage failure never returns false persisted success. Interrupted running records remain truthful;
background recovery beyond the existing behavior remains outside FI2.

Home Continue and Recent Projects use the same authorized persisted source. Continue carries real
project and conversation IDs, reloads prior activity and context, and feeds the existing FI1 path.
Correction/continuation uses the prior assistant message reference supported by P9; ordinary goals
remain activity. Database close/reopen tests prove identity, goal and saved results survive.
There are no hardcoded Project/Continue fixtures in production behavior.

## Authorization, isolation and primary journey

All project endpoints derive the actor from authentication middleware and use the existing project
membership/role helper. Owner/editor mutations are enforced; viewers cannot execute or edit Brain.
Denied access fails before project metadata/context reads. Private Memory stays actor-owned and exact
user/project/conversation scopes are preserved. Authorized shared Brain state follows project roles.

Core execution conversations/messages are actor-private even in a shared project. PostgreSQL tests
exercise RLS, writer checks, anonymous rejection, immutable conversation identity, denied reparenting,
denied forged execution metadata, cross-user completion denial and cross-project continuation denial.
Global Search is reused; execution-scoped search excludes another conversation's private memory.
No private text is placed in URLs or safe traces; route/search parameters carry only resource IDs.

Normal authentication defaults to Goal-first Home (`/`). The pending FI1 handoff still resumes once
after authentication. Header Projects points to `/projects`; existing Search and Command Center
project actions lead to the real route. Legacy creator `/dashboard` functionality is retained.

New FI2 strings have exact catalog-key parity across en/fa/ar/zh/hi. Source UI includes labeled forms,
semantic headings, keyboard actions, focus states, readable empty/error states and fa/ar direction.
Rendered RTL and accessibility audits are NOT_STARTED and belong to FI7.

## Database source migration

`supabase/migrations/20260915115854_fi2_project_brain_and_execution_continuity.sql`
is **MIGRATION_SOURCE_ONLY**. It extends existing projects/conversations, reuses messages, preserves
RLS and adds controlled RPCs/constraints/actor isolation. It creates no duplicate domain tables.
An unambiguous active owner legacy Brain document is transferred; conflicts fail closed. Legacy
Memory rows are retained rather than deleted. Private non-owner legacy rows are not silently promoted.
Rollback reasoning: revert application compatibility first, retain added columns/transcripts and
legacy rows; never automatically drop durable user data.

The exact migration source was applied only to an isolated local PGlite PostgreSQL test database,
with canonical prior project/message schema, RLS, grants, Memory migration and project-create RPC.
PGlite is a pinned development dependency (`0.5.8`), not a production database substitute.
Hosted Supabase migration/application verification is DEFERRED_EXTERNAL; Production migration = NO.

## Final ordered validation

Environment: Node `v24.19.0`, npm `11.9.0`. `npm ci --no-audit --no-fund` installed the lockfile
successfully (488 packages). Final checks used an isolated local worktree built from exact candidate
history plus closure fixes. Its staged Git tree exactly matched the committed validated source tree
above, including the original tracked asset. The unrelated existing `backup.jpg` working-copy change
and Supabase CLI temporary file were left untouched outside the commits.

| Order | Gate                                  | Actual result                                     |
| ----- | ------------------------------------- | ------------------------------------------------- |
| 1     | FI2 behavioral/integration            | 18/18 PASS, 0 skipped                             |
| 2     | Project Brain                         | 12/12 PASS, 0 skipped                             |
| 3     | Memory                                | 8/8 PASS, 0 skipped                               |
| 4     | PostgreSQL persistence/RLS            | 6/6 PASS, 0 skipped (5 subtests plus parent)      |
| 5     | FI1 regression                        | 13/13 PASS, 0 skipped                             |
| 6     | Search + Command Center               | 14/14 PASS, 0 skipped                             |
| 7     | Full repository suite                 | 340/340 PASS, 0 failed, 0 skipped                 |
| 8     | Typecheck                             | PASS, 0 errors                                    |
| 9     | Lint                                  | PASS, 0 errors; unchanged 9 Fast Refresh warnings |
| 10    | Production build                      | PASS, Cloudflare Worker package emitted           |
| 11    | Canonical build smoke                 | 1/1 PASS after the final build                    |
| 12    | Git diff check                        | PASS for working and staged changes               |
| 13    | Changed-file secret/credential review | PASS, 52 FI2 files reviewed, 0 findings           |

Commands used in the order above:

```sh
node --experimental-strip-types --test tests/fi2-projects-continuity.test.mjs
node --experimental-strip-types --test tests/project-brain.test.mjs
node --experimental-strip-types --test tests/memory-core.test.mjs
node --experimental-strip-types --test tests/fi2-persistence-migration.test.mjs
node --experimental-strip-types --test tests/fi1-core-execution.test.mjs
node --experimental-strip-types --test tests/global-search.test.mjs tests/command-center.test.mjs
npm test
npm run typecheck
npm run lint
npm run build
npm run test:smoke
git diff --check
git diff --cached --check
```

Secret review checked private key blocks, GitHub/provider/AWS/Slack credentials and credential
literals, plus manual review of authorization/context boundaries and explicit file staging.
No .env, tokens, credentials, node_modules, build caches, temporary archives or unrelated asset
changes are included. The gate is scoped review evidence, not a claim about undisclosed external systems.

Final execution-log SHA-256 values (logs are local execution evidence; commands reproduce the gates):

| Gate           | Log SHA-256                                                        |
| -------------- | ------------------------------------------------------------------ |
| fi2-focused    | `a1a4e9fb10ce679c4c312dbb44b066cfef620a5c7401e0849c6321ce3ef4b5ac` |
| project-brain  | `21d351b20cd6fbee5652e3b8fb1a8e953855e57439d3c05440d68ccee7e1fbbe` |
| memory         | `d938153501637b66e3fe05285627c7542a045952f7ca4cc84d9dadbb66fb93b5` |
| postgres       | `d74ebc302c0d5444d1a58f6709d9a6a2d0df3afe1ddfd00cede658769bde13f6` |
| fi1            | `986a9990a772b13ea62016c76a2a15e7ede1a78c20a8af9988217b96b29171db` |
| search-command | `a158532ee38281a25f17e8ee84c542d1b1e05a2603cbb88b8dc5fb19ac6f487a` |
| full           | `1a7f1e4cab42080c170b8e0594ade54bd61c883dc63adea8be799bb384929787` |
| typecheck      | `ae791f9f57ffbb3c0a592b6a34e25250c1f7f6f13fde4d05f77a0d4e7681f89a` |
| lint           | `b825d9d64a314c4b7000197379937377dd5fc76dd64d692f6d84170ff9f678d2` |
| build          | `541ff214712f555af96d9e71cfc2211b6d81faeeff3ab6cc7148f8dd8add3d74` |
| smoke          | `9f625d74c7b8ea7ea98ea7d65586916ef7f7b711d09f8464512feca2a6256e53` |
| diff-check     | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Earlier Project Brain tests were adapted in the preserved candidate to the authoritative independent
project storage contract, including positive Memory OFF behavior. Search route expectations and P2
bounded-context fixtures followed the canonical contract changes; no tests were deleted or skipped.
The 316 pre-existing tests plus 24 new FI2 test/subtest results account for all 340 tests.

## Exact history preservation and external limits

FI1 ancestry is verified with `git merge-base --is-ancestor` against the exact source SHA.
The candidate preservation bundle remains unchanged: SHA-256
`6091c220c8a9aa846f2dccda97e7b2d1be38c61939d16601e4a53a84fdeb00b2`.

Normal Git push was previously BLOCKED_BY_CREDENTIAL. No repeated push is attempted during this
closure because newly available credentials have not been established. Read-only remote verification
still reports FI2 HEAD `dcafa525ebae0cf126e7470be3ca9de8065274aa`.

Final delivery is `XEOMX_FI2_FINAL_CLOSURE_20260920.bundle`, an exact incremental bundle from the
required FI1 prerequisite through the final evidence commit on the required FI2 branch. Final status
requires `git bundle verify` PASS and `git bundle list-heads` matching the literal final HEAD; the
companion manifest records those actual post-commit values and SHA-256. Remote advancement is not claimed.

Deferred: hosted migration execution, rendered browser/mobile/RTL/accessibility validation, live
providers and real-user release validation are DEFERRED_EXTERNAL / NOT_STARTED as applicable.
Project deletion, broader capabilities/approvals, Marketplace/commerce, enterprise, payments,
staging and release remain in the previously defined later stages. FI3–FI7 work was not started.

Production safety: main modified = NO; merge = NO; deploy = NO; Production modified = NO;
Production Supabase modified = NO; Production migration = NO; DNS modified = NO;
payments/payouts modified = NO; force push = NO. FI3 NOT STARTED.

## Files changed from exact FI1

- `messages/ar.json`
- `messages/en.json`
- `messages/fa.json`
- `messages/hi.json`
- `messages/zh.json`
- `package-lock.json`
- `package.json`
- `src/components/xeomx/Header.tsx`
- `src/components/xeomx/ai/XeomxAiWorkspace.tsx`
- `src/components/xeomx/command-center/CommandCenter.tsx`
- `src/components/xeomx/os/HomeExperience.tsx`
- `src/components/xeomx/os/ProjectContextProvider.tsx`
- `src/components/xeomx/projects/MemoryControls.tsx`
- `src/components/xeomx/projects/ProjectWorkspace.tsx`
- `src/components/xeomx/projects/ProjectsPage.tsx`
- `src/hooks/use-auth.ts`
- `src/hooks/use-projects.ts`
- `src/lib/agents/contracts.ts`
- `src/lib/agents/orchestrator.ts`
- `src/lib/agents/runtimes.ts`
- `src/lib/auth-navigation.ts`
- `src/lib/backend/vertical-slice.server.ts`
- `src/lib/command-center/actions.ts`
- `src/lib/core-execution/contracts.ts`
- `src/lib/core-execution/functions.ts`
- `src/lib/core-execution/handoff.ts`
- `src/lib/core-execution/runtime.server.ts`
- `src/lib/core-execution/service.ts`
- `src/lib/global-search/runtime.server.ts`
- `src/lib/global-search/service.ts`
- `src/lib/global-search/sources.ts`
- `src/lib/project-brain/contracts.ts`
- `src/lib/project-brain/runtime.server.ts`
- `src/lib/project-brain/service.ts`
- `src/lib/project-context.ts`
- `src/lib/projects/functions.ts`
- `src/lib/projects/runtime.server.ts`
- `src/lib/projects/service.ts`
- `src/routeTree.gen.ts`
- `src/routes/_authenticated/memory.tsx`
- `src/routes/_authenticated/projects/$projectId.tsx`
- `src/routes/_authenticated/projects/index.tsx`
- `src/routes/auth.tsx`
- `src/routes/settings.tsx`
- `supabase/migrations/20260915115854_fi2_project_brain_and_execution_continuity.sql`
- `tests/fi1-core-execution.test.mjs`
- `tests/fi2-persistence-migration.test.mjs`
- `tests/fi2-projects-continuity.test.mjs`
- `tests/global-search.test.mjs`
- `tests/helpers/fi2-fixture.mjs`
- `tests/p2-agent-platform.test.mjs`
- `tests/project-brain.test.mjs`
- `docs/FI2_PROJECTS_MEMORY_CONTINUITY_EVIDENCE.md` (this document)
