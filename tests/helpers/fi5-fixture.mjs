import { readFile } from "node:fs/promises";
import { postgres } from "./fi3-postgres.mjs";
import { entry } from "./fi4-fixture.mjs";
import { MarketplaceService } from "../../src/lib/marketplace/service.ts";
import { sha256 } from "../../src/lib/marketplace/integrity.ts";
export const publisher = "10000000-0000-4000-8000-000000000001",
  buyer = "10000000-0000-4000-8000-000000000002",
  stranger = "10000000-0000-4000-8000-000000000003";
export const price = (
  amount = 0,
  currency = "USD",
  billing_model = amount ? "ONE_TIME" : "FREE",
) => ({
  amount,
  currency,
  billing_model,
  tax_status: "UNKNOWN",
  effective_from: "2026-09-24T00:00:00Z",
});
export async function fixture() {
  const p = await postgres();
  const { db, actor, scalar } = p;
  for (const name of [
    "20260814203000_stage53_billing_provider_boundary.sql",
    "20260922000000_fi4_marketplace.sql",
    "20260924063459_fi5_marketplace_commerce.sql",
  ])
    await db.exec(
      await readFile(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8"),
    );
  await db.query("INSERT INTO auth.users(id) VALUES($1),($2),($3)", [publisher, buyer, stranger]);
  const projects = {};
  for (const id of [publisher, buyer, stranger]) {
    await actor(id);
    projects[id] = (
      await db.query("SELECT * FROM xeomx_create_project($1,$2)", ["test", null])
    ).rows[0].id;
  }
  const requests = [];
  function connect(who, providers = {}) {
    const store = {
      userId: who,
      async commerce(action, data) {
        await actor(who, true);
        return scalar("SELECT xeomx_marketplace_commerce($1,$2,$3)", [who, action, data]);
      },
      async list() {
        await actor(who);
        const ids = (
          await db.query("SELECT id FROM marketplace_listings WHERE state='published'")
        ).rows.map((x) => x.id);
        await actor(who, true);
        return (
          await db.query("SELECT entry FROM marketplace_versions WHERE id=ANY($1::uuid[])", [ids])
        ).rows.map((x) => x.entry);
      },
      async get(id) {
        await actor(who);
        const row = (await db.query("SELECT id,state FROM marketplace_listings WHERE id=$1", [id]))
          .rows[0];
        if (!row) return null;
        await actor(who, true);
        return {
          ...(await scalar("SELECT entry FROM marketplace_versions WHERE id=$1", [id])),
          state: row.state,
        };
      },
      async authorizeProject(id) {
        await actor(who);
        if (!(await scalar("SELECT xeomx_project_role($1)", [id])))
          throw Error("PROJECT_ACCESS_DENIED");
      },
      async saveGrant(e, project) {
        await actor(who);
        await scalar("SELECT xeomx_marketplace_grant($1,$2,$3,$4)", [
          e.id,
          project,
          e.manifest.integrity.digest,
          e.manifest.permissions,
        ]);
      },
      async grant(packageId, project) {
        await actor(who);
        return (
          (await scalar(
            "SELECT record FROM marketplace_permission_grants WHERE user_id=$1 AND project_id=$2 AND package_id=$3",
            [who, project, packageId],
          )) ?? null
        );
      },
      async hasTrial(id) {
        await actor(who);
        return !!(await scalar(
          "SELECT count(*)::int FROM marketplace_trials WHERE version_id=$1 AND user_id=$2 AND state='COMPLETED'",
          [id, who],
        ));
      },
      async review(id, dimensions, text) {
        await actor(who);
        return scalar("SELECT xeomx_marketplace_review($1,$2,$3)", [id, dimensions, text]);
      },
      async reviews() {
        return [];
      },
    };
    const service = new MarketplaceService(store, {
      async run() {
        return { state: "NOT_CONFIGURED" };
      },
    });
    return { service, commerce: service.commerceBoundary(providers), store };
  }
  const payment = {
    id: "fixture-payment",
    configured: true,
    async createCheckoutSession() {
      throw Error("NO_REAL_FINANCIAL_EXECUTION");
    },
    async verifyWebhook({ rawBody, headers }) {
      return {
        ...JSON.parse(new TextDecoder().decode(rawBody)),
        payloadDigest: await sha256(new TextDecoder().decode(rawBody)),
        signatureVerified: headers.proof === "deterministic-fixture",
      };
    },
  };
  const operation = (kind) => ({
    id: "fixture-" + kind,
    configured: true,
    async request(x) {
      requests.push(x);
      return { state: "PENDING", providerReference: "fixture:" + x.id };
    },
    async verify({ rawBody, headers }) {
      return {
        ...JSON.parse(new TextDecoder().decode(rawBody)),
        payloadDigest: await sha256(new TextDecoder().decode(rawBody)),
        signatureVerified: headers.proof === "deterministic-fixture",
      };
    },
  });
  const providers = {
    payment,
    refund: operation("refund"),
    payout: operation("payout"),
    feeBps: 1000,
  };
  const call = (who, action, data = {}, withProviders = {}) =>
    connect(who, withProviders).commerce.command(action, data);
  async function publication(amount = 0, changes = {}, metadata = {}) {
    const e = await entry(
      {
        packageId: "fixture." + crypto.randomUUID(),
        creatorId: publisher,
        disclosure: {
          languages: ["en"],
          trial: { mode: "text", providerRequired: true },
          privacy: { dataAccess: [], destinations: [], retention: "none", training: "none" },
        },
        ...changes,
      },
      metadata,
    );
    await call(publisher, "publisher", { state: "ACTIVE" });
    await call(publisher, "draft", { entry: e, price: price(amount) });
    const validation = await call(publisher, "validate", { id: e.id });
    if (validation.stage !== "READY") throw Error("PUBLICATION_" + validation.stage);
    await call(publisher, "publish", { id: e.id });
    const quote = await call(buyer, "quote", { version_id: e.id });
    await connect(buyer).service.approvePermissions(
      e.id,
      projects[buyer],
      e.manifest.integrity.digest,
      e.manifest.permissions.map((x) => x.id),
    );
    return { e, quote };
  }
  async function acquire(pub, opts = {}) {
    return call(
      buyer,
      "acquire",
      {
        version_id: pub.e.id,
        price_id: pub.quote.id,
        project_id: projects[buyer],
        idempotency_key: crypto.randomUUID(),
        ...opts,
      },
      providers,
    );
  }
  async function approve(who, id) {
    return call(who, "approve", { id, decision: "approved" });
  }
  async function eventFor(a, eventType = "payment_confirmed", extra = {}) {
    const raw = new TextEncoder().encode(
      JSON.stringify({
        provider: payment.id,
        providerEventId: crypto.randomUUID(),
        eventType,
        userId: buyer,
        checkoutIntentId: a.id,
        money: { amountMinor: a.price.amount, currency: a.price.currency },
        occurredAt: "2026-09-29T07:00:00Z",
        ...extra,
      }),
    );
    return {
      raw,
      send: () =>
        connect(buyer, providers).commerce.paymentEvent(raw, { proof: "deterministic-fixture" }),
    };
  }
  async function settled(amount = 1000) {
    const pub = await publication(amount);
    const a = await acquire(pub);
    await approve(buyer, a.approval_id);
    await call(buyer, "resume", { id: a.id });
    const ev = await eventFor(a);
    await ev.send();
    return { pub, a, ev };
  }
  async function operationEvent(kind, id, amount, currency = "USD", extra = {}) {
    const raw = new TextEncoder().encode(
      JSON.stringify({
        provider: providers[kind].id,
        eventId: crypto.randomUUID(),
        entityId: id,
        state: "SETTLED",
        amountMinor: amount,
        currency,
        ...extra,
      }),
    );
    return {
      raw,
      send: () =>
        connect(publisher, providers).commerce.operationEvent(kind, raw, {
          proof: "deterministic-fixture",
        }),
    };
  }
  return {
    ...p,
    projects,
    connect,
    call,
    publication,
    acquire,
    approve,
    eventFor,
    settled,
    operationEvent,
    providers,
    requests,
  };
}
