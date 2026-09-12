# ADR-0004: Global Search and Command Center

Date: 2026-09-12. Source foundation implemented; rendered interaction acceptance pending.

XEOMX owns GlobalSearchQuery/Filters/Result/Source/Page/Sort and canonical action contracts. Sources map existing projects, conversations, authored prompts, owned asset metadata and owned generation-job metadata. MemoryService supplies enabled authorized memories; ProjectBrainService supplies unresolved project entries for explicitly scoped requests. No duplicate domain, search cluster, dependency or migration is introduced. No provider SDK type is present in search product contracts.

## Search and security

An authenticated server function verifies the caller and constructs user-token Supabase clients. Existing RLS is retained. Membership is checked using xeomx_project_role; results with private ownership require the current user. Assets and generation jobs are additionally filtered by owner in the native query. Prompts are the user's authored prompts, not public marketplace discovery (the existing marketplace search remains available). Conversation reads retain project RLS. Memory and brain access goes through their existing services and disabled-memory controls; raw brain JSON is not exposed as a memory result. Unknown/malformed source responses fail that source closed. Errors are classified without returning storage messages or credentials.

Normalization uses NFKC, case folding and whitespace normalization. Lexical ranking uses exact title, Unicode word/partial matches and optional importance, then recency/type/ID. Empty queries return recent candidates. Source/type/project filters, offset/limit and stable ordering operate within a bounded candidate window; source failures are explicit. No semantic retrieval is executed; a provider-neutral source extension is defined.

Coverage is deliberately reported as `bounded`, not exhaustive: up to 100 recent rows per native source; memory retrieval spans global plus five recent authorized projects and five recent conversations, with up to 50 records per scope. Brain entries are loaded only for an explicit project. Pagination is within that assembled window and can change when underlying data changes. Large historical corpus search/indexing is deferred. GlobalSearchPage returns per-source availability, totalInWindow and nextOffset, not a misleading corpus-wide count. UI copy identifies results as recent workspace items.

## Command UX

The existing lazy GlobalLauncher now opens the Command Center, keeping legacy preview navigation under More. Existing shadcn Command/cmdk and Radix Dialog provide the input/list/selection and dialog mechanics. The always-visible 44px trigger and Ctrl/Cmd+K open one palette; controls use logical direction, five existing locale catalogs and bounded viewport dimensions. The modal has an accessible title/description and explicit close-focus restoration. Actual keyboard/mobile/RTL interaction acceptance still requires rendered browser tests.

One input supports search and deterministic English/Persian/Arabic intent patterns. Intent classification itself has no side effects. Explicit selection invokes canonical actions: create project through existing createProjectFn authorization, continue latest authorized project, search, open creation/chat entry points, memory/generations, settings or legacy navigation. Creation/chat actions open existing product entry points; they do not claim autonomous execution. Recent-project lookup is independent from mixed search rankings.

Search and workspace queries use actor-specific TanStack Query keys, no persistent private cache, short debounce and stale-result suppression. Anonymous users see navigation/sign-in rather than private search. Failed/unavailable sources show a user-facing status. A minimal authenticated `/workspace` result view provides canonical targets, scoped brain entries and selected metadata previews, without creating a new project data model. It is not a full asset editor, conversation composer or Memory management UI.

## P1 acceptance and P2 boundary

Source tests exercise ranking, permissions, adapters, canonical action handlers, intent routing and localization/component composition. Those composition tests do not prove browser keyboard or layout behavior. Cloud Browser refused the local preview with ERR_BLOCKED_BY_CLIENT and then an explicit URL-policy rejection prohibiting alternate browser workarounds. No workaround was attempted. Browser page identity, screenshot, keyboard/Enter/Escape and mobile layout checks remain unverified. Live Supabase execution/RLS remains deferred from prior phases; no environment was retried or changed.

P1 cannot be reported CLOSED until the Command Center rendered acceptance is completed. P2 may later extend canonical action/search/context interfaces; no agents, frameworks or P2 branch are created here. Main and Production are untouched.

Existing component APIs were checked against [Command](https://ui.shadcn.com/docs/components/radix/command) and [Dialog](https://ui.shadcn.com/docs/components/radix/dialog) documentation. The offline shadcn CLI was not cached, so no CLI package or UI dependency was installed.
