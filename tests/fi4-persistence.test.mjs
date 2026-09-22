import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { postgres } from "./helpers/fi3-postgres.mjs";
import { entry, actor as a, other as b } from "./helpers/fi4-fixture.mjs";
const c = "10000000-0000-4000-8000-000000000003";
test("FI4 PostgreSQL marketplace persistence, transactions, RLS and version boundaries", async (t) => {
  const { db, actor, scalar } = await postgres();
  t.after(() => db.close());
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20260922000000_fi4_marketplace.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("INSERT INTO auth.users(id) VALUES ($1),($2),($3)", [a, b, c]);
  await actor(a);
  const project = (await db.query("SELECT * FROM public.xeomx_create_project($1,$2)", ["A", null]))
    .rows[0].id;
  await actor(b);
  const otherProject = (
    await db.query("SELECT * FROM public.xeomx_create_project($1,$2)", ["B", null])
  ).rows[0].id;
  const pub = await entry(),
    priv = await entry({ packageId: "private.research" }, { visibility: "private" }),
    team = await entry(
      { packageId: "team.research" },
      { visibility: "project", scopeProjectId: project },
    );
  async function publish(who, e) {
    await actor(who, true);
    return scalar("SELECT public.xeomx_marketplace_publish($1,$2)", [who, e]);
  }
  await t.test(
    "publish persists immutable version-specific digest and safe public projection",
    async () => {
      for (const e of [pub, priv, team]) await publish(a, e);
      assert.equal(
        await scalar("SELECT digest FROM marketplace_versions WHERE id=$1", [pub.id]),
        pub.manifest.integrity.digest,
      );
    },
  );
  await t.test(
    "guest reads only safe public listing and cannot access package payload, trials or private versions",
    async () => {
      await actor(null);
      const rows = (await db.query("SELECT * FROM marketplace_listings")).rows;
      assert.deepEqual(
        rows.map((r) => r.id),
        [pub.id],
      );
      assert.doesNotMatch(
        JSON.stringify(rows),
        /"payload"|creatorDeclaration|Summarize the supplied data/,
      );
      await assert.rejects(db.query("SELECT entry FROM marketplace_versions"), /permission denied/);
      await assert.rejects(db.query("SELECT * FROM marketplace_trials"), /permission denied/);
    },
  );
  await t.test("authenticated publisher sees private listing; unrelated user cannot", async () => {
    await actor(a);
    assert.equal(await scalar("SELECT count(*)::int FROM marketplace_listings"), 3);
    await actor(b);
    assert.deepEqual(
      (await db.query("SELECT id FROM marketplace_listings")).rows.map((r) => r.id),
      [pub.id],
    );
  });
  await t.test("team ACL allows actual members only and revocation is immediate", async () => {
    await db.exec("RESET ROLE");
    await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)", [
      project,
      c,
      "viewer",
    ]);
    await actor(c);
    assert.equal(
      await scalar("SELECT count(*)::int FROM marketplace_listings WHERE id=$1", [team.id]),
      1,
    );
    await db.exec("RESET ROLE");
    await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [project, c]);
    await actor(c);
    assert.equal(
      await scalar("SELECT count(*)::int FROM marketplace_listings WHERE id=$1", [team.id]),
      0,
    );
  });
  await t.test(
    "clients cannot publish, overwrite package integrity, fabricate trial completion or reviews",
    async () => {
      await actor(a);
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_publish($1,$2)", [a, pub]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("UPDATE marketplace_versions SET digest=$1 WHERE id=$2", ["b".repeat(64), pub.id]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "INSERT INTO marketplace_reviews(user_id,version_id,dimensions,body) VALUES($1,$2,'{}','fake')",
          [a, pub.id],
        ),
        /permission denied/,
      );
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_trial($1,$2,$3)", [a, "claim", {}]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "server publish rejects impostor owner, team boundary and duplicate published version",
    async () => {
      await assert.rejects(publish(b, pub), /INVALID_PUBLICATION/);
      const bad = await entry(
        { packageId: "forbidden.team", creatorId: b },
        { visibility: "project", scopeProjectId: project },
      );
      await assert.rejects(publish(b, bad), /PROJECT_ACCESS_DENIED/);
      await assert.rejects(publish(a, pub), /duplicate key/);
      await actor(a, true);
      await assert.rejects(
        db.query("UPDATE marketplace_versions SET digest=$1 WHERE id=$2", ["b".repeat(64), pub.id]),
        /IMMUTABLE/,
      );
    },
  );
  const record = {
    id: crypto.randomUUID(),
    versionId: pub.id,
    userId: b,
    state: "RUNNING",
    mode: "SAMPLE",
    requestHash: "1".repeat(64),
    createdAt: "2026-09-22T00:00:00.000Z",
  };
  const command = (who, action, r) =>
    scalar("SELECT public.xeomx_marketplace_trial($1,$2,$3)", [who, action, r]);
  await t.test("trial claim is durable and duplicates cannot execute twice", async () => {
    await actor(b, true);
    assert.equal((await command(b, "claim", record)).claimed, true);
    assert.equal((await command(b, "claim", record)).claimed, false);
    await assert.rejects(command(a, "claim", { ...record, userId: a }), /IDEMPOTENCY_CONFLICT/);
    await assert.rejects(
      command(b, "claim", { ...record, requestHash: "2".repeat(64) }),
      /IDEMPOTENCY_CONFLICT/,
    );
  });
  await t.test(
    "private context and private package cannot cross project/user boundaries",
    async () => {
      await actor(b, true);
      await assert.rejects(
        command(b, "claim", {
          ...record,
          id: crypto.randomUUID(),
          projectId: project,
          mode: "PROJECT",
        }),
        /PROJECT_ACCESS_DENIED/,
      );
      await assert.rejects(
        command(b, "claim", { ...record, id: crypto.randomUUID(), versionId: priv.id }),
        /CAPABILITY_UNAVAILABLE/,
      );
    },
  );
  await t.test(
    "only completed exact-version trial enables review and results remain actor-private",
    async () => {
      await actor(b);
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_review($1,$2,$3)", [
          pub.id,
          { usefulness: 5 },
          "Untried",
        ]),
        /NOT_ELIGIBLE/,
      );
      await actor(b, true);
      await command(b, "finish", {
        ...record,
        state: "COMPLETED",
        output: "Actual deterministic integration result",
      });
      await actor(a);
      assert.equal(await scalar("SELECT count(*)::int FROM marketplace_trials"), 0);
      await actor(b);
      assert.equal(await scalar("SELECT count(*)::int FROM marketplace_trials"), 1);
      await scalar("SELECT public.xeomx_marketplace_review($1,$2,$3)", [
        pub.id,
        { usefulness: 4, reliability: 3 },
        "Bounded trial reviewed",
      ]);
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_review($1,$2,$3)", [
          pub.id,
          { usefulness: 9 },
          "Bad rating",
        ]),
        /INVALID_REVIEW/,
      );
    },
  );
  await t.test("publisher self-review denied even after completed trial", async () => {
    const r = { ...record, id: crypto.randomUUID(), userId: a };
    await actor(a, true);
    await command(a, "claim", r);
    await command(a, "finish", { ...r, state: "COMPLETED", output: "Trial output" });
    await actor(a);
    await assert.rejects(
      scalar("SELECT public.xeomx_marketplace_review($1,$2,$3)", [
        pub.id,
        { usefulness: 5 },
        "Self review",
      ]),
      /NOT_ELIGIBLE/,
    );
  });
  await t.test(
    "version-bound permission grants cannot silently expand or cross projects",
    async () => {
      await actor(b);
      await scalar("SELECT public.xeomx_marketplace_grant($1,$2,$3,$4)", [
        pub.id,
        otherProject,
        pub.manifest.integrity.digest,
        pub.manifest.permissions,
      ]);
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_grant($1,$2,$3,$4)", [
          pub.id,
          project,
          pub.manifest.integrity.digest,
          pub.manifest.permissions,
        ]),
        /PROJECT_ACCESS_DENIED/,
      );
      const v2 = await entry({
        version: "1.1.0",
        permissions: [
          ...pub.manifest.permissions,
          { id: "project.read", reason: "Context", risk: "safe_read" },
        ],
      });
      await publish(a, v2);
      await actor(b);
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_grant($1,$2,$3,$4)", [
          v2.id,
          otherProject,
          pub.manifest.integrity.digest,
          pub.manifest.permissions,
        ]),
        /REAPPROVAL_REQUIRED/,
      );
      const grant = await scalar("SELECT record FROM marketplace_permission_grants");
      assert.equal(grant.version, "1.0.0");
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_review($1,$2,$3)", [
          v2.id,
          { usefulness: 4 },
          "Other version",
        ]),
        /NOT_ELIGIBLE/,
      );
    },
  );
  await t.test(
    "guest may read actual active review dimensions but cannot write reviews",
    async () => {
      await actor(null);
      const rows = (await db.query("SELECT dimensions,body FROM marketplace_reviews")).rows;
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0].dimensions, { usefulness: 4, reliability: 3 });
      await assert.rejects(
        scalar("SELECT public.xeomx_marketplace_review($1,$2,$3)", [
          pub.id,
          { usefulness: 5 },
          "Guest",
        ]),
        /permission denied/,
      );
    },
  );
});
