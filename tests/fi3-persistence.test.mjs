import test from "node:test";
import assert from "node:assert/strict";
import { postgres } from "./helpers/fi3-postgres.mjs";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
test("FI3 canonical PostgreSQL job / approval / artifact transactions and isolation", async (t) => {
  const { db, actor, scalar } = await postgres();
  t.after(() => db.close());
  await db.query("INSERT INTO auth.users(id) VALUES ($1),($2)", [a, b]);
  await actor(a);
  const project = (await db.query("SELECT * FROM public.xeomx_create_project($1,$2)", ["A", null]))
    .rows[0].id;
  await actor(b);
  const other = (await db.query("SELECT * FROM public.xeomx_create_project($1,$2)", ["B", null]))
    .rows[0].id;
  const id = crypto.randomUUID(),
    key = crypto.randomUUID(),
    lease = crypto.randomUUID();
  const request = {
    task: {
      id,
      userId: a,
      projectId: project,
      goal: "Real work",
      createdAt: new Date().toISOString(),
    },
    capability: { kind: "business", agentId: "marketing" },
    idempotencyKey: key,
  };
  const command = (who, action, job = id, data = {}) =>
    scalar("SELECT public.xeomx_runtime_command($1,$2,$3,$4)", [who, action, job, data]);
  await t.test("authenticated callers cannot fabricate runtime completion", async () => {
    await actor(a);
    await assert.rejects(
      command(a, "submit", id, { request, hash: "a".repeat(64) }),
      /permission denied/,
    );
  });
  await actor(a, true);
  await t.test(
    "submit survives repeated request and authorizes actor, project and conversation",
    async () => {
      const first = await command(a, "submit", id, { request, hash: "a".repeat(64) });
      assert.equal(first.state, "queued");
      assert.equal((await command(a, "submit", id, { request, hash: "a".repeat(64) })).id, id);
      assert.equal(
        await scalar("SELECT count(*)::int FROM public.conversations WHERE id=$1", [id]),
        1,
      );
      await assert.rejects(command(b, "get"), /ACCESS_DENIED/);
      await assert.rejects(
        command(a, "submit", crypto.randomUUID(), {
          request: { ...request, task: { ...request.task, projectId: other } },
          hash: "a".repeat(64),
        }),
        /ACCESS_DENIED/,
      );
    },
  );
  await t.test("one durable claim and bound checkpoint", async () => {
    assert.equal((await command(a, "claim", id, { lease })).state, "running");
    assert.equal(await command(a, "claim", id, { lease: crypto.randomUUID() }), null);
    await command(a, "checkpoint", id, {
      lease,
      checkpoint: {
        context: { task: request.task },
        plan: { steps: [] },
        completedStepIds: ["prior"],
        outputs: [],
      },
    });
    await assert.rejects(
      command(a, "checkpoint", id, { lease: "bad", checkpoint: {} }),
      /LEASE_LOST/,
    );
  });
  const approvalId = `${id}:publish:external.action`,
    binding = {
      id: approvalId,
      taskId: id,
      executionId: id,
      projectId: project,
      requestedBy: a,
      stepId: "publish",
      toolId: "external.action",
      risk: "EXTERNAL_ACTION",
    };
  await t.test(
    "approval exact binding, owner decision, duplicate callback, one consume",
    async () => {
      await command(a, "request_approval", id, binding);
      await command(a, "finish", id, {
        lease,
        execution: { trace: { status: "waiting_approval" } },
      });
      await assert.rejects(
        command(b, "decide", id, { approvalId, decision: "approved" }),
        /ACCESS_DENIED/,
      );
      assert.equal(
        (await command(a, "decide", id, { approvalId, decision: "approved" })).state,
        "queued",
      );
      assert.equal(
        (await command(a, "decide", id, { approvalId, decision: "approved" })).state,
        "queued",
      );
      await command(a, "claim", id, { lease });
      await assert.rejects(
        command(a, "consume", id, { ...binding, approvalId, toolId: "wrong" }),
        /INVALID_EXPIRED_OR_CONSUMED/,
      );
      assert.equal(
        (await command(a, "consume", id, { ...binding, approvalId })).status,
        "approved",
      );
      await assert.rejects(
        command(a, "consume", id, { ...binding, approvalId }),
        /INVALID_EXPIRED_OR_CONSUMED/,
      );
    },
  );
  let asset;
  await t.test(
    "completed output persists in assets/messages and activity, with no fictional provider",
    async () => {
      const done = await command(a, "finish", id, {
        lease,
        execution: {
          trace: { status: "completed" },
          result: {
            summary: "Accepted real result",
            data: { output: {}, quality: { confidence: "NOT_INDEPENDENTLY_VERIFIED" } },
          },
        },
      });
      assert.equal(done.state, "succeeded");
      asset = done.runtime_data.artifactIds[0];
      assert.ok(asset);
      assert.equal(
        await scalar("SELECT content FROM public.messages WHERE conversation_id=$1 AND role=$2", [
          id,
          "assistant",
        ]),
        "Accepted real result",
      );
      assert.equal(
        await scalar("SELECT controlled_run_id FROM public.assets WHERE id=$1", [asset]),
        id,
      );
      assert.ok(
        await scalar(
          "SELECT count(*)::int FROM public.project_collaboration_activity WHERE subject_id=$1",
          [id],
        ),
      );
    },
  );
  await t.test("cross-user and project artifact/job RLS is fail-closed", async () => {
    await actor(b);
    assert.equal(await scalar("SELECT count(*)::int FROM public.assets WHERE id=$1", [asset]), 0);
    assert.equal(
      await scalar("SELECT count(*)::int FROM public.controlled_runs WHERE id=$1", [id]),
      0,
    );
    await actor(a);
    assert.equal(await scalar("SELECT count(*)::int FROM public.assets WHERE id=$1", [asset]), 1);
  });
  await t.test(
    "real continuation references the persisted job conversation through FI1",
    async () => {
      await actor(a);
      const next = crypto.randomUUID();
      const result = await scalar("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)", [
        project,
        next,
        id,
        "Keep the result, change its title",
        crypto.randomUUID(),
        "c".repeat(64),
      ]);
      assert.equal(result.created, true);
      await assert.rejects(
        scalar("SELECT public.xeomx_begin_core_execution($1,$2,$3,$4,$5,$6)", [
          other,
          crypto.randomUUID(),
          id,
          "Wrong project",
          crypto.randomUUID(),
          "c".repeat(64),
        ]),
        /ACCESS_DENIED/,
      );
    },
  );
  await t.test(
    "Collaboration RLS denies another project even when the actor owns a different project",
    async () => {
      await actor(b);
      assert.equal(
        await scalar(
          "SELECT count(*)::int FROM public.project_collaboration_activity WHERE project_id=$1",
          [project],
        ),
        0,
      );
      await assert.rejects(
        db.query(
          "INSERT INTO public.project_collaboration_comments(project_id,author_id,subject_id,body) VALUES ($1,$2,'x','forbidden')",
          [project, b],
        ),
        /row-level security/,
      );
    },
  );
  await t.test("role mutation is durable and viewer cannot submit or claim execution", async () => {
    await actor(a);
    await db.query(
      "INSERT INTO public.project_members(project_id,user_id,role) VALUES ($1,$2,'editor')",
      [project, b],
    );
    await db.query(
      "UPDATE public.project_members SET role='viewer' WHERE project_id=$1 AND user_id=$2",
      [project, b],
    );
    await actor(b);
    assert.equal(await scalar("SELECT public.xeomx_project_role($1)", [project]), "viewer");
    await actor(b, true);
    const next = crypto.randomUUID();
    await assert.rejects(
      command(b, "submit", next, {
        request: {
          ...request,
          idempotencyKey: next,
          task: { ...request.task, id: next, userId: b },
        },
        hash: "d".repeat(64),
      }),
      /ACCESS_DENIED/,
    );
  });
  await t.test(
    "durable rejection, cancellation and uncertain-action retries fail closed",
    async () => {
      await actor(a, true);
      for (const decision of ["rejected", "cancel"]) {
        const next = crypto.randomUUID(),
          k = `${next}:step:tool`;
        await command(a, "submit", next, {
          request: { ...request, idempotencyKey: next, task: { ...request.task, id: next } },
          hash: "e".repeat(64),
        });
        await command(a, "claim", next, { lease });
        await command(a, "request_approval", next, {
          ...binding,
          id: k,
          taskId: next,
          executionId: next,
        });
        await command(a, "finish", next, {
          lease,
          execution: { trace: { status: "waiting_approval" } },
        });
        const final =
          decision === "cancel"
            ? await command(a, "cancel", next)
            : await command(a, "decide", next, { approvalId: k, decision });
        assert.equal(final.state, "cancelled");
        assert.equal(await command(a, "claim", next, { lease }), null);
        assert.equal(
          await scalar("SELECT count(*)::int FROM public.assets WHERE controlled_run_id=$1", [
            next,
          ]),
          0,
        );
      }
      const next = crypto.randomUUID();
      await command(a, "submit", next, {
        request: { ...request, idempotencyKey: next, task: { ...request.task, id: next } },
        hash: "f".repeat(64),
      });
      await command(a, "claim", next, { lease });
      await command(a, "checkpoint", next, {
        lease,
        checkpoint: {
          context: { task: { ...request.task, id: next } },
          plan: { steps: [] },
          completedStepIds: [],
          outputs: [],
          inFlight: { stepId: "action", consequential: true },
        },
      });
      await assert.rejects(command(a, "recover", next), /LEASE_NOT_EXPIRED/);
      await db.query(
        "UPDATE public.controlled_runs SET started_at=now()-interval '10 minutes' WHERE id=$1",
        [next],
      );
      assert.equal((await command(a, "recover", next)).failure_code, "ACTION_OUTCOME_UNKNOWN");
      await assert.rejects(command(a, "retry", next), /RETRY_NOT_SAFE/);
    },
  );
});
