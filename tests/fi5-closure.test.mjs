import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixture, publisher as c, buyer as b, stranger as x } from "./helpers/fi5-fixture.mjs";
import { dispatchCommerce } from "../src/lib/marketplace/commerce-boundary.ts";
import { commerceMoney, commerceRequestKey } from "../src/lib/marketplace/commerce-view.ts";

test("FI5 remaining UI boundary, enterprise and provider safety", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  const { call, projects, actor, scalar } = f;
  await t.test(
    "browser boundary reaches canonical service and refuses provider-only actions",
    async () => {
      const service = f.connect(b).service;
      const d = await dispatchCommerce(service, { action: "dashboard" });
      assert.equal(d.ok, true);
      assert.equal(d.data.orders.length, 0);
      for (const action of [
        "payment_event",
        "operation_event",
        "checkout_reference",
        "operation_reference",
      ])
        assert.deepEqual(await dispatchCommerce(service, { action, input: { state: "SETTLED" } }), {
          ok: false,
          error: "INVALID_ACTION",
        });
    },
  );
  await t.test(
    "browser boundary masks unexpected server details and denies private records",
    async () => {
      const sale = await f.settled();
      assert.deepEqual(
        await dispatchCommerce(f.connect(x).service, { action: "order", input: { id: sale.a.id } }),
        { ok: false, error: "TRANSACTION_ACCESS_DENIED" },
      );
      assert.deepEqual(
        await dispatchCommerce(
          {
            async commerce() {
              throw Error("private database details");
            },
          },
          { action: "dashboard" },
        ),
        { ok: false, error: "UNAVAILABLE" },
      );
    },
  );
  await t.test(
    "actual provider-unconfigured checkout remains pending and cannot activate access",
    async () => {
      const pub = await f.publication(1250);
      const a = await call(b, "acquire", {
        version_id: pub.e.id,
        price_id: pub.quote.id,
        project_id: projects[b],
        idempotency_key: "closure-paid-no-provider",
      });
      await f.approve(b, a.approval_id);
      await call(b, "resume", { id: a.id });
      const r = await dispatchCommerce(f.connect(b).service, {
        action: "checkout",
        input: { id: a.id },
      });
      assert.equal(r.ok, true);
      assert.equal(r.data.provider_status, "NOT_CONFIGURED");
      assert.equal((await call(b, "order", { id: a.id })).entitlement.status, "pending");
    },
  );
  await t.test(
    "configured deterministic checkout calls canonical billing once across recreation",
    async () => {
      let calls = 0;
      const providers = {
        ...f.providers,
        checkoutReturnUrls: {
          successUrl: "https://example.test/return",
          cancelUrl: "https://example.test/cancel",
        },
        payment: {
          ...f.providers.payment,
          async createCheckoutSession(input) {
            calls++;
            assert.equal(input.money.amountMinor, 1300);
            return {
              provider: "fixture-payment",
              providerSessionId: "fixture-checkout-id",
              checkoutUrl: "https://example.test/checkout",
              expiresAt: null,
            };
          },
        },
      };
      const pub = await f.publication(1300);
      const a = await f.acquire(pub);
      await f.approve(b, a.approval_id);
      await call(b, "resume", { id: a.id });
      assert.equal((await call(b, "checkout", { id: a.id }, providers)).phase, "PROVIDER_PENDING");
      assert.equal((await call(b, "checkout", { id: a.id }, providers)).claimed, false);
      assert.equal(calls, 1);
      assert.equal((await call(b, "order", { id: a.id })).entitlement.status, "pending");
      await assert.rejects(call(x, "checkout", { id: a.id }, providers), /ACCESS_DENIED/);
    },
  );
  await t.test("provider event size and digest validation fail closed", async () => {
    await assert.rejects(
      f.connect(b, f.providers).commerce.paymentEvent(new Uint8Array(80001), {}),
      /INVALID_PROVIDER_EVENT/,
    );
    const sale = await f.settled();
    const ev = await f.eventFor(sale.a);
    const dishonest = {
      ...f.providers,
      payment: {
        ...f.providers.payment,
        async verifyWebhook(input) {
          return {
            ...(await f.providers.payment.verifyWebhook(input)),
            payloadDigest: "a".repeat(64),
          };
        },
      },
    };
    await assert.rejects(
      f.connect(b, dishonest).commerce.paymentEvent(ev.raw, { proof: "deterministic-fixture" }),
      /DIGEST_MISMATCH/,
    );
  });
  await t.test(
    "changed enterprise policy cannot be bypassed through existing approval",
    async () => {
      const pub = await f.publication(300);
      const a = await f.acquire(pub);
      await f.approve(b, a.approval_id);
      await call(b, "policy", {
        project_id: projects[b],
        policy: { max_amount: 1, currency: "USD" },
      });
      await assert.rejects(call(b, "resume", { id: a.id }), /ENTERPRISE_PRICE_POLICY/);
      assert.equal((await call(b, "order", { id: a.id })).phase, "WAITING_APPROVAL");
      await call(b, "policy", { project_id: projects[b], policy: {} });
      await call(b, "resume", { id: a.id });
      await call(b, "policy", { project_id: projects[b], policy: { blocked_publishers: [c] } });
      await assert.rejects(call(b, "checkout", { id: a.id }, f.providers), /PUBLISHER_POLICY/);
      await call(b, "policy", { project_id: projects[b], policy: {} });
    },
  );
  await t.test(
    "remaining enterprise type, license, host, version and security policies are enforced",
    async () => {
      const pub = await f.publication(0, {
        license: {
          identifier: "CC-BY-NC-4.0",
          commercialUse: false,
          redistribution: true,
          attributionRequired: true,
          creatorDeclared: true,
        },
        disclosure: {
          languages: ["en"],
          trial: { mode: "text", providerRequired: true },
          privacy: { dataAccess: [], destinations: ["sample.example"], retention: "none" },
        },
      });
      for (const [policy, expected] of [
        [{ allowed_types: ["skill"] }, /TYPE_POLICY/],
        [{ require_commercial_license: true }, /LICENSE_POLICY/],
        [{ allowed_hosts: [] }, /NETWORK_POLICY/],
        [{ pinned_versions: { [pub.e.manifest.packageId]: "9.0.0" } }, /VERSION_PIN/],
        [{ require_security_review: true }, /SECURITY_NOT_VERIFIED/],
      ]) {
        await call(b, "policy", { project_id: projects[b], policy });
        await assert.rejects(f.acquire(pub), expected);
      }
      await call(b, "policy", { project_id: projects[b], policy: {} });
    },
  );
  await t.test(
    "idempotent acquisition survives withdrawal while new request stays forbidden",
    async () => {
      const pub = await f.publication();
      const input = {
        version_id: pub.e.id,
        price_id: pub.quote.id,
        project_id: projects[b],
        idempotency_key: "closure-historical-retry",
      };
      const first = await call(b, "acquire", input);
      await call(c, "lifecycle", { version_id: pub.e.id, state: "WITHDRAWN" });
      assert.equal((await call(b, "acquire", input)).id, first.id);
      await assert.rejects(
        call(b, "acquire", { ...input, idempotency_key: "closure-new-withdrawn" }),
        /UNAVAILABLE/,
      );
    },
  );
  await t.test("current price projection is real and guest visibility is scoped", async () => {
    const pub = await f.publication(235);
    await actor(null);
    assert.equal(
      (
        await scalar("SELECT snapshot FROM marketplace_current_prices WHERE version_id=$1", [
          pub.e.id,
        ])
      ).amount,
      235,
    );
    await actor(c, true);
    const draft = (await call(c, "dashboard")).drafts.find((d) => d.id === pub.e.id);
    assert.equal(draft.lifecycle, "published");
    await call(c, "lifecycle", { version_id: pub.e.id, state: "WITHDRAWN" });
    await actor(null);
    assert.equal(
      await scalar("SELECT count(*)::int FROM marketplace_current_prices WHERE version_id=$1", [
        pub.e.id,
      ]),
      0,
    );
  });
  await t.test("UI currency identity and request retry keys have deterministic semantics", () => {
    assert.equal(commerceMoney({ amount: 125, currency: "USD" }), "1.25 USD");
    assert.equal(commerceMoney({ amount: 125, currency: "IRR" }), "125 IRR");
    assert.equal(commerceMoney({ amount: 125, currency: "IRT" }), "125 IRT");
    const key = commerceRequestKey();
    assert.equal(key("refund", { id: "a", amount: 1 }), key("refund", { id: "a", amount: 1 }));
    assert.notEqual(key("refund", { id: "a", amount: 1 }), key("refund", { id: "a", amount: 2 }));
  });
  await t.test("all five FI5 locale catalogs have exact key parity", async () => {
    const catalogs = await Promise.all(
      ["en", "fa", "ar", "zh", "hi"].map(async (l) =>
        JSON.parse(await readFile(new URL("../messages/" + l + ".json", import.meta.url), "utf8")),
      ),
    );
    const keys = Object.keys(catalogs[0]).sort();
    for (const catalog of catalogs) assert.deepEqual(Object.keys(catalog).sort(), keys);
    for (const catalog of catalogs)
      for (const key of keys.filter((k) => k.startsWith("fi5_"))) assert.ok(catalog[key].length);
  });
});
