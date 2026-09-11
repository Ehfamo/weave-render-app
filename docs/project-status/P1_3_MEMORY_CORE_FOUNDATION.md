# P1.3 Memory Core foundation evidence

Date: 2026-09-11 UTC.
Repository: Ehfamo/weave-render-app.
Branch: feature/xeomx-p1-memory-core-20260911.
Exact parent: 0e8ea6996e31bfe772efe78598853dbcb3771192.
Validated source/test HEAD: 9713cdb613fdc38c3bc7baf42eb07136307a8d39.
Evidence commit: the subsequent commit containing this document (not a self-referential hash).

P1_MEMORY_CORE = PASS (source foundation; native deployment not performed).
MEM0_DECISION = REFERENCE. MEM0_INSTALLED = NO.
P1_PROJECT_BRAIN_STARTED = NO.

## Delivered

- `src/lib/memory/contracts.ts`: canonical categories, records, exact scopes, provenance, importance/status, query/results, settings and adapter boundary.
- `src/lib/memory/service.ts`: validated CRUD, archive/delete, opt-in/category controls, bounded deterministic retrieval and returned-owner checks.
- `src/lib/memory/native-adapter.ts`: unknown RPC data normalized into canonical records; storage/transport errors sanitized.
- `src/lib/memory/runtime.server.ts`: server-only factory, user JWT verification and user-token client; no service-role credential.
- `supabase/migrations/20260912000000_p1_memory_core.sql`: additive native tables, FKs/indexes, RLS, invoker RPC and immutable provenance/identity trigger. Source only; not applied.
- `tests/memory-core.test.mjs`, `tests/memory-migration.test.mjs`: ten added tests preserving the prior 148.
- `docs/architecture/ADR-0002_MEMORY_CORE.md`: existing storage audit, ownership, authorization, retrieval limits and pinned Mem0 evaluation.

## Fresh validation

Node v24.19.0; npm 11.9.0. No dependencies installed or changed.

| Gate | Command | Result |
| --- | --- | --- |
| Memory and source migration tests | node --experimental-strip-types --test tests/memory*.test.mjs | 10/10 PASS |
| Full unit/contract including regression and build smoke | node --experimental-strip-types --test --test-reporter=tap tests/*.test.mjs | 158/158 PASS; zero skipped/cancelled |
| Existing integration + migration source checks | node --experimental-strip-types --test tests/request-7-vertical-slice.test.mjs tests/*migration*.test.mjs | 50/50 PASS |
| Typecheck | ./node_modules/.bin/tsc --noEmit | PASS |
| Lint | ./node_modules/.bin/eslint . | 0 errors; 9 existing warnings |
| Build | npm run build | PASS with localhost Supabase URL and dummy publishable test value |

Logs are in `p1-memory-core-validation/`. Build and typecheck were run on identical application source to the validated HEAD; the last commit only formats a test fixture. The final full suite ran after build completion. An earlier overlapping run produced ENOENT for `.output/nitro.json` while build was still generating output; rerunning after build completed passed without changing the smoke assertion. A formatting-only lint error in the transport regression fixture was corrected.

Tests verify opt-in, all eight categories, CRUD/archive/delete, provenance immutability, user/project/conversation isolation, disabled-category behavior, deterministic lexical filtering, adapter result isolation, row normalization and safe error handling. The native adapter uses mocked RPC responses; source migration checks are not executed PostgreSQL policy tests.

## Commits

- ebe57da3c3ad2e6dc773148208f2092ca1d828f1 — contracts/service.
- 8f5c8e7873732b6d4d2a1cdc5c89731db62b3228 — native persistence/RLS migration.
- b9a5839b744ea2d8faba160105b77a44a38fb6b1 — native input validation and isolation tests; no added validation dependency.
- 5a5ff75fa4e138ec2201933746c9f6937ea495b6 — ADR/Mem0 evaluation and transport-error protection.
- 9713cdb613fdc38c3bc7baf42eb07136307a8d39 — fixture formatting.

## Limits and production safety

Native schema/RPC needs application and executed RLS tests in an isolated database before deployment. Supabase CLI/Postgres runtime were unavailable locally; no remote database was contacted or changed. Existing environment migration work remains separate. Retrieval is bounded lexical, not embeddings/vector search; no semantic quality claim. UI, automatic memory capture, external memory processing, Project Brain, Search and Command Center are not part of this foundation.

Changes are confined to new memory source, migration, tests and documentation. Main, canonical P0 files, Model Gateway, lockfile/dependencies, Production deployments/Supabase/Cloudflare, DNS, secrets and payments were not modified. No new credentials or private user data were logged or committed. All work is on the requested isolated branch.
