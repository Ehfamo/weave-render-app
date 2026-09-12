import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { MemoryService } from "../src/lib/memory/service.ts";
import { ProjectBrainService } from "../src/lib/project-brain/service.ts";
import { createProjectDomain } from "../src/lib/project-brain/native-domain.ts";
const u = "00000000-0000-4000-8000-000000000001",
  v = "00000000-0000-4000-8000-000000000002";
const p = "00000000-0000-4000-8000-000000000003",
  p2 = "00000000-0000-4000-8000-000000000004";
const c = "00000000-0000-4000-8000-000000000005",
  c2 = "00000000-0000-4000-8000-000000000006";
const timestamp = "2026-09-12T00:00:00.000Z";
function fixture(userId = u, rows = new Map()) {
  let settings = { enabled: true, disabledTypes: [] },
    member = true;
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
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      rows.set(r.id, r);
      return r;
    },
    get: async (id) => (rows.get(id)?.userId === userId ? structuredClone(rows.get(id)) : null),
    list: async () =>
      [...rows.values()].filter((r) => r.userId === userId).map((r) => structuredClone(r)),
    update: async (id, patch) => {
      const r = await adapter.get(id);
      if (!r) return null;
      Object.assign(r, patch);
      rows.set(id, r);
      return r;
    },
    delete: async (id) => {
      if (await adapter.get(id)) rows.delete(id);
    },
  };
  const memory = new MemoryService(adapter);
  const domain = {
    userId,
    getAuthorizedProject: async (id) =>
      member && [p, p2].includes(id)
        ? { id, name: "Project", description: "Test", updatedAt: timestamp }
        : null,
    recentConversations: async (id) => [
      { id: c, projectId: id, title: "Conversation", updatedAt: timestamp },
    ],
    authorizeConversation: async (id, cid) => member && id === p && [c, c2].includes(cid),
  };
  return {
    brain: new ProjectBrainService(memory, domain),
    memory,
    domain,
    rows,
    revoke: () => {
      member = false;
    },
  };
}
test("goal is persisted through MemoryService and reconstructed by a new service", async () => {
  const f = fixture();
  await f.brain.setGoal(p, "Finish film");
  await f.brain.setGoal(p, "Finish episode");
  assert.equal(f.rows.size, 1);
  assert.equal([...f.rows.values()][0].type, "ProjectMemory");
  const next = new ProjectBrainService(f.memory, f.domain);
  assert.equal((await next.snapshot(p)).goal.text, "Finish episode");
});
test("instructions decisions constraints entities and open items support updates", async () => {
  const { brain } = fixture();
  await brain.setInstruction(p, "i", "Keep identity");
  await brain.setInstruction(p, "i", "Keep voice");
  await brain.recordDecision(p, "d", "Use night");
  await brain.recordConstraint(p, "k", "No budget");
  await brain.trackEntity(p, "e", "Hero");
  await brain.trackOpenItem(p, "o", "Record audio");
  let s = await brain.snapshot(p);
  assert.equal(s.instructions.length, 1);
  assert.equal(s.instructions[0].text, "Keep voice");
  assert.equal(s.decisions[0].text, "Use night");
  assert.equal(s.constraints[0].text, "No budget");
  assert.equal(s.entities[0].text, "Hero");
  assert.equal(s.openItems.length, 1);
  await brain.trackOpenItem(p, "o", "Record audio", true);
  s = await brain.snapshot(p);
  assert.equal(s.openItems.length, 0);
});
test("user and project isolation preserve independent private brains", async () => {
  const rows = new Map(),
    a = fixture(u, rows),
    b = fixture(v, rows);
  await a.brain.setGoal(p, "Private A");
  await b.brain.setGoal(p, "Private B");
  await a.brain.setGoal(p2, "Other project");
  assert.equal((await a.brain.snapshot(p)).goal.text, "Private A");
  assert.equal((await b.brain.snapshot(p)).goal.text, "Private B");
  assert.equal((await a.brain.snapshot(p2)).goal.text, "Other project");
});
test("membership revocation denies reads writes and context construction", async () => {
  const f = fixture();
  await f.brain.setGoal(p, "Goal");
  f.revoke();
  for (const action of [
    () => f.brain.get(p),
    () => f.brain.setGoal(p, "Attack"),
    () => f.brain.snapshot(p),
    () => f.brain.buildContext(p),
    () => f.brain.relevantProjectMemories(p),
  ])
    await assert.rejects(action, /ACCESS_DENIED/);
});
test("project continuity survives switching conversations; conversation memory stays scoped", async () => {
  const f = fixture();
  await f.brain.setGoal(p, "Continue");
  await f.brain.recordDecision(p, "d", "Direction");
  await f.memory.create({
    type: "ConversationMemory",
    scope: { kind: "conversation", projectId: p, conversationId: c },
    content: "First thread only",
    importance: 1,
    source: { kind: "conversation" },
  });
  const a = await f.brain.snapshot(p, c),
    b = await f.brain.snapshot(p, c2);
  assert.deepEqual(a.entries, b.entries);
  assert.equal(a.memories.length, 1);
  assert.equal(b.memories.length, 0);
  await assert.rejects(f.brain.snapshot(p, p2), /CONVERSATION_ACCESS_DENIED/);
});
test("character voice brand preference facts and relevance reuse canonical memory", async () => {
  const f = fixture();
  for (const type of ["CharacterMemory", "VoiceMemory", "BrandMemory", "PreferenceMemory"])
    await f.memory.create({
      type,
      scope: { kind: "project", projectId: p },
      content: `Film ${type}`,
      importance: 0.8,
      source: { kind: "user" },
    });
  await f.brain.put(p, { id: "fact", kind: "fact", text: "Filming tomorrow", resolved: false });
  const s = await f.brain.snapshot(p);
  assert.equal(s.memories.length, 4);
  assert.equal((await f.brain.relevantProjectMemories(p, "VoiceMemory")).length, 1);
  assert.ok((await f.brain.buildContext(p)).text.includes("Filming tomorrow"));
});
test("snapshots and bounded context are deterministic and need no model credentials", async () => {
  const f = fixture();
  await f.brain.setGoal(p, "A long goal ".repeat(50));
  assert.deepEqual(await f.brain.snapshot(p), await f.brain.snapshot(p));
  const a = await f.brain.buildContext(p, { maxCharacters: 128 });
  assert.ok(a.text.length <= 128);
  assert.equal(JSON.parse(a.text).projectId, p);
  assert.ok(!("snapshot" in a));
  assert.equal(a.truncated, true);
  assert.deepEqual(a, await f.brain.buildContext(p, { maxCharacters: 128 }));
  await assert.rejects(f.brain.buildContext(p, { maxCharacters: Infinity }));
  assert.equal((await f.brain.snapshot(p)).summary.method, "deterministic");
});
test("disabled memory excludes stored brain from context while inspection remains available", async () => {
  const f = fixture();
  await f.brain.setGoal(p, "Private secret");
  await f.memory.setSettings({ enabled: false, disabledTypes: [] });
  assert.equal((await f.brain.get(p)).entries.length, 1);
  assert.equal((await f.brain.snapshot(p)).goal, null);
  assert.ok(!(await f.brain.buildContext(p)).text.includes("Private secret"));
  await assert.rejects(f.brain.setGoal(p, "New"), /MEMORY_DISABLED/);
  await f.memory.setSettings({ enabled: true, disabledTypes: ["ProjectMemory"] });
  assert.equal((await f.brain.snapshot(p)).goal, null);
  await assert.rejects(f.brain.setGoal(p, "New"), /MEMORY_DISABLED/);
});
test("invalid entries and capacity fail without discarding canonical state", async () => {
  const f = fixture();
  await assert.rejects(f.brain.put(p, { id: "bad", kind: "fake", text: "x", resolved: false }));
  for (let i = 0; i < 4; i++) await f.brain.setInstruction(p, `i${i}`, "a".repeat(1450));
  const before = await f.brain.get(p);
  await assert.rejects(f.brain.setInstruction(p, "overflow", "b".repeat(1500)), /CAPACITY/);
  assert.deepEqual(await f.brain.get(p), before);
});
test("native domain requires explicit membership and rejects mismatched project/conversation data", async () => {
  let role = "editor";
  let mismatch = false;
  const d = createProjectDomain(u, {
    role: async () => role,
    project: async () => ({ id: p, name: "Project", description: null, updated_at: timestamp }),
    conversations: async () => [
      { id: c, project_id: mismatch ? p2 : p, title: "Chat", updated_at: timestamp },
    ],
  });
  assert.equal((await d.getAuthorizedProject(p)).id, p);
  assert.equal(await d.authorizeConversation(p, c), true);
  mismatch = true;
  await assert.rejects(d.recentConversations(p), /ACCESS_DENIED/);
  mismatch = false;
  role = null;
  await assert.rejects(d.getAuthorizedProject(p), /ACCESS_DENIED/);
  await assert.rejects(d.authorizeConversation(p, c), /ACCESS_DENIED/);
});
test("corrupt or conflicting brain documents fail closed", async () => {
  const f = fixture();
  await f.brain.setGoal(p, "Goal");
  const r = [...f.rows.values()][0];
  f.rows.set(c, { ...r, id: c });
  await assert.rejects(f.brain.get(p), /BRAIN_CONFLICT/);
  f.rows.delete(c);
  r.content = '{"format":"xeomx.project-brain.v1","entries":null}';
  await assert.rejects(f.brain.get(p), /INVALID_BRAIN_STATE/);
});
test("contracts remain provider neutral and runtime retains server-only user authentication", async () => {
  const source = await readFile(
    new URL("../src/lib/project-brain/contracts.ts", import.meta.url),
    "utf8",
  );
  assert.ok(!/OpenAI|Groq|Gemini|Mem0|\bany\b/.test(source));
  const runtime = await readFile(
    new URL("../src/lib/project-brain/runtime.server.ts", import.meta.url),
    "utf8",
  );
  assert.ok(runtime.includes("@tanstack/react-start/server-only"));
  assert.ok(runtime.includes("getUser(token)"));
  assert.ok(!runtime.includes("SERVICE_ROLE"));
  assert.ok(runtime.includes("xeomx_project_role"));
});
