import test from "node:test";
import assert from "node:assert/strict";
import { fixture, publisher as c, buyer as b, stranger as x } from "./helpers/fi5-fixture.mjs";
test("FI5 persisted commerce isolation and provider settlement invariants", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  const { db, actor, scalar, call, projects } = f;
  const s = await f.settled();
  let payout;
  await t.test("all new financial tables have RLS and clients cannot mutate", async () => {
    await actor(b);
    for (const table of [
      "marketplace_publishers",
      "marketplace_drafts",
      "marketplace_prices",
      "marketplace_acquisitions",
      "marketplace_adjustments",
      "marketplace_earnings",
      "marketplace_payouts",
      "marketplace_payout_items",
      "marketplace_settlement_receipts",
      "marketplace_enterprise_policies",
    ]) {
      assert.equal(
        await scalar("SELECT relrowsecurity FROM pg_class WHERE relname=$1", [table]),
        true,
      );
      assert.equal(
        await scalar("SELECT has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE')", [
          table,
        ]),
        false,
      );
    }
  });
  await t.test("RPC financial mutations reject caller-supplied actor from browser", async () => {
    await actor(x);
    await assert.rejects(
      scalar("SELECT xeomx_marketplace_commerce($1,$2,$3)", [c, "dashboard", {}]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("UPDATE billing_entitlements SET status='active'"),
      /permission denied/,
    );
  });
  await t.test(
    "transaction, entitlement, earnings, private draft and policy RLS prevents IDOR",
    async () => {
      await call(b, "policy", { project_id: projects[b], policy: { admin_approval: true } });
      await actor(x);
      for (const table of [
        "marketplace_acquisitions",
        "billing_checkout_intents",
        "billing_entitlements",
        "marketplace_earnings",
        "marketplace_drafts",
        "marketplace_enterprise_policies",
      ])
        assert.equal(await scalar("SELECT count(*)::int FROM " + table), 0);
      await actor(c);
      assert.equal(await scalar("SELECT count(*)::int FROM marketplace_earnings"), 1);
      assert.equal(await scalar("SELECT count(*)::int FROM marketplace_acquisitions"), 0);
    },
  );
  await t.test("immutable version, price, acquired license and accounting snapshots", async () => {
    await db.exec("RESET ROLE");
    for (const sql of [
      "UPDATE marketplace_versions SET digest=repeat('a',64)",
      "UPDATE marketplace_prices SET snapshot='{}'",
      "UPDATE marketplace_acquisitions SET license='{}'",
      "UPDATE marketplace_earnings SET creator_net=0,platform_fee=gross",
      "DELETE FROM marketplace_acquisitions",
    ]) {
      await assert.rejects(db.exec(sql), /IMMUTABLE/);
    }
  });
  await t.test("client cannot make free exception for a paid transaction", async () => {
    await db.exec("RESET ROLE");
    await assert.rejects(
      db.query(
        "UPDATE billing_entitlements SET marketplace_free=true WHERE checkout_intent_id=$1",
        [s.a.id],
      ),
      /AUTHORITATIVE_FREE/,
    );
  });
  await t.test("approval retry and conflicting decisions are idempotent", async () => {
    const p = await f.publication();
    const a = await f.acquire(p);
    await f.approve(b, a.approval_id);
    await f.approve(b, a.approval_id);
    await assert.rejects(
      call(b, "approve", { id: a.approval_id, decision: "denied" }),
      /ALREADY_DECIDED/,
    );
    const first = await call(b, "resume", { id: a.id });
    const second = await call(b, "resume", { id: a.id });
    assert.equal(first.id, second.id);
    assert.equal(second.entitlement.status, "active");
  });
  await t.test(
    "payout reserves exact balance; creator isolation and conflicting retries",
    async () => {
      await db.exec("RESET ROLE");
      await db.query(
        "UPDATE marketplace_publishers SET payout_eligible=true,identity_state='VERIFIED',verification_reference='fixture-kyb' WHERE user_id=$1",
        [c],
      );
      const req = { project_id: projects[c], currency: "USD", idempotency_key: "payout-fixture" };
      payout = await call(c, "payout", req);
      assert.equal(payout.amount, 900);
      assert.equal((await call(c, "payout", req)).id, payout.id);
      await assert.rejects(call(c, "payout", { ...req, currency: "IRR" }), /IDEMPOTENCY_CONFLICT/);
      await actor(x);
      assert.equal(await scalar("SELECT count(*)::int FROM marketplace_payouts"), 0);
      await assert.rejects(call(x, "payout_submit", { id: payout.id }), /ACCESS_DENIED/);
    },
  );
  await t.test("payout cannot submit before authoritative approval", async () => {
    await assert.rejects(
      call(c, "payout_submit", { id: payout.id }, f.providers),
      /APPROVAL_REQUIRED/,
    );
    assert.equal(f.requests.length, 0);
    await f.approve(c, payout.approval_id);
    const p = await call(c, "payout_submit", { id: payout.id }, f.providers);
    assert.equal(p.state, "PROVIDER_PENDING");
    await call(c, "payout_submit", { id: payout.id }, f.providers);
    assert.equal(f.requests.length, 1);
  });
  await t.test("payout settlement must match exact amount/currency/provider proof", async () => {
    const wrong = await f.operationEvent("payout", payout.id, 901);
    await assert.rejects(wrong.send(), /BINDING/);
    const valid = await f.operationEvent("payout", payout.id, 900);
    await assert.rejects(
      f.connect(c, f.providers).commerce.operationEvent("payout", valid.raw, {}),
      /PROVIDER_EVIDENCE/,
    );
    assert.equal((await valid.send()).state, "PAID");
    assert.equal((await valid.send()).state, "ALREADY_PROCESSED");
    assert.equal((await call(c, "dashboard")).earnings[0].state, "PAID");
  });
  await t.test(
    "refund after paid earnings creates negative balance and cannot be paid again",
    async () => {
      const r = await call(b, "refund", {
        id: s.a.id,
        amount: 500,
        currency: "USD",
        reason: "partial adjustment",
        idempotency_key: "post-payout-refund",
      });
      await f.approve(c, r.approval_id);
      await call(c, "refund_submit", { id: r.id }, f.providers);
      await (await f.operationEvent("refund", r.id, 500)).send();
      assert.equal(
        (await call(c, "dashboard")).earnings
          .filter((e) => e.state === "AVAILABLE")
          .reduce((n, e) => n + e.creator_net, 0),
        -450,
      );
      await assert.rejects(
        call(c, "payout", {
          project_id: projects[c],
          currency: "USD",
          idempotency_key: "negative-balance",
        }),
        /NO_AVAILABLE/,
      );
      await call(b, "policy", { project_id: projects[b], policy: {} });
      await f.settled(1000);
      const net = await call(c, "payout", {
        project_id: projects[c],
        currency: "USD",
        idempotency_key: "net-balance",
      });
      assert.equal(net.amount, 450);
    },
  );
  await t.test("refund with no provider stays pending and never reports transfer", async () => {
    const sale = await f.settled(300);
    const r = await call(b, "refund", {
      id: sale.a.id,
      amount: 300,
      currency: "USD",
      reason: "refund request",
      idempotency_key: "no-refund-provider",
    });
    await f.approve(c, r.approval_id);
    const p = await call(c, "refund_submit", { id: r.id });
    assert.equal(p.state, "PROVIDER_PENDING");
    assert.equal(p.provider_status, "NOT_CONFIGURED");
    assert.equal((await call(b, "order", { id: sale.a.id })).phase, "SETTLED");
  });
  await t.test("private adjustment evidence hidden from unrelated actors and guests", async () => {
    await actor(x);
    assert.equal(await scalar("SELECT count(*)::int FROM marketplace_adjustments"), 0);
    await actor(null);
    await assert.rejects(db.query("SELECT * FROM marketplace_acquisitions"), /permission denied/);
    await assert.rejects(db.query("SELECT * FROM marketplace_adjustments"), /permission denied/);
  });
  await t.test("enterprise malformed policy is rejected rather than silently ignored", async () => {
    await assert.rejects(
      call(b, "policy", { project_id: projects[b], policy: { admin_approval: "false" } }),
      /INVALID_POLICY/,
    );
    await assert.rejects(
      call(b, "policy", { project_id: projects[b], policy: { unknownPermission: true } }),
      /INVALID_POLICY/,
    );
  });
  await t.test(
    "membership revocation immediately denies persisted transaction context",
    async () => {
      await db.exec("RESET ROLE");
      await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [
        projects[b],
        b,
      ]);
      await assert.rejects(call(b, "order", { id: s.a.id }), /ACCESS_DENIED/);
      await actor(b);
      assert.equal(await scalar("SELECT count(*)::int FROM marketplace_acquisitions"), 0);
    },
  );
});
