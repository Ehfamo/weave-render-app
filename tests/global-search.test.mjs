import assert from "node:assert/strict";
import { test } from "node:test";
import { GlobalSearchService, validateQuery, normalize } from "../src/lib/global-search/service.ts";
import { nativeSources } from "../src/lib/global-search/sources.ts";
const user = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  project = "00000000-0000-4000-8000-000000000003",
  denied = "00000000-0000-4000-8000-000000000004";
const date = "2026-09-12T00:00:00.000Z";
const access = { userId: user, canReadProject: async (id) => id === project };
function row(type, id, title = "Shoe campaign", extra = {}) {
  return {
    type,
    id,
    title,
    snippet: "Launch tomorrow",
    projectId: project,
    ownerId: user,
    createdAt: date,
    updatedAt: date,
    ...extra,
  };
}
function service(rows) {
  return new GlobalSearchService(
    ["project", "conversation", "memory", "prompt", "asset", "generation"].map((type) => ({
      id: type,
      type,
      read: async () => rows.filter((r) => r.type === type),
    })),
    access,
  );
}
test("all six source types participate in unified lexical search and safe targets", async () => {
  const rows = ["project", "conversation", "memory", "prompt", "asset", "generation"].map((t, i) =>
    row(t, String(i)),
  );
  const page = await service(rows).search({ text: "shoe" });
  assert.equal(page.results.length, 6);
  assert.equal(new Set(page.results.map((r) => r.type)).size, 6);
  for (const r of page.results) {
    assert.ok(r.target.startsWith("/workspace?"));
    assert.equal(r.ownerId, undefined);
    assert.equal(r.source.method, "lexical");
  }
});
test("ranking favors exact title then lexical matches with deterministic ties", async () => {
  const s = service([
    row("prompt", "b", "Shoe story"),
    row("asset", "a", "shoe"),
    row("memory", "c", "Different", { snippet: "shoe" }),
  ]);
  const a = await s.search({ text: " Shoe " });
  assert.equal(a.results[0].id, "a");
  assert.deepEqual(a, await s.search({ text: "shoe" }));
});
test("source/project filters pagination limits and recent sorting are stable", async () => {
  const s = service([
    row("memory", "b"),
    row("memory", "a"),
    row("asset", "c", "Shoe", { updatedAt: "2026-09-13T00:00:00Z" }),
  ]);
  const q = { text: "", filters: { types: ["memory"], projectId: project }, limit: 1 };
  const a = await s.search(q),
    b = await s.search({ ...q, offset: a.nextOffset });
  assert.equal(a.results[0].id, "a");
  assert.equal(b.results[0].id, "b");
  assert.equal(b.nextOffset, null);
  assert.equal((await s.search({ text: "", sort: "recent" })).results[0].id, "c");
});
test("tenant ownership and project membership exclude unauthorized data", async () => {
  const s = service([
    row("memory", "a", "Secret", { ownerId: other }),
    row("asset", "b", "Secret", { projectId: denied }),
    row("generation", "c", "Secret", { ownerId: undefined }),
    row("conversation", "d", "Secret", { projectId: denied }),
    row("prompt", "e", "Secret", { ownerId: other }),
  ]);
  assert.equal((await s.search({ text: "" })).results.length, 0);
  await assert.rejects(s.search({ text: "", filters: { projectId: denied } }), /ACCESS_DENIED/);
});
test("query validation rejects malformed excessive and invalid pagination input", () => {
  for (const q of [
    null,
    { text: 1 },
    { text: "x".repeat(301) },
    { text: "", limit: 0 },
    { text: "", limit: 51 },
    { text: "", offset: -1 },
    { text: "", filters: { types: ["secret"] } },
    { text: "", filters: { projectId: "bad" } },
  ])
    assert.throws(() => validateQuery(q));
  assert.equal(normalize(" ＳＨＯＥ   Campaign "), "shoe campaign");
});
test("unavailable sources remain visible as unavailable without leaking errors", async () => {
  const s = new GlobalSearchService(
    [
      {
        id: "broken",
        type: "prompt",
        read: async () => {
          throw new Error("private credential");
        },
      },
      { id: "good", type: "asset", read: async () => [row("asset", "a")] },
    ],
    access,
  );
  const r = await s.search({ text: "" });
  assert.equal(r.results.length, 1);
  assert.equal(r.sources[0].status, "unavailable");
  assert.ok(!JSON.stringify(r).includes("credential"));
});
test("native sources map existing storage and respect disabled memory and brain controls", async () => {
  let enabled = true;
  const calls = [];
  const tables = {
    project: [
      { id: project, name: "Shoe", description: "Goal", created_at: date, updated_at: date },
    ],
    conversation: [],
    prompt: [
      {
        id: user,
        author_id: user,
        title: "Shoe",
        description: "Prompt",
        created_at: date,
        updated_at: date,
      },
    ],
    asset: [
      {
        id: user,
        owner_id: user,
        project_id: project,
        kind: "image",
        mime_type: "image/png",
        metadata: { name: "Shoe asset" },
        created_at: date,
        updated_at: date,
      },
    ],
    generation: [
      {
        id: user,
        user_id: user,
        project_id: project,
        capability: "text-generation",
        status: "completed",
        created_at: date,
        updated_at: date,
      },
    ],
  };
  const memory = {
    settings: async () => ({ enabled, disabledTypes: [] }),
    relevant: async (q) => {
      calls.push(q.scope);
      return enabled
        ? [
            {
              memory: {
                id: other,
                userId: user,
                type: "BrandMemory",
                scope: q.scope,
                content: "Shoe brand",
                importance: 1,
                createdAt: date,
                updatedAt: date,
                source: { kind: "user" },
              },
            },
          ]
        : [];
    },
  };
  const brain = {
    snapshot: async () => ({
      entries: enabled ? [{ id: "open", text: "Shoe task", resolved: false }] : [],
      updatedAt: date,
    }),
  };
  const sources = nativeSources({ rows: async (t) => tables[t] }, memory, brain, access);
  const s = new GlobalSearchService(sources, access);
  const r = await s.search({ text: "", filters: { projectId: project } });
  assert.ok(r.results.some((r) => r.id === "brain-open"));
  assert.ok(calls.some((s) => s.kind === "project"));
  enabled = false;
  const off = await s.search({ text: "", filters: { types: ["memory"], projectId: project } });
  assert.equal(off.results.length, 0);
});
test("candidate row corruption fails that source closed and duplicate registration is rejected", async () => {
  const source = {
    id: "x",
    type: "project",
    read: async () => [row("project", "a", "title", { createdAt: "invalid" })],
  };
  assert.throws(() => new GlobalSearchService([source, source], access), /DUPLICATE/);
  const r = await new GlobalSearchService([source], access).search({ text: "" });
  assert.equal(r.results.length, 0);
  assert.equal(r.sources[0].status, "unavailable");
});
