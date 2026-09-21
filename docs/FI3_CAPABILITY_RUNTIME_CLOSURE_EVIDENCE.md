# FI3 Capability Runtime — source and integration evidence

Repository: `Ehfamo/weave-render-app`.
Validation date: 2026-09-21. Scope: FI3 only; FI4 NOT_STARTED.

## Exact source and interrupted-work preservation

- Source branch: `feature/xeomx-fi2-projects-memory-continuity-20260915`.
- Source HEAD: `9b6f077baf2a4bf72edaf22ed71da4492d33c18e`.
- Required FI1 ancestor: `dcafa525ebae0cf126e7470be3ca9de8065274aa`.
- FI3 branch: `feature/xeomx-fi3-capability-runtime-20260915`.
- Initial FI3 HEAD was the exact FI2 source; 42 interrupted source/test/migration/locale files were present and recovered.
- Checkpoint: `f752b36ecea11ce99972427948916f9e9d52b44c` — `wip(fi3): preserve interrupted capability runtime work`.
- Closure fixes: `55d2102e103d10ea0594938db21d0b669f8bb65a` — `fix(fi3): enforce collaboration ACL and durable automation state`.
- This evidence and its manifest are recorded by a subsequent documentation commit, without amending either implementation commit.
- Final HEAD is the commit introducing this evidence/manifest: resolve with `git log -1 --format=%H -- docs/FI3_CAPABILITY_RUNTIME_CLOSURE_EVIDENCE.md` at the closure ref. Its literal SHA and exact bundle hash are recorded in the companion manifest on `preservation/xeomx-fi3-final-20260921`. A Git commit cannot embed its own literal SHA without changing that SHA.

The original working copy's unrelated image modification and temporary Supabase files were left untouched. FI3 uses its existing isolated worktree; no reset, clean, rebase, squash or FI2 reconstruction occurred.

The first normal shell push returned BLOCKED_BY_CREDENTIAL. No shell authentication retry was made. The GitHub connector preserved the exact incremental bundle and a narrowly scoped recovery workflow on `preservation/xeomx-fi3-interrupted-20260921` (preservation commit `db1fa819624869d12506d2e4f66fbc15733fe388`). GitHub Actions run [35574973241](https://github.com/Ehfamo/weave-render-app/actions/runs/35574973241) succeeded. The FI3 branch was then independently read through the connector and its HEAD equalled the exact checkpoint SHA **before** further implementation.

## Canonical execution and persistence

SOURCE_PASS / INTEGRATION_PASS. Creative and Business surfaces submit authenticated, project-scoped requests through `capabilitySubmitFn`. `RuntimeJobService` manages durable lifecycle around the existing `TaskOrchestrator`; it is not another execution engine. The existing AgentRegistry, skills/tools, BusinessAgentService, CreativeWorkspaceService, Model Gateway, ProjectBrainService, MemoryService and AutomationService remain authoritative.

The runtime loads authorized Project Brain bounded context, including permitted relevant memory, constructs the P9 intent and capability plan, and invokes registered agents/tools through TaskOrchestrator. Context and completed-step state are private durable checkpoints. Results are passed through the existing P9 quality function. With no configured evaluators the findings remain NOT_EVALUATED and confidence NOT_INDEPENDENTLY_VERIFIED; no evaluation, measured cost or live success is invented.

The new service-only `xeomx_runtime_command` transaction extends existing `controlled_runs`, `approval_requests`, `assets`, `conversations`, `messages` and `project_collaboration_activity`. No duplicate job history, artifacts, memory, Brain or model gateway tables/services were introduced.

### Creative and Business

- Image/video/audio/voice dispatch through a registered `creative.generate` tool and Model Gateway. A missing provider produces NOT_CONFIGURED/UNAVAILABLE and no successful artifact.
- `CreativeHttpAdapter` is a real, server-configured HTTPS transport. `XEOMX_CREATIVE_ENDPOINT` and `XEOMX_CREATIVE_KEY` are configuration names only; no credentials were supplied. The endpoint must accept a serialized ModelRequest plus `model` and return the canonical AdapterResult. Requests carry a stable Idempotency-Key, disallow redirects, and use the gateway cancellation signal. Media output kind, HTTPS URL and MIME metadata are validated by the Gateway. There is no claim of a configured/live creative vendor in this environment.
- All five Business areas (Research, Marketing, Sales, Support, Data) have behavioral coverage reaching canonical execution and the model boundary. Existing business packs/skills are reused; results and failures are persisted through the same job completion path.
- Produced outputs become existing `assets` with stable ID, owner, project, source run, kind/status/timestamps, actual text or media reference, provenance and available provider/model metadata. Media is referenced at the provider-returned location; FI3 does not invent URLs or claim that it copied files into managed storage.

### Automation, permissions, approvals and jobs

- The canonical AutomationService persists definitions and versions. PostgreSQL generates workflow IDs under existing column grants. The latest definition status is authoritative even if a version's serialized status differs. Draft/enabled/paused state comes from definitions; failure/Needs Approval is derived from persisted invocations of that exact workflow.
- Manual invocation reaches the canonical durable dispatcher. SQL claim checks the current persisted workflow status; pause blocks queued work, enable restores eligibility. It does not pretend to start an external scheduler. Already-dispatched actions require cancellation; pausing does not retroactively undo them.
- Team UI exposes existing persisted owner/editor/viewer roles. The broader in-code permission contract is retained; no new role model is added. The existing CollaborationService calls `xeomx_change_project_member_role`, which independently verifies the authenticated active-project owner and only changes existing non-owner members to editor/viewer. Direct client membership mutation remains revoked. Self-demotion, ownership replacement and unauthorized escalation are rejected.
- Legacy P4 read/comment policies contained an ambiguous inner `project_id` reference. FI3 replaces those policies with explicit per-row project authorization. Owning a different project no longer grants access to these collaboration resources.
- Approval request persists WAITING_APPROVAL. An exact owner decision queues the same job for resume or terminally cancels it on rejection. UI Run resumes the approved queued job; hosted automatic worker dispatch is deferred. SQL binds approval consumption to user/project/job/step/tool and permits consumption once. Repeated decisions and claims do not repeat a consequential action.
- Resume reloads private context, the saved plan, prior outputs and completed steps; it does not rerun completed work. A crash with an uncertain consequential action fails closed as ACTION_OUTCOME_UNKNOWN and cannot be automatically retried. Recovery of an expired running lease is server-controlled; ordinary retries are bounded to three attempts.
- Canonical job states are queued, running, waiting_approval, completed, failed and cancelled. They survive component/navigation lifecycle in PostgreSQL. UI reads persisted status and exposes cancellation and interrupted-job recovery. Cancellation prevents future steps and suppresses delivery; it cannot reverse an external provider action already dispatched.
- The application currently invokes the server run boundary explicitly. Durable job state and worker/service boundaries are implemented; autonomous distributed workers and hosted scheduling are DEFERRED_EXTERNAL.

### FI2 continuity and isolation

Successful execution atomically records an assistant message, asset reference and project activity. The run's conversation is usable as a prior reference by FI1. Existing Home Continue/Projects use canonical persisted conversations/activity; Project Workspace retrieves its authorized outputs.

History, Memory and Project Brain remain separate. Memory OFF suppresses automatic retrieval/writes while Brain, durable project goal, execution, history, jobs and artifacts still work. New UI caches are keyed by authenticated user and project; no localStorage becomes canonical data.

Server checks precede context loading. Runtime jobs/checkpoints and artifacts are restricted to their requester/owner; another team member does not gain private memory or conversation access. Project owners can receive safe approval metadata for team requests without receiving private checkpoints. Tests cover cross-user/project denial and FI2 conversation isolation. Goals, Brain and memory contents do not enter navigation parameters or safe execution traces. Database errors are returned through generic safe server errors.

## Executed validation

Existing lockfile and installed dependency state were used; no dependency/lockfile changes. Node v24.19.0. PGlite tests execute the canonical PostgreSQL schema and FI3 migration locally; no hosted database was contacted.

| Gate                                                      | Actual result                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| FI3 behavioral (`tests/fi3-capability-runtime.test.mjs`)  | 22/22 PASS, 0 skipped                                                                            |
| FI3 PostgreSQL/PGlite (`tests/fi3-persistence.test.mjs`)  | 12/12 PASS, 0 skipped; includes parent test                                                      |
| Targeted FI3 + P4 + P5 regressions                        | 58/58 PASS, 0 skipped                                                                            |
| FI2 behavioral + persistence migration                    | 24/24 PASS, 0 skipped                                                                            |
| Project Brain, Memory, FI1, Global Search, Command Center | 47/47 PASS, 0 skipped                                                                            |
| `npm test`                                                | 374/374 PASS, 0 failed, 0 skipped                                                                |
| `npm run typecheck`                                       | PASS, 0 type errors                                                                              |
| `npm run lint`                                            | PASS, 0 errors, 11 Fast Refresh warnings (9 existing, 2 in the shared FI3 component/hook module) |
| `npm run build`                                           | PASS, Cloudflare module production package generated; not deployed                               |
| `npm run test:smoke`                                      | 1/1 PASS; canonical package/assets/Worker/config checks                                          |
| `git diff --check`                                        | PASS                                                                                             |
| Changed-file credential review                            | PASS; no credential literals found; environment/build/cache/archive files excluded               |

The final full-suite run took about five seconds. A preceding run was 373/374 because an old invalid-input test used `video`, now a supported FI3 capability. That fixture now uses an actually unsupported capability and retains its invalid-request/no-dispatch assertions; an additional assertion verifies video without an eligible provider is PROVIDER_UNAVAILABLE. No valid assertion was deleted and no tests were skipped. The moved Business UI source assertion reads the wrapper and shared implementation. Critical FI3 gates are behavioral and transactional, not source-string checks.

Targeted PostgreSQL testing also exposed two genuine ACL errors, both fixed: direct membership UPDATE and caller-supplied workflow ID INSERT. The final tests prove the authorized operations while retaining the original direct-write restrictions.

## Migration and safety

`supabase/migrations/20260920000000_fi3_capability_runtime.sql` is MIGRATION_SOURCE_ONLY. It extends canonical columns/indexes/policies, adds service-only runtime commands and the narrowly authorized membership operation, and preserves legacy non-runtime guards. Checkpoints are capped; output completion validates a real result. RLS and grants are validated through PGlite under different actors/roles.

Rollback must first stop runtime callers/workers and export any FI3 job/checkpoint/artifact/approval data. Revert adapters and dependent policies/functions before considering removal of additive columns/indexes; do not discard persisted user history. No production migration was executed.

Main modified: NO. Production modified: NO. Production Supabase modified: NO. DNS/payments/payouts modified: NO. No deployment, merge, force push, secret request or paid external invocation. FI4 NOT_STARTED.

DEFERRED_EXTERNAL: paid/live creative and model-provider verification; hosted database migration; distributed workers/scheduler; rendered browser/mobile/RTL/accessibility QA. RENDERED_PASS and LIVE_VERIFIED are not claimed. Source locale parity and accessibility contracts are covered; rendered validation remains FI7.

## Exact final preservation

The source manifest is `artifacts/fi3-preservation/XEOMX_FI3_FINAL_CLOSURE_20260920.manifest.json`. Its companion on `preservation/xeomx-fi3-final-20260921` binds the literal final commit, exact bundle SHA-256, file list and validation to GitHub recovery material. The scoped recovery workflow verifies the FI2 prerequisite, bundle hash, bundle HEAD, ancestry and exact remote ref equality, then performs a normal non-force push of only the FI3 branch. No closure is declared from a local-only bundle.

Files changed are enumerated in the manifest: capability runtime/composition/server functions; Creative/Business/Project/Team UI and three routes; canonical Orchestrator/approvals/registry; automation/collaboration and Business services; P9 planner/Model Gateway/creative transport; five locales; the source-only migration; focused behavioral and PostgreSQL tests/fixtures and two adapted existing UI/Gateway tests; this evidence and manifest.
