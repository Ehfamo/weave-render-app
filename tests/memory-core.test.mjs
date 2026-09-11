import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { MemoryService } from "../src/lib/memory/service.ts";
import { NativeMemoryAdapter } from "../src/lib/memory/native-adapter.ts";
import { MEMORY_TYPES } from "../src/lib/memory/contracts.ts";

const user = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const project = "00000000-0000-4000-8000-000000000003";
const conversation = "00000000-0000-4000-8000-000000000004";
const draft = {
  type: "UserMemory",
  scope: { kind: "user" },
  content: "prefers clear writing",
  importance: 0.8,
  source: { kind: "user", reference: "explicit setting" },
};
function fixture(userId = user, rows = new Map()) {
  let settings = { enabled: false, disabledTypes: [] };
  const adapter = {
    userId,
    settings: async () => structuredClone(settings),
    setSettings: async (s) => (settings = structuredClone(s)),
    create: async (d) => {
      const r = {
        ...structuredClone(d),
        id: crypto.randomUUID(),
        userId,
        status: "active",
        createdAt: "2026-09-12T00:00:00.000Z",
        updatedAt: "2026-09-12T00:00:00.000Z",
      };
      rows.set(r.id, r);
      return r;
    },
    get: async (id) => (rows.get(id)?.userId === userId ? rows.get(id) : null),
    list: async () => [...rows.values()].filter((r) => r.userId === userId),
    update: async (id, p) => {
      const r = await adapter.get(id);
      if (!r) return null;
      Object.assign(r, p);
      return r;
    },
    delete: async (id) => {
      if (await adapter.get(id)) rows.delete(id);
    },
  };
  return { adapter, service: new MemoryService(adapter), rows };
}
async function enabled(f) {
  await f.service.setSettings({ enabled: true, disabledTypes: [] });
  return f;
}

test("memory opt-in, CRUD, immutable provenance, archive and deletion", async () => {
  const f = fixture();
  await assert.rejects(f.service.create(draft), /MEMORY_DISABLED/);
  await enabled(f);
  const r = await f.service.create(draft);
  assert.deepEqual(r.source, draft.source);
  assert.equal((await f.service.get(r.id)).content, draft.content);
  await f.service.update(r.id, { content: "updated" });
  assert.equal((await f.service.get(r.id)).content, "updated");
  await assert.rejects(f.service.update(r.id, { userId: other }));
  await assert.rejects(f.service.update(r.id, { source: { kind: "import" } }));
  await f.service.archive(r.id);
  assert.deepEqual(await f.service.relevant({ scope: { kind: "user" } }), []);
  assert.equal((await f.service.list({ scope: { kind: "user" } })).length, 1);
  await f.service.delete(r.id);
  assert.equal(await f.service.get(r.id), null);
});

test("two users sharing storage cannot read update or delete each other's memory", async () => {
  const rows = new Map();
  const a = await enabled(fixture(user, rows));
  const b = await enabled(fixture(other, rows));
  const r = await a.service.create(draft);
  assert.equal(await b.service.get(r.id), null);
  assert.equal(await b.service.update(r.id, { content: "attack" }), null);
  await b.service.delete(r.id);
  assert.equal((await a.service.get(r.id)).content, draft.content);
  assert.deepEqual(await b.service.relevant({ scope: { kind: "user" } }), []);
});

test("project and conversation scopes never mix implicitly", async () => {
  const f = await enabled(fixture());
  await f.service.create(draft);
  const p = await f.service.create({
    ...draft,
    type: "ProjectMemory",
    scope: { kind: "project", projectId: project },
  });
  const c = await f.service.create({
    ...draft,
    type: "ConversationMemory",
    scope: { kind: "conversation", projectId: project, conversationId: conversation },
  });
  assert.deepEqual(
    (await f.service.relevant({ scope: p.scope })).map((m) => m.memory.id),
    [p.id],
  );
  assert.deepEqual(
    (await f.service.relevant({ scope: c.scope })).map((m) => m.memory.id),
    [c.id],
  );
  assert.deepEqual(await f.service.relevant({ scope: { kind: "project", projectId: other } }), []);
  assert.deepEqual(await f.service.relevant({ scope: { ...c.scope, conversationId: other } }), []);
});

test("all eight categories work and disabled categories stop writes/retrieval but retain inspection", async () => {
  const f = await enabled(fixture());
  for (const type of MEMORY_TYPES) {
    const scope =
      type === "ProjectMemory"
        ? { kind: "project", projectId: project }
        : type === "ConversationMemory"
          ? { kind: "conversation", projectId: project, conversationId: conversation }
          : { kind: "user" };
    assert.equal((await f.service.create({ ...draft, type, scope })).type, type);
  }
  await f.service.setSettings({ enabled: true, disabledTypes: ["UserMemory"] });
  await assert.rejects(f.service.create(draft), /MEMORY_DISABLED/);
  assert.equal(
    (await f.service.relevant({ scope: draft.scope })).some((m) => m.memory.type === "UserMemory"),
    false,
  );
  assert.equal(
    (await f.service.list({ scope: draft.scope })).some((m) => m.type === "UserMemory"),
    true,
  );
  await f.service.setSettings({ enabled: false, disabledTypes: [] });
  assert.deepEqual(await f.service.relevant({ scope: draft.scope }), []);
});

test("query validation, importance, recency, lexical relevance and limits are deterministic", async () => {
  const f = await enabled(fixture());
  await f.service.create(draft);
  await f.service.create({ ...draft, content: "unrelated", importance: 0.1 });
  const q = {
    scope: draft.scope,
    query: "CLEAR",
    minimumImportance: 0.5,
    limit: 1,
    updatedSince: "2026-09-11T00:00:00Z",
  };
  const a = await f.service.relevant(q);
  assert.equal(a.length, 1);
  assert.equal(a[0].method, "lexical");
  assert.deepEqual(await f.service.relevant(q), a);
  await assert.rejects(f.service.list({ ...q, limit: 101 }));
  await assert.rejects(f.service.create({ ...draft, importance: NaN }));
  await assert.rejects(f.service.create({ ...draft, type: "ProjectMemory" }));
  await assert.rejects(f.service.create({ ...draft, userId: other }));
});

test("service rejects leaking adapter results and detaches returned memory references", async () => {
  const f = await enabled(fixture());
  const r = await f.service.create(draft);
  const result = await f.service.get(r.id);
  result.content = "changed outside";
  assert.equal((await f.service.get(r.id)).content, draft.content);
  const hostile = new MemoryService({ ...f.adapter, get: async () => ({ ...r, userId: other }) });
  await assert.rejects(hostile.get(r.id), /ACCESS_DENIED/);
});

test("native adapter maps storage rows, binds user and does not forward storage errors", async () => {
  const row = {
    id: conversation,
    user_id: user,
    project_id: project,
    conversation_id: null,
    type: "ProjectMemory",
    content: "private",
    importance: 0.5,
    source: { kind: "user" },
    status: "active",
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:00:00Z",
  };
  const calls = [];
  const native = new NativeMemoryAdapter(user, {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: row, error: null };
    },
  });
  assert.deepEqual((await native.get(conversation)).scope, { kind: "project", projectId: project });
  assert.deepEqual(calls[0], {
    name: "xeomx_memory",
    args: { operation: "get", payload: { id: conversation } },
  });
  const leaking = new NativeMemoryAdapter(other, { rpc: async () => ({ data: row, error: null }) });
  await assert.rejects(leaking.get(conversation), /ACCESS_DENIED/);
  const broken = new NativeMemoryAdapter(user, {
    rpc: async () => ({ data: null, error: { message: "secret value" } }),
  });
  await assert.rejects(broken.get(conversation), (e) => e.message === "MEMORY_STORAGE_ERROR");
  const rejected = new NativeMemoryAdapter(user, {
    rpc: async () => { throw new Error("private transport details"); },
  });
  await assert.rejects(rejected.get(conversation), (e) => e.message === "MEMORY_STORAGE_ERROR");
});

test("memory contracts do not import provider/framework SDK types", async () => {
  const source = await readFile(new URL("../src/lib/memory/contracts.ts", import.meta.url), "utf8");
  assert.ok(!/^import /m.test(source));
  assert.ok(!/\b(any|Mem0|OpenAI|LangGraph)\b/.test(source));
});
