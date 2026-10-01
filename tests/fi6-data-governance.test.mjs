import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixture, publisher as owner, buyer as member, stranger } from "./helpers/fi6-fixture.mjs";
import { MemoryService } from "../src/lib/memory/service.ts";
import { NativeMemoryAdapter } from "../src/lib/memory/native-adapter.ts";
import { redactExport } from "../src/lib/governance/service.ts";
import { enforceIdentitySession } from "../src/lib/governance/identity.ts";
import { connectorAuthority } from "../src/lib/governance/connectors.ts";
import { N8nIntegrationBoundary } from "../src/lib/automation/integrations.ts";
test("FI6 identity remains unconfigured without verified server evidence", () => {
  assert.throws(() => enforceIdentitySession(undefined, "w"), /NOT_CONFIGURED/);
  for (const override of [
    { signatureVerified: false },
    { domainVerified: false },
    { issuerVerified: false },
    { workspaceId: "other" },
    { expiresAt: "invalid" },
  ])
    assert.throws(
      () =>
        enforceIdentitySession(
          {
            protocol: "OIDC",
            workspaceId: "w",
            subject: "u",
            domainVerified: true,
            signatureVerified: true,
            issuerVerified: true,
            expiresAt: "2999-01-01",
            ...override,
          },
          "w",
        ),
      /NOT_VERIFIED/,
    );
});
test("FI6 export redacts recognizable credentials without masking ordinary content", () => {
  const exported = redactExport({
    credential_ref: "never",
    text: "campaign; api_key=private-value; password=another-value",
    nested: { access_token: "private", goal: "Continue campaign" },
  });
  assert.equal(exported.text, "campaign; api_key=[REDACTED]; password=[REDACTED]");
  assert.deepEqual(exported.nested, { goal: "Continue campaign" });
  assert.equal(exported.credential_ref, undefined);
});
test("FI6 connector boundary checks scopes again after approval; no ungoverned dispatch", async () => {
  let consumed = 0,
    checked = 0,
    called = 0;
  const adapter = {
    id: "n8n",
    configured: true,
    dispatch: async () => {
      called++;
      return { externalRunId: "test-only" };
    },
  };
  const service = {
    command: async () => {
      checked++;
      if (consumed) throw Error("REVOKED");
      return { allowed: true };
    },
  };
  const binding = {
    projectId: "project",
    connectorId: "connector",
    scope: "event.send",
    host: "safe.test",
  };
  const boundary = new N8nIntegrationBoundary(
    adapter,
    connectorAuthority(service, binding, {
      consume: async () => {
        consumed++;
      },
    }),
  );
  await assert.rejects(boundary.dispatch({ projectId: "project" }), /REVOKED/);
  assert.equal(called, 0);
  assert.equal(checked, 2);
  await assert.rejects(
    new N8nIntegrationBoundary(adapter).dispatch({ projectId: "project" }),
    /GOVERNANCE_REQUIRED/,
  );
  await assert.rejects(boundary.dispatch({ projectId: "other" }), /SCOPE_DENIED/);
});
test("FI6 PostgreSQL exports, Memory policy, connectors and enterprise acquisition isolation", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  await f.db.exec("RESET ROLE");
  for (const file of [
    "20261001064853_fi6_runtime_governance.sql",
    "20261001065737_fi6_data_and_identity_boundaries.sql",
  ])
    await f.db.exec(
      await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"),
    );
  const g = f.governance(owner),
    p = f.projects[owner],
    w = await g.command("create", { name: "Governed data" });
  await g.command("attach", { workspaceId: w.id, projectId: p });
  await g.command("member", { workspaceId: w.id, userId: member, role: "editor" });
  await f.db.exec("RESET ROLE");
  await f.db.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'editor')", [
    p,
    member,
  ]);
  const conversation = crypto.randomUUID(),
    otherConversation = crypto.randomUUID();
  await f.db.query(
    "INSERT INTO conversations(id,project_id,created_by,title) VALUES($1,$3,$4,'Own'),($2,$3,$5,'Private colleague')",
    [conversation, otherConversation, p, owner, member],
  );
  await f.db.query(
    "INSERT INTO messages(project_id,conversation_id,author_id,role,content) VALUES($1,$2,$4,'user','Own content'),($1,$3,$5,'user','Colleague private content')",
    [p, conversation, otherConversation, owner, member],
  );
  await t.test(
    "bounded export contains only actor conversations, other project/workspace denied",
    async () => {
      const result = await g.command("export", { projectId: p, kind: "conversations", limit: 1 });
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].content, "Own content");
      assert.equal(result.nextOffset, 1);
      assert.deepEqual(
        (await g.command("export", { projectId: p, kind: "conversations", offset: 1 })).rows,
        [],
      );
      await assert.rejects(
        f.governance(stranger).command("export", { projectId: p, kind: "conversations" }),
        /ACCESS_DENIED/,
      );
      await assert.rejects(
        g.command("export", {
          projectId: f.projects[stranger],
          workspaceId: w.id,
          kind: "project",
        }),
        /ACCESS_DENIED/,
      );
      await assert.rejects(
        g.command("export", { projectId: p, kind: "conversations", limit: 101 }),
        /INVALID_INPUT/,
      );
    },
  );
  await t.test(
    "audit requires project ownership, raw checkpoint and credential fields excluded",
    async () => {
      await assert.rejects(
        f.governance(member).command("audit", { projectId: p }),
        /AUDIT_ACCESS_DENIED/,
      );
      const r = await g.command("audit", { projectId: p });
      assert.ok(r.rows.length > 0);
      assert.ok(
        r.rows.every((x) => !Object.hasOwn(x, "metadata") && !Object.hasOwn(x, "policy_context")),
      );
      assert.deepEqual((await g.command("export", { projectId: p, kind: "agents" })).rows, []);
    },
  );
  await t.test(
    "deny inheritance blocks export and unsupported data guarantees stay UNKNOWN",
    async () => {
      await g.command("policy", { workspaceId: w.id, policy: { deny: { export: ["memory"] } } });
      await assert.rejects(g.command("export", { projectId: p, kind: "memory" }), /EXPORT_BLOCKED/);
      assert.equal(
        (await g.command("data_controls", { projectId: p })).retentionEnforcement,
        "NOT_CONFIGURED",
      );
      assert.equal((await g.command("identity", { workspaceId: w.id })).OIDC, "NOT_CONFIGURED");
      await assert.rejects(
        f.governance(member).command("identity_configure", {
          workspaceId: w.id,
          protocol: "OIDC",
          domain: "example.test",
        }),
        /OWNER_REQUIRED/,
      );
      assert.equal(
        (
          await g.command("identity_configure", {
            workspaceId: w.id,
            protocol: "OIDC",
            domain: "example.test",
          })
        ).state,
        "NOT_CONFIGURED",
      );
    },
  );
  await t.test(
    "Memory policy suppresses automatic retrieval/write but preserves inspection and Brain",
    async () => {
      const client = {
        rpc: async (name, args) => {
          await f.actor(owner);
          try {
            return {
              data: await f.scalar("SELECT xeomx_memory($1,$2)", [args.operation, args.payload]),
              error: null,
            };
          } catch (e) {
            return { error: e };
          }
        },
      };
      const m = new MemoryService(
        new NativeMemoryAdapter(owner, client),
        async (op, scope, type) => {
          if (scope.kind === "user") return true;
          await f.actor(owner);
          return f.scalar("SELECT xeomx_memory_governance($1,$2,$3)", [scope.projectId, op, type]);
        },
      );
      await m.setSettings({ enabled: true, disabledTypes: [] });
      const draft = {
        type: "ProjectMemory",
        scope: { kind: "project", projectId: p },
        content: "Remember campaign",
        importance: 0.8,
        source: { kind: "user" },
      };
      const saved = await m.create(draft);
      assert.equal((await m.relevant({ scope: draft.scope })).length, 1);
      await g.command("policy", { projectId: p, policy: { deny: { memory: ["read", "write"] } } });
      assert.deepEqual(await m.relevant({ scope: draft.scope }), []);
      await assert.rejects(m.create(draft), /MEMORY_DISABLED/);
      assert.equal((await m.get(saved.id)).content, draft.content);
      await f.actor(owner);
      await f.scalar("SELECT xeomx_put_project_brain($1,$2,$3)", [
        p,
        [{ id: "goal", kind: "goal", text: "Durable independent goal", resolved: false }],
        [],
      ]);
      assert.match(
        JSON.stringify((await g.command("export", { projectId: p, kind: "project" })).rows),
        /Durable independent goal/,
      );
      await f.actor(owner);
      await assert.rejects(
        f.scalar("SELECT xeomx_memory('create',$1)", [draft]),
        /MEMORY_DISABLED_BY_POLICY/,
      );
    },
  );
  await t.test(
    "connector scopes, revoke, ownership and no raw credential/ref exposure",
    async () => {
      await g.command("policy", { projectId: p, policy: { allow: { network: ["safe.test"] } } });
      const input = {
        projectId: p,
        name: "n8n connector",
        provider: "n8n",
        credentialRef: "cred_reference_only",
        scopes: ["event.send"],
        hosts: ["safe.test"],
      };
      await assert.rejects(f.governance(member).command("connector", input), /OWNER_REQUIRED/);
      await assert.rejects(
        g.command("connector", { ...input, hosts: ["other.test"] }),
        /INVALID_CONNECTOR_SCOPE/,
      );
      const created = await g.command("connector", input);
      const listed = await g.command("connectors", { projectId: p });
      assert.equal(listed[0].health, "NOT_CONFIGURED");
      assert.equal(listed[0].credential_ref, undefined);
      const binding = {
        projectId: p,
        connectorId: created.id,
        scope: "event.send",
        host: "safe.test",
      };
      assert.equal((await g.command("connector_check", binding)).allowed, true);
      await assert.rejects(
        g.command("connector_check", { ...binding, scope: "admin" }),
        /SCOPE_DENIED/,
      );
      await assert.rejects(
        f.governance(stranger).command("connector_check", binding),
        /ACCESS_DENIED/,
      );
      await g.command("connector_revoke", binding);
      await assert.rejects(g.command("connector_check", binding), /SCOPE_DENIED/);
      await f.actor(owner);
      await assert.rejects(
        f.db.query("SELECT credential_ref FROM project_connectors"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "FI5 acquisition cannot bypass inherited Marketplace denial or approval",
    async () => {
      const pub = await f.publication(0),
        buyerGov = f.governance(member),
        buyerProject = f.projects[member];
      const team = await buyerGov.command("create", { name: "Buyer workspace" });
      await buyerGov.command("attach", { workspaceId: team.id, projectId: buyerProject });
      await buyerGov.command("policy", {
        workspaceId: team.id,
        policy: { deny: { marketplace: [pub.e.manifest.packageId] } },
      });
      await assert.rejects(f.acquire(pub), /GOVERNANCE_BLOCKED/);
      await buyerGov.command("policy", { workspaceId: team.id, policy: { requireApproval: true } });
      const acquisition = await f.acquire(pub);
      assert.equal(acquisition.phase, "WAITING_APPROVAL");
      await f.actor(member, true);
      assert.equal(
        await f.scalar("SELECT status FROM billing_entitlements WHERE id=$1", [
          acquisition.entitlement_id,
        ]),
        "pending",
      );
    },
  );
});
