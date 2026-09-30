import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  publisher as owner,
  buyer as admin,
  stranger as outsider,
} from "./helpers/fi6-fixture.mjs";
import { effectivePolicy, policyAllows, validatePolicy } from "../src/lib/governance/policy.ts";
test("FI6 policy inheritance is bounded, deterministic and deny wins", () => {
  const p = effectivePolicy(
    { allow: { models: ["a", "b"] }, limits: { dailyMinor: 100 }, requireApproval: true },
    {
      allow: { models: ["b", "c"] },
      deny: { models: ["b"] },
      limits: { dailyMinor: 200 },
      requireApproval: false,
    },
  );
  assert.deepEqual(p.allow.models, ["b"]);
  assert.equal(p.limits.dailyMinor, 100);
  assert.equal(p.requireApproval, true);
  assert.equal(policyAllows(p, "models", "a"), false);
  assert.equal(policyAllows(p, "models", "b"), false);
  assert.equal(policyAllows(p, "models", "c"), false);
  assert.equal(
    policyAllows(effectivePolicy({ allow: { network: [] } }, {}), "network", "example.test"),
    false,
  );
  assert.equal(
    policyAllows(effectivePolicy({}, { deny: { tools: ["*"] } }), "tools", "any"),
    false,
  );
  for (const p of [
    { allow: { bogus: ["x"] } },
    { limits: { dailyMinor: -1 } },
    { requireApproval: "false" },
    { allow: { models: "all" } },
    { override: true },
  ])
    assert.throws(() => validatePolicy(p));
});
test("FI6 workspace authority and project isolation use canonical PostgreSQL membership", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  const o = f.governance(owner),
    a = f.governance(admin),
    x = f.governance(outsider);
  const w = await o.command("create", { name: "Governed workspace" });
  await t.test("owner creates workspace, unrelated actor cannot inspect or mutate", async () => {
    assert.equal((await o.command("list")).length, 1);
    assert.equal((await x.command("list")).length, 0);
    await assert.rejects(x.command("snapshot", { workspaceId: w.id }), /ACCESS_DENIED/);
    await assert.rejects(
      x.command("member", { workspaceId: w.id, userId: outsider, role: "admin" }),
      /ACCESS_DENIED/,
    );
  });
  await t.test("admin role is canonical but cannot promote self or mutate owner", async () => {
    await o.command("member", { workspaceId: w.id, userId: admin, role: "admin" });
    await assert.rejects(
      a.command("member", { workspaceId: w.id, userId: outsider, role: "admin" }),
      /ROLE_ESCALATION/,
    );
    await assert.rejects(
      a.command("member", { workspaceId: w.id, userId: owner, role: "viewer" }),
      /MEMBERSHIP_DENIED/,
    );
    await assert.rejects(a.command("policy", { workspaceId: w.id, policy: {} }), /OWNER_REQUIRED/);
    await a.command("member", { workspaceId: w.id, userId: outsider, role: "viewer" });
    await assert.rejects(
      x.command("member", { workspaceId: w.id, userId: outsider, role: "admin" }),
      /MEMBERSHIP_DENIED/,
    );
  });
  await t.test(
    "attach requires actual workspace and project ownership; no tenant reparenting",
    async () => {
      await assert.rejects(
        a.command("attach", { workspaceId: w.id, projectId: f.projects[admin] }),
        /OWNER_REQUIRED/,
      );
      await o.command("attach", { workspaceId: w.id, projectId: f.projects[owner] });
      await assert.rejects(
        o.command("attach", { workspaceId: w.id, projectId: f.projects[owner] }),
        /OWNER_REQUIRED/,
      );
      await assert.rejects(
        x.command("snapshot", { projectId: f.projects[owner] }),
        /PROJECT_ACCESS_DENIED/,
      );
    },
  );
  await t.test(
    "parent restrictions remain effective over more permissive project policy",
    async () => {
      await o.command("policy", {
        workspaceId: w.id,
        policy: { deny: { providers: ["blocked"] }, limits: { runMinor: 10 } },
      });
      await o.command("policy", {
        projectId: f.projects[owner],
        policy: { allow: { providers: ["blocked", "ok"] }, limits: { runMinor: 100 } },
      });
      const p = await o.policy(f.projects[owner]);
      assert.equal(p.limits.runMinor, 10);
      assert.equal(policyAllows(p, "providers", "blocked"), false);
      await f.db.exec("RESET ROLE");
      assert.equal(
        await f.scalar("SELECT private.fi6_allowed($1,$2,'providers','blocked')", [
          owner,
          f.projects[owner],
        ]),
        false,
      );
    },
  );
  await t.test(
    "membership revocation removes project access even with existing project membership",
    async () => {
      await f.db.exec("RESET ROLE");
      await f.db.query(
        "INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'editor')",
        [f.projects[owner], outsider],
      );
      assert.equal(
        (await x.command("snapshot", { projectId: f.projects[owner] })).workspaceId,
        w.id,
      );
      await o.command("member", {
        workspaceId: w.id,
        userId: outsider,
        role: "viewer",
        active: false,
      });
      await assert.rejects(
        x.command("snapshot", { projectId: f.projects[owner] }),
        /PROJECT_ACCESS_DENIED/,
      );
      await f.actor(outsider);
      assert.equal(
        await f.scalar("SELECT count(*)::int FROM projects WHERE id=$1", [f.projects[owner]]),
        0,
      );
    },
  );
  await t.test(
    "direct database mutations are denied and transitions use existing audit",
    async () => {
      await f.actor(admin);
      await assert.rejects(f.db.query("UPDATE workspaces SET policy='{}' WHERE id=$1", [w.id]));
      await f.actor(owner);
      await assert.rejects(
        f.db.query("UPDATE projects SET governance_policy='{}' WHERE id=$1", [f.projects[owner]]),
        /GOVERNANCE_SERVER_REQUIRED|permission denied for table projects/,
      );
      await f.db.exec("RESET ROLE");
      assert.ok(
        (await f.scalar(
          "SELECT count(*)::int FROM audit_events WHERE event_type LIKE 'governance.%'",
        )) >= 6,
      );
    },
  );
});
