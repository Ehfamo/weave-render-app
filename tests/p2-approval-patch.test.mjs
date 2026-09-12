import test from "node:test";
import assert from "node:assert/strict";
import { DurableApprovalAuthority } from "../src/lib/agents/durable-approval.ts";
import { AuthorizedPatchExecutor } from "../src/lib/agents/patch-executor.ts";

const ids = {
  userId: "u1",
  projectId: "p1",
  taskId: "t1",
  executionId: "e1",
  stepId: "s1",
  toolId: "code.patch",
  approvalId: "a1",
};
function approvalAdapter() {
  const rows = new Map(),
    states = new Map([["t1:e1", "waiting_approval"]]);
  return {
    rows,
    states,
    createExact: async (r) => {
      if (rows.has(r.id)) return rows.get(r.id);
      rows.set(r.id, r);
      return r;
    },
    decideExact: async (d, a) => {
      const r = rows.get(d.requestId);
      if (!r || r.projectId !== a.projectId || a.userId !== "owner") throw Error("DENIED");
      if (r.status !== "pending") return r;
      const n = { ...r, status: d.decision, decidedBy: a.userId, decidedAt: "now" };
      rows.set(r.id, n);
      states.set(`${r.taskId}:${r.executionId}`, d.decision === "approved" ? "queued" : "failed");
      return n;
    },
    consumeApproved: async (i) => {
      const r = rows.get(i.approvalId);
      if (
        !r ||
        r.status !== "approved" ||
        r.consumedAt ||
        r.taskId !== i.taskId ||
        r.executionId !== i.executionId ||
        r.stepId !== i.stepId ||
        r.toolId !== i.toolId ||
        r.projectId !== i.projectId ||
        r.expiresAt < i.now
      )
        return null;
      const n = { ...r, consumedAt: i.now };
      rows.set(r.id, n);
      return n;
    },
    taskState: async (t, e) => states.get(`${t}:${e}`) ?? null,
  };
}
async function requested() {
  const a = approvalAdapter(),
    svc = new DurableApprovalAuthority(a, () => "2026-09-12T00:00:00Z");
  await svc.request({
    id: "a1",
    ...ids,
    requestedBy: "u1",
    risk: "LOW_RISK_WRITE",
    expiresAt: "2026-09-13T00:00:00Z",
  });
  return { a, svc };
}
test("durable risky approval resumes exactly once and audits actor", async () => {
  const { a, svc } = await requested();
  await svc.decide(
    { requestId: "a1", decision: "approved", decidedBy: "owner" },
    { userId: "owner", projectId: "p1" },
  );
  const x = await svc.authorizeContinuation({ ...ids });
  assert.equal(x.decidedBy, "owner");
  await assert.rejects(() => svc.authorizeContinuation({ ...ids }), /CONSUMED/);
  assert.ok(a.rows.get("a1").consumedAt);
});
test("wrong actor/project, rejection, cancellation and expiry fail closed", async () => {
  for (const actor of [
    { userId: "bad", projectId: "p1" },
    { userId: "owner", projectId: "bad" },
  ]) {
    const { svc } = await requested();
    await assert.rejects(() =>
      svc.decide({ requestId: "a1", decision: "approved", decidedBy: actor.userId }, actor),
    );
  }
  const x = await requested();
  await x.svc.decide(
    { requestId: "a1", decision: "rejected", decidedBy: "owner" },
    { userId: "owner", projectId: "p1" },
  );
  await assert.rejects(() => x.svc.authorizeContinuation({ ...ids }), /NOT_RESUMABLE/);
  const y = await requested();
  y.a.states.set("t1:e1", "cancelled");
  await assert.rejects(() => y.svc.authorizeContinuation({ ...ids }), /CANCELLED/);
  const z = await requested();
  await z.svc.decide(
    { requestId: "a1", decision: "approved", decidedBy: "owner" },
    { userId: "owner", projectId: "p1" },
  );
  z.a.rows.set("a1", { ...z.a.rows.get("a1"), expiresAt: "2026-09-11T00:00:00Z" });
  await assert.rejects(() => z.svc.authorizeContinuation({ ...ids }), /INVALID_EXPIRED/);
});

test("duplicate approval decision is idempotent", async () => {
  const { svc } = await requested();
  const decision = { requestId: "a1", decision: "approved", decidedBy: "owner" };
  const actor = { userId: "owner", projectId: "p1" };
  assert.deepEqual(await svc.decide(decision, actor), await svc.decide(decision, actor));
});
function patchHarness() {
  const files = new Map([["src/a.ts", "old"]]),
    writes = [];
  const workspace = {
    authorize: async (x) =>
      x.userId === "u1" && x.projectId === "p1" ? { rootId: "root", allowedPaths: ["src/"] } : null,
    readText: async (_, p) => files.get(p),
    writeText: async (_, p, c) => {
      writes.push(p);
      files.set(p, c);
    },
  };
  const validator = {
    allowedCommandIds: ["typecheck"],
    run: async (_, id) => ({ ok: true, summary: id }),
  };
  return { files, writes, executor: new AuthorizedPatchExecutor(workspace, validator) };
}
const proposal = (path = "src/a.ts") => ({
  id: "pp1",
  taskId: "t1",
  executionId: "e1",
  projectId: "p1",
  workspaceId: "w1",
  changes: [{ path, before: "old", after: "new" }],
  validationCommandIds: ["typecheck"],
});
test("proposal alone does not write; approved exact proposal writes and validates", async () => {
  const h = patchHarness(),
    p = proposal();
  assert.equal(h.writes.length, 0);
  const r = await h.executor.execute({
    proposal: p,
    userId: "u1",
    approvedTaskId: "t1",
    approvedExecutionId: "e1",
    approvedProposalId: "pp1",
  });
  assert.deepEqual(r.changedFiles, ["src/a.ts"]);
  assert.equal(r.validations[0].commandId, "typecheck");
  assert.equal(h.files.get("src/a.ts"), "new");
});
test("patch blocks approval mismatch unauthorized traversal secrets malformed state and shell strings", async () => {
  const bad = [
    { p: proposal("../x"), e: /INVALID_PATCH/ },
    { p: proposal(".env"), e: /INVALID_PATCH/ },
    {
      p: { ...proposal(), changes: [{ path: "src/a.ts", before: "old", after: "old" }] },
      e: /INVALID_PATCH/,
    },
    { p: { ...proposal(), validationCommandIds: ["npm test; rm -rf /"] }, e: /ALLOWLISTED/ },
  ];
  for (const b of bad)
    await assert.rejects(
      () =>
        patchHarness().executor.execute({
          proposal: b.p,
          userId: "u1",
          approvedTaskId: "t1",
          approvedExecutionId: "e1",
          approvedProposalId: "pp1",
        }),
      b.e,
    );
  await assert.rejects(
    () =>
      patchHarness().executor.execute({
        proposal: proposal(),
        userId: "bad",
        approvedTaskId: "t1",
        approvedExecutionId: "e1",
        approvedProposalId: "pp1",
      }),
    /ACCESS/,
  );
  await assert.rejects(
    () =>
      patchHarness().executor.execute({
        proposal: proposal(),
        userId: "u1",
        approvedTaskId: "other",
        approvedExecutionId: "e1",
        approvedProposalId: "pp1",
      }),
    /MISMATCH/,
  );
});
