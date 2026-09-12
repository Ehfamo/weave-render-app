# P1 Search and Command Center sprint

Repository: Ehfamo/weave-render-app.
Branch: feature/xeomx-p1-search-command-center-20260912.
Exact parent: 84aa53dcf9a81b18127a7a8b79b5238fd637ac20.
Validated source HEAD: 03aa746d57a00e7294e0142efda53eb823015723.
Evidence commit: subsequent commit containing this document.

P1_GLOBAL_SEARCH = PASS (bounded source foundation).
P1_COMMAND_CENTER = PARTIAL (implemented; rendered acceptance blocked).
P1 = OPEN.
P2_STARTED = NO.

## Delivered

Global Search contracts/service and seven source adapters are in `src/lib/global-search/`. Result types are project, conversation, memory, prompt, asset and generation. The additional project-brain source returns authorized scoped entries as memory results. Existing native schema and MemoryService/ProjectBrainService are reused. An authenticated server function provides the application runtime path. No migration or dependency was added.

Command Center contracts/actions live in `src/lib/command-center/actions.ts`. `src/components/xeomx/command-center/CommandCenter.tsx` composes existing cmdk/Radix components. The existing lazy GlobalLauncher/provider now supplies the global trigger and shortcut, preserving legacy navigation under More. `src/routes/workspace.tsx` supplies authorized result previews and paging; routeTree.gen.ts was regenerated. Twenty-one genuine labels were added with parity across en/fa/ar/zh/hi.

Source status: projects/conversations use existing membership/RLS; prompts use authored prompt rows; assets use owned metadata; generations use owned generation-job metadata; memories use enabled MemoryService retrieval; scoped brain entries use ProjectBrainService. Each is implemented and covered by source/adapter tests. Live database execution is not claimed. Scope/candidate limits and privacy assumptions are documented in ADR-0004.

## Fresh validation

Node 24.19.0; npm 11.9.0. No installation or lockfile change.

| Gate | Result |
| --- | --- |
| Parent unit suite | 170/170 PASS (prior evidence) |
| Final full unit/contract | 184/184 PASS; zero skipped/cancelled |
| Global Search | 8/8 PASS |
| Command contracts/composition | 6/6 PASS |
| Project Brain regression | 12/12 PASS |
| Memory regression | 10/10 PASS |
| Relevant combined integration subset | 48/48 PASS |
| Typecheck | PASS |
| Lint | 0 errors, 9 existing warnings |
| Build | PASS with isolated localhost Supabase URL/dummy public test value |
| Browser interaction/layout | BLOCKED_BY_EXTERNAL_DEPENDENCY; not executed successfully |

Commands: local `tsc --noEmit`, `eslint .`, `npm run build`, and `node --experimental-strip-types --test --test-reporter=tap tests/*.test.mjs`. The full suite ran after final build completion. Focused/integration commands select global-search, command-center, project-brain, memory and request-7-vertical-slice tests. Logs are under `p1-search-command-validation/`; build asset listings are omitted. A final public bundle scan found no createSearchService/SEARCH_AUTH_REQUIRED/server publishable-key identifier matches in `.output/public/assets/*.js`.

Two TypeScript wiring errors found during development (auth-route search parameters and action-runner import) were corrected. No tests, validation rules or existing phase contracts were disabled or weakened.

## Rendered QA limitation

Target flow: local workspace -> open palette -> search/select action -> correct authorized destination. Cloud Browser bootstrap succeeded, but opening `http://127.0.0.1:5173/en/workspace` returned ERR_BLOCKED_BY_CLIENT. A subsequent attempt returned an explicit Cloud Browser URL-policy rejection prohibiting raw CDP, alternate surfaces and indirect workarounds. No such workaround was used. The initial wildcard-host dev server also encountered uv_interface_addresses restrictions; using the explicit loopback host started Vite, but did not remove the independent browser policy restriction.

Therefore page identity, screenshots, rendered desktop/mobile layout, actual arrow/Enter/Escape behavior and browser search/action integration are NOT marked PASS. Unit tests cover handlers, intents, shortcut predicates, composition and locale catalogs; they are not a substitute for rendered interaction tests. Authenticated live persistence/RLS and creation were also not exercised against Supabase.

## Commits and safety

- b2d14be775e19af12940daea29ad12f1cb911609 — search contracts/ranking.
- 5ac1c67005c2a2f40ab4e3885b5670c41d7f2842 — authorized native sources.
- dfdb46f1e250d4a9cbe0dae1cabed258d5e6b8b8 — Command Center/workspace integration.
- 04e931dc9576a6cf68d5a98492a2a2b1a20f7346 — source/action tests and focus handling.
- 03aa746d57a00e7294e0142efda53eb823015723 — action import and Unicode token ranking.

All checkpoints were pushed on the new feature branch. Main and Production deployment/Supabase/Cloudflare/DNS/secrets/payments were not modified. The deploy workflow is restricted to main pushes or manual dispatch; no deployment was invoked. Canonical P0, Model Gateway, Memory Core and Project Brain source remain unchanged. No framework, search service, migration, agent or P2 branch was introduced.

Remaining acceptance work: run Command Center rendered desktop/mobile/RTL and authenticated integration checks in a permitted isolated environment. Existing deferred live database verification remains separate. Search is a bounded recent-data foundation, not exhaustive historical or semantic retrieval. P1 remains OPEN until Command Center acceptance is trustworthy.
