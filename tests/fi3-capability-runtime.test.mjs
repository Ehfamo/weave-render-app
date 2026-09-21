import test from "node:test";
import assert from "node:assert/strict";
import { fixture, actor, other } from "./helpers/fi3-fixture.mjs";
import { BUSINESS_PACKS } from "../src/lib/business-agents/registry.ts";
import { AutomationService } from "../src/lib/automation/service.ts";
import { CollaborationService } from "../src/lib/collaboration/service.ts";
import { CreativeHttpAdapter } from "../src/lib/model-gateway/providers/creative-http.ts";

for (const intent of ["image", "video", "audio", "voice"])
  test(`Creative ${intent} traverses canonical orchestrator and Model Gateway with bounded project context`, async () => {
    const h = await fixture(),
      r = h.request("creative", intent),
      rt = h.runtime(r);
    await rt.jobs.submit(r);
    const out = await rt.jobs.run(r.task.id);
    assert.equal(out.state, "completed");
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].capability, intent);
    assert.match(h.calls[0].input, /Preserve campaign identity/);
    assert.ok(h.calls[0].input.length < 30000);
    assert.equal((await h.store.artifacts(h.project))[0].jobId, out.id);
    assert.equal(
      h.jobs.get(out.id).checkpoint.context.intelligence.intent.brief.projectId,
      h.project,
    );
  });
test("missing Creative provider is NOT_CONFIGURED and creates no successful artifact", async () => {
  const h = await fixture();
  h.provider(false);
  const r = h.request("creative"),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  const j = await rt.jobs.run(r.task.id);
  assert.equal(j.state, "failed");
  assert.equal(j.errorCode, "NOT_CONFIGURED");
  assert.equal(h.artifacts.size, 0);
  assert.equal(h.calls.length, 0);
});
for (const pack of BUSINESS_PACKS)
  test(`Business ${pack.id} reaches real registered runtime and gateway`, async () => {
    const h = await fixture(),
      r = h.request("business", pack.agents[0].id),
      rt = h.runtime(r);
    await rt.jobs.submit(r);
    const j = await rt.jobs.run(r.task.id);
    assert.equal(j.state, "completed");
    assert.equal(h.calls.length, 1);
    assert.match(h.calls[0].input, /Preserve campaign identity/);
    assert.equal(h.jobs.get(j.id).trace.agentId, `business.${pack.agents[0].id}`);
  });
test("Memory OFF preserves Brain, execution and artifacts without automatic memory reads/writes", async () => {
  const h = await fixture();
  await h.fi2.memory.setSettings({ enabled: false, disabledTypes: [] });
  const before = h.fi2.db?.listCalls;
  const r = h.request("business", "marketing"),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  assert.equal((await rt.jobs.run(r.task.id)).state, "completed");
  assert.match(h.calls[0].input, /Preserve campaign identity/);
  assert.equal(
    (await h.fi2.memory.relevant({ scope: { kind: "project", projectId: h.project } })).length,
    0,
  );
  assert.equal(h.artifacts.size, 1);
  if (before !== undefined) assert.equal(h.fi2.db.listCalls, before);
});
const workflow = (project, steps) => ({
  id: crypto.randomUUID(),
  ownerId: actor,
  projectId: project,
  name: "Durable workflow",
  status: "enabled",
  trigger: { kind: "manual" },
  conditions: [],
  steps,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const step = (id, actionId, input, requiresApproval = false) => ({
  id,
  order: 0,
  actionId,
  input,
  requiresApproval,
});
test("approval resumes stored checkpoint across service restart without rerunning prior tools", async () => {
  const h = await fixture();
  const w = workflow(h.project, [
    step("first", "agent.run", { goal: "Prepare draft" }),
    {
      ...step("decision", "brain.decision", { id: "accepted-decision", text: "Keep brand colors" }),
      order: 1,
    },
    { ...step("after", "agent.run", { goal: "Finish draft" }), order: 2 },
  ]);
  const r = h.request("automation", w),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  const waiting = await rt.jobs.run(r.task.id);
  assert.equal(waiting.state, "waiting_approval");
  assert.equal(h.calls.length, 1);
  assert.deepEqual(waiting.checkpoint.completedStepIds, ["first"]);
  await h.authority.decide(
    { requestId: waiting.approvalId, decision: "approved", decidedBy: actor },
    { userId: actor, projectId: h.project },
  );
  const restarted = h.runtime(r);
  const done = await restarted.jobs.run(r.task.id);
  assert.equal(done.state, "completed");
  assert.equal(h.calls.length, 2);
  assert.deepEqual(done.checkpoint.completedStepIds, ["first", "decision", "after"]);
  assert.ok(
    (await h.fi2.brain.snapshot(h.project)).decisions.some((d) => d.text === "Keep brand colors"),
  );
  await h.authority.decide(
    { requestId: waiting.approvalId, decision: "approved", decidedBy: actor },
    { userId: actor, projectId: h.project },
  );
  await restarted.jobs.run(r.task.id);
  assert.equal(h.calls.length, 2);
});
test("reject is terminal and prevents consequential action", async () => {
  const h = await fixture(),
    w = workflow(h.project, [
      step("decision", "brain.decision", { id: "no", text: "Must never persist" }),
    ]),
    r = h.request("automation", w),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  const j = await rt.jobs.run(r.task.id);
  await h.authority.decide(
    { requestId: j.approvalId, decision: "rejected", decidedBy: actor },
    { userId: actor, projectId: h.project },
  );
  assert.equal((await h.runtime(r).jobs.run(j.id)).state, "cancelled");
  assert.equal((await h.fi2.brain.snapshot(h.project)).decisions.length, 0);
  assert.equal(h.artifacts.size, 0);
});
test("duplicate job requests and concurrent dispatch have one model call", async () => {
  const h = await fixture(),
    r = h.request("creative"),
    rt = h.runtime(r);
  await Promise.all([rt.jobs.submit(r), rt.jobs.submit(r)]);
  await Promise.all([rt.jobs.run(r.task.id), rt.jobs.run(r.task.id)]);
  assert.equal(h.jobs.size, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.artifacts.size, 1);
});
test("queued cancellation prevents execution, running cancellation suppresses delivery", async () => {
  const h = await fixture(),
    r = h.request("creative"),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  await h.store.cancel(r.task.id);
  assert.equal((await rt.jobs.run(r.task.id)).state, "cancelled");
  assert.equal(h.calls.length, 0);
  const second = h.request("creative");
  let release;
  const wait = new Promise((resolve) => (release = resolve));
  h.delay(() => wait);
  const rt2 = h.runtime(second);
  await rt2.jobs.submit(second);
  const run = rt2.jobs.run(second.task.id);
  while (h.calls.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
  await h.store.cancel(second.task.id);
  release();
  assert.equal((await run).state, "cancelled");
  assert.equal(h.artifacts.size, 0);
});
test("unconfigured retries are bounded", async () => {
  const h = await fixture();
  h.provider(false);
  const r = h.request("creative"),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  for (let i = 0; i < 3; i++) {
    assert.equal((await rt.jobs.run(r.task.id)).state, "failed");
    if (i < 2) await h.store.retry(r.task.id);
  }
  await assert.rejects(h.store.retry(r.task.id), /NOT_SAFE/);
});
test("automation lifecycle persists enable/pause and dispatch uses canonical service boundary", async () => {
  const h = await fixture(),
    ws = new Map();
  let count = 0;
  const store = {
    actorId: actor,
    role: async () => "owner",
    saveWorkflow: async (w) => ws.set(w.id, structuredClone(w)),
    workflow: async (id) => structuredClone(ws.get(id)),
    workflows: async () => [...ws.values()],
    seenEvent: async () => false,
    dispatch: async (w, e) => {
      count++;
      const r = h.request("automation", w);
      r.idempotencyKey = e.id;
      await h.runtime(r).jobs.submit(r);
      return { execution: { id: r.task.id, status: "queued" }, outputs: [] };
    },
  };
  const service = new AutomationService(store, [
    { id: "agent.run", risk: "SAFE_READ", execute: async () => "unused" },
  ]);
  const w = workflow(h.project, [step("a", "agent.run", { goal: "Prepare" })]);
  w.status = "draft";
  await service.create(w);
  const event = {
    id: crypto.randomUUID(),
    projectId: h.project,
    kind: "manual",
    payload: {},
    correlationId: crypto.randomUUID(),
  };
  await assert.rejects(service.manual(w.id, event), /DISABLED/);
  await service.setEnabled(w.id, true);
  await service.manual(w.id, event);
  await service.setEnabled(w.id, false);
  await assert.rejects(service.manual(w.id, event), /DISABLED/);
  await service.setEnabled(w.id, true);
  assert.equal(ws.get(w.id).status, "enabled");
  assert.equal(count, 1);
  assert.equal(h.jobs.size, 1);
});
test("forced approval on safe automation step waits before calling provider", async () => {
  const h = await fixture(),
    w = workflow(h.project, [step("gated", "agent.run", { goal: "Prepare" }, true)]),
    r = h.request("automation", w),
    rt = h.runtime(r);
  await rt.jobs.submit(r);
  assert.equal((await rt.jobs.run(r.task.id)).state, "waiting_approval");
  assert.equal(h.calls.length, 0);
});
test("Team role changes persist and permissions change on next server operation", async () => {
  const members = new Map([
    [actor, "owner"],
    [other, "editor"],
  ]);
  const store = {
    actorId: actor,
    member: async (p, u) =>
      p === "p" && members.has(u) ? { projectId: p, userId: u, role: members.get(u) } : null,
    setMemberRole: async (p, u, r) => members.set(u, r),
    activity: async () => [],
    saveAssignment: async () => {},
    appendActivity: async () => {},
  };
  const owner = new CollaborationService(store);
  await owner.changeRole("p", other, "viewer");
  const member = new CollaborationService({ ...store, actorId: other });
  assert.deepEqual(await member.listActivity("p"), []);
  await assert.rejects(member.assign({ projectId: "p", creatorId: other }), /FORBIDDEN/);
  await assert.rejects(member.listActivity("other-project"), /FORBIDDEN/);
  await assert.rejects(member.changeRole("p", other, "owner"), /FORBIDDEN/);
});
test("cross-project execution and forged user are rejected before provider work", async () => {
  const h = await fixture(),
    r = h.request("creative");
  r.task.userId = other;
  await assert.rejects(h.runtime(r).jobs.submit(r), /INVALID_RUNTIME_REQUEST/);
  r.task.userId = actor;
  r.task.projectId = crypto.randomUUID();
  await assert.rejects(h.runtime(r).jobs.submit(r), /ACCESS_DENIED/);
  assert.equal(h.calls.length, 0);
});
test("configured Creative provider adapter calls configured transport with stable idempotency key", async (t) => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        ok: true,
        output: { kind: "video", url: "https://example.test/output.mp4", mimeType: "video/mp4" },
      }),
      { status: 200 },
    );
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  const adapter = new CreativeHttpAdapter({
    endpoint: "https://example.test/provider",
    key: "fixture-only",
    models: [],
  });
  const r = await adapter.execute(
    {
      requestId: "stable-id",
      input: "Authorized bounded input",
      task: "creative.generate",
      mode: "BALANCED",
      capability: "video",
    },
    { providerId: "creative-http", modelId: "video" },
  );
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["Idempotency-Key"], "stable-id");
  assert.equal(calls[0].init.redirect, "error");
});
