import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  publisher as c,
  buyer as b,
  stranger as x,
  price,
} from "./helpers/fi5-fixture.mjs";
import { entry } from "./helpers/fi4-fixture.mjs";
import { validatePrice, safeCommerceInput } from "../src/lib/marketplace/commerce.ts";
test("FI5 canonical commerce behavior on PostgreSQL", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  const { call, scalar, actor, db, projects } = f;
  let free, paid, order, refund, payout;
  await t.test("publisher identity and payout verification stay separate", async () => {
    const p = await call(c, "publisher", { state: "ACTIVE" });
    assert.equal(p.identity_state, "NOT_VERIFIED");
    assert.equal(p.payout_eligible, false);
    await assert.rejects(call(c, "publisher", { state: "SUSPENDED" }), /POLICY/);
  });
  await t.test("creator ownership rejects impersonated draft", async () => {
    await assert.rejects(
      call(x, "draft", { entry: await entry({ creatorId: c }), price: price() }),
      /OWNER/,
    );
  });
  await t.test("governed publication creates immutable package and price", async () => {
    free = await f.publication();
    assert.equal((await call(c, "publish", { id: free.e.id })).stage, "PUBLISHED");
    await assert.rejects(call(c, "draft", { entry: free.e, price: price() }), /IMMUTABLE/);
    await assert.rejects(call(x, "publish", { id: free.e.id }), /OWNER/);
  });
  await t.test("free acquisition activates canonical entitlement without provider", async () => {
    const a = await call(b, "acquire", {
      version_id: free.e.id,
      price_id: free.quote.id,
      project_id: projects[b],
      idempotency_key: "free-acquire-001",
    });
    assert.equal(a.phase, "SETTLED");
    assert.equal((await call(b, "order", { id: a.id })).entitlement.status, "active");
    free.order = a;
  });
  await t.test("same request retries return same acquisition; conflict denied", async () => {
    const input = {
      version_id: free.e.id,
      price_id: free.quote.id,
      project_id: projects[b],
      idempotency_key: "free-acquire-001",
    };
    assert.equal((await call(b, "acquire", input)).id, free.order.id);
    await assert.rejects(
      call(b, "acquire", { ...input, extra: "conflict" }),
      /IDEMPOTENCY_CONFLICT/,
    );
  });
  await t.test("paid acquisition with no provider remains pending after approval", async () => {
    paid = await f.publication(1000);
    order = await call(b, "acquire", {
      version_id: paid.e.id,
      price_id: paid.quote.id,
      project_id: projects[b],
      idempotency_key: "paid-not-configured",
    });
    assert.equal(order.phase, "WAITING_APPROVAL");
    await f.approve(b, order.approval_id);
    const a = await call(b, "resume", { id: order.id });
    assert.equal(a.phase, "PROVIDER_PENDING");
    assert.equal(a.provider_status, "NOT_CONFIGURED");
    assert.equal(a.entitlement.status, "pending");
  });
  await t.test("client cannot fabricate financial success or provider facts", async () => {
    await assert.rejects(call(b, "payment_event", { state: "SETTLED" }), /INVALID_ACTION/);
    await assert.rejects(call(b, "acquire", { _provider: "fake" }), /SERVER_FACT/);
    await assert.rejects(call(b, "acquire", { signatureVerified: true }), /SERVER_FACT/);
    await assert.rejects(
      f.connect(b).commerce.paymentEvent(new Uint8Array(), {}),
      /NOT_CONFIGURED/,
    );
  });
  let settlement;
  await t.test(
    "verified deterministic provider event activates entitlement and records earnings once",
    async () => {
      settlement = await f.settled();
      const a = await call(b, "order", { id: settlement.a.id });
      assert.equal(a.phase, "SETTLED");
      assert.equal(a.entitlement.status, "active");
      const dash = await call(c, "dashboard");
      assert.equal(dash.earnings.length, 1);
      assert.equal(dash.earnings[0].creator_net, 900);
    },
  );
  await t.test("duplicate event is idempotent; conflicting event rejected", async () => {
    await settlement.ev.send();
    assert.equal((await call(c, "dashboard")).earnings.length, 1);
    const raw = JSON.parse(new TextDecoder().decode(settlement.ev.raw));
    const ev = await f.eventFor(settlement.a, "payment_confirmed", {
      ...raw,
      occurredAt: "2026-09-29T07:01:00Z",
    });
    await assert.rejects(ev.send(), /IDEMPOTENCY_CONFLICT/);
  });
  await t.test("unsigned events and state regressions are denied", async () => {
    const ev = await f.eventFor(settlement.a, "payment_cancelled");
    await assert.rejects(
      f.connect(b, f.providers).commerce.paymentEvent(ev.raw, {}),
      /PAYMENT_CONFIRMATION/,
    );
    await assert.rejects(ev.send(), /INVALID_TRANSITION/);
    assert.equal((await call(b, "order", { id: settlement.a.id })).phase, "SETTLED");
  });
  await t.test("refund ceiling and currency mismatch fail closed", async () => {
    await assert.rejects(
      call(b, "refund", {
        id: settlement.a.id,
        amount: 1001,
        currency: "USD",
        reason: "test refund",
        idempotency_key: "refund-too-large",
      }),
      /REFUND_CEILING/,
    );
    await assert.rejects(
      call(b, "refund", {
        id: settlement.a.id,
        amount: 100,
        currency: "IRR",
        reason: "test refund",
        idempotency_key: "refund-wrong-currency",
      }),
      /CURRENCY_MISMATCH/,
    );
  });
  await t.test("refund idempotency and double-refund reservation", async () => {
    const input = {
      id: settlement.a.id,
      amount: 200,
      currency: "USD",
      reason: "partial refund",
      idempotency_key: "refund-idempotent",
    };
    refund = await call(b, "refund", input);
    assert.equal((await call(b, "refund", input)).id, refund.id);
    await assert.rejects(call(b, "refund", { ...input, amount: 201 }), /IDEMPOTENCY_CONFLICT/);
    await assert.rejects(
      call(b, "refund", { ...input, amount: 900, idempotency_key: "refund-over-reserved" }),
      /REFUND_CEILING/,
    );
  });
  await t.test("refund approval is authoritative and held earnings cannot pay out", async () => {
    assert.equal((await call(b, "refund_decide", { id: refund.id })).state, "UNDER_REVIEW");
    await assert.rejects(
      call(b, "approve", { id: refund.approval_id, decision: "approved" }),
      /APPROVER_REQUIRED/,
    );
    await assert.rejects(
      call(c, "payout", {
        project_id: projects[c],
        currency: "USD",
        idempotency_key: "held-payout",
      }),
      /HELD_EARNINGS/,
    );
    await f.approve(c, refund.approval_id);
    assert.equal((await call(c, "refund_decide", { id: refund.id })).state, "APPROVED");
  });
  await t.test(
    "refund provider request is durable and not repeated after service recreation",
    async () => {
      const first = await call(c, "refund_submit", { id: refund.id }, f.providers);
      assert.equal(first.state, "PROVIDER_PENDING");
      await call(c, "refund_submit", { id: refund.id }, f.providers);
      assert.equal(f.requests.filter((r) => r.id === refund.id).length, 1);
    },
  );
  await t.test(
    "verified refund reverses earnings and rejects duplicate conflicting events",
    async () => {
      const ev = await f.operationEvent("refund", refund.id, 200);
      assert.equal((await ev.send()).state, "REFUNDED");
      assert.equal((await ev.send()).state, "ALREADY_PROCESSED");
      assert.equal((await call(b, "order", { id: settlement.a.id })).phase, "PARTIALLY_REFUNDED");
      const dash = await call(c, "dashboard");
      assert.equal(
        dash.earnings.reduce((s, e) => s + e.creator_net, 0),
        720,
      );
      const content = JSON.parse(new TextDecoder().decode(ev.raw));
      const bad = await f.operationEvent("refund", refund.id, 200, "USD", {
        ...content,
        state: "FAILED",
      });
      await assert.rejects(bad.send(), /IDEMPOTENCY_CONFLICT/);
    },
  );
  await t.test(
    "payout requires external eligibility; wrong currency cannot settle another balance",
    async () => {
      payout = await call(c, "payout", {
        project_id: projects[c],
        currency: "USD",
        idempotency_key: "not-eligible-payout",
      });
      assert.equal(payout.state, "ELIGIBILITY_REQUIRED");
      assert.equal(payout.amount, 720);
      await assert.rejects(
        call(c, "payout", {
          project_id: projects[c],
          currency: "IRR",
          idempotency_key: "wrong-currency-payout",
        }),
        /NO_AVAILABLE/,
      );
    },
  );
  await t.test("payout approval without provider cannot mark PAID", async () => {
    await db.exec("RESET ROLE");
    await db.query(
      "UPDATE marketplace_publishers SET payout_eligible=true,identity_state='VERIFIED',verification_reference='deterministic-test-only' WHERE user_id=$1",
      [c],
    );
    payout = await call(c, "payout", {
      project_id: projects[c],
      currency: "USD",
      idempotency_key: "approved-payout",
    });
    assert.equal(payout.state, "DRAFT");
    await f.approve(c, payout.approval_id);
    const result = await call(c, "payout_submit", { id: payout.id });
    assert.equal(result.state, "PROVIDER_PENDING");
    assert.equal(result.provider_status, "NOT_CONFIGURED");
    assert.equal(
      (await call(c, "dashboard")).payouts.some((p) => p.state === "PAID"),
      false,
    );
  });
  await t.test("disputes preserve evidence and only counterparty can concede", async () => {
    const s = await f.settled(500);
    const d = await call(b, "dispute", {
      id: s.a.id,
      currency: "USD",
      reason: "Not as described",
      evidence: ["case:document-1"],
      idempotency_key: "dispute-001",
    });
    assert.equal(d.state, "OPEN");
    await call(c, "dispute_decide", { id: d.id, state: "EVIDENCE_REQUIRED" });
    await call(b, "dispute_decide", {
      id: d.id,
      state: "UNDER_REVIEW",
      evidence: ["case:document-2"],
    });
    await assert.rejects(
      call(b, "dispute_decide", { id: d.id, state: "RESOLVED_BUYER" }),
      /COUNTERPARTY/,
    );
    await call(b, "dispute_decide", { id: d.id, state: "RESOLVED_CREATOR" });
    assert.equal((await call(c, "dispute_decide", { id: d.id, state: "CLOSED" })).state, "CLOSED");
  });
  await t.test("license and price snapshots are not retroactively changed", async () => {
    await call(c, "price", { version_id: free.e.id, price: price(500) });
    const a = await call(b, "order", { id: free.order.id });
    assert.equal(a.price.amount, 0);
    assert.deepEqual(a.license, free.e.manifest.license);
  });
  await t.test("cross-user transaction/refund/payout access denied", async () => {
    await assert.rejects(call(x, "order", { id: settlement.a.id }), /ACCESS_DENIED/);
    await assert.rejects(
      call(x, "refund", {
        id: settlement.a.id,
        amount: 1,
        currency: "USD",
        reason: "abuse",
        idempotency_key: "foreign-refund",
      }),
      /ACCESS_DENIED/,
    );
    await assert.rejects(call(x, "refund_decide", { id: refund.id }), /ACCESS_DENIED/);
    await assert.rejects(call(x, "payout_submit", { id: payout.id }), /ACCESS_DENIED/);
    assert.equal((await call(x, "dashboard")).earnings.length, 0);
  });
  await t.test("deprecated ownership remains; withdrawal denies new acquisition", async () => {
    await call(c, "lifecycle", { version_id: free.e.id, state: "DEPRECATED" });
    assert.equal(
      (await call(b, "assert_execution", { id: free.order.id })).entitlement.status,
      "active",
    );
    await call(c, "lifecycle", { version_id: free.e.id, state: "WITHDRAWN" });
    await assert.rejects(f.acquire(free), /CAPABILITY_UNAVAILABLE/);
    assert.equal((await call(b, "order", { id: free.order.id })).entitlement.status, "active");
  });
  await t.test("security block fails closed for owned execution", async () => {
    await call(c, "lifecycle", { version_id: free.e.id, state: "SECURITY_BLOCKED" });
    await assert.rejects(call(b, "assert_execution", { id: free.order.id }), /NOT_EXECUTABLE/);
  });
  await t.test("analytics empty state is real zero and unknown conversion", async () => {
    const d = await call(x, "dashboard");
    assert.equal(d.analytics.free_acquisitions, 0);
    assert.equal(d.analytics.paid_settlements, 0);
    assert.deepEqual(d.analytics.currency_totals, []);
    assert.equal(d.analytics.conversion, "NOT_ENOUGH_DATA");
  });
  await t.test(
    "enterprise policy mutation and project acquisition require ownership/access",
    async () => {
      await assert.rejects(
        call(x, "policy", { project_id: projects[b], policy: {} }),
        /OWNER_REQUIRED/,
      );
      await assert.rejects(
        call(x, "acquire", {
          project_id: projects[b],
          version_id: paid.e.id,
          price_id: paid.quote.id,
          idempotency_key: "foreign-project",
        }),
        /ACCESS_DENIED/,
      );
    },
  );
  await t.test("enterprise maximum price and publisher allow/block enforced", async () => {
    await call(b, "policy", {
      project_id: projects[b],
      policy: { max_amount: 10, currency: "USD" },
    });
    await assert.rejects(f.acquire(paid), /ENTERPRISE_PRICE_POLICY/);
    await call(b, "policy", { project_id: projects[b], policy: { blocked_publishers: [c] } });
    await assert.rejects(f.acquire(paid), /PUBLISHER_POLICY/);
    await call(b, "policy", { project_id: projects[b], policy: { allowed_publishers: [x] } });
    await assert.rejects(f.acquire(paid), /PUBLISHER_POLICY/);
  });
  await t.test("enterprise permissions and admin approval are server enforced", async () => {
    await call(b, "policy", { project_id: projects[b], policy: { allowed_permissions: [] } });
    await assert.rejects(f.acquire(paid), /PERMISSION_POLICY/);
    await call(b, "policy", { project_id: projects[b], policy: { admin_approval: true } });
    const pub = await f.publication();
    const a = await f.acquire(pub);
    assert.equal(a.phase, "WAITING_APPROVAL");
    await call(b, "approve", { id: a.approval_id, decision: "denied" });
    assert.equal((await call(b, "resume", { id: a.id })).phase, "CANCELLED");
    await call(b, "policy", { project_id: projects[b], policy: {} });
  });
  await t.test("currency identity, subscription contract and no credential input", async () => {
    assert.equal(validatePrice(price(100, "IRT")).currency_identity, "TOMAN");
    assert.equal(validatePrice(price(100, "IRR")).minor_unit_scale, 0);
    assert.equal(validatePrice(price(100, "USD", "SUBSCRIPTION")).billing_model, "SUBSCRIPTION");
    assert.throws(() => validatePrice(price(1, "TOMAN")), /INVALID_PRICE/);
    assert.throws(() => safeCommerceInput({ api_key: "not-a-real-key" }), /UNSAFE/);
  });
  await t.test(
    "consequential transitions use canonical audit without private credential material",
    async () => {
      await db.exec("RESET ROLE");
      const audits = (
        await db.query(
          "SELECT event_type,metadata FROM audit_events WHERE event_type LIKE 'marketplace.%'",
        )
      ).rows;
      assert.ok(audits.some((x) => x.event_type === "marketplace.payment"));
      assert.ok(audits.some((x) => x.event_type === "marketplace.refund_settlement"));
      assert.doesNotMatch(JSON.stringify(audits), /deterministic-fixture|private_key|api_key/);
    },
  );
});
