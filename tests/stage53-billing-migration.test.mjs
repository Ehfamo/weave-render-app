import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814203000_stage53_billing_provider_boundary.sql",
  import.meta.url,
);

const tables = [
  "billing_checkout_intents",
  "billing_webhook_receipts",
  "billing_payment_events",
  "billing_subscriptions",
  "billing_entitlements",
];

const serviceFunctions = [
  "xeomx_create_billing_checkout_intent",
  "xeomx_transition_billing_checkout_intent",
  "xeomx_record_verified_billing_event",
  "xeomx_upsert_billing_subscription",
  "xeomx_create_pending_billing_entitlement",
  "xeomx_activate_billing_entitlement",
  "xeomx_set_billing_entitlement_status",
];

test("Stage 5.3 billing migration is additive and lets apply_migration own the transaction", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /^-- XEOMX Stage 5\.3/);
  assert.doesNotMatch(sql, /^\s*(?:BEGIN|COMMIT);\s*$/im);
  assert.doesNotMatch(sql, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);

  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table} \\(`));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
    assert.match(sql, new RegExp(`GRANT SELECT ON TABLE public\\.${table}`));
  }
});

test("authenticated clients can read only their own billing rows", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(
        `ON public\\.${table} FOR SELECT TO authenticated[\\s\\S]*?USING \\(\\(SELECT auth\\.uid\\(\\)\\) = user_id\\);`,
      ),
    );
    assert.doesNotMatch(
      sql,
      new RegExp(
        `GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*public\\.${table} TO (?:anon|authenticated)`,
        "i",
      ),
    );
  }
  assert.doesNotMatch(sql, /FOR (?:INSERT|UPDATE|DELETE) TO authenticated/i);
});

test("foreign keys have covering indexes and payment events are idempotent", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const index of [
    "billing_checkout_intents_user_created_idx",
    "billing_checkout_intents_project_idx",
    "billing_webhook_receipts_user_received_idx",
    "billing_webhook_receipts_checkout_idx",
    "billing_payment_events_user_recorded_idx",
    "billing_payment_events_checkout_idx",
    "billing_subscriptions_user_status_idx",
    "billing_subscriptions_checkout_idx",
    "billing_subscriptions_source_event_idx",
    "billing_entitlements_user_status_idx",
    "billing_entitlements_checkout_idx",
    "billing_entitlements_subscription_idx",
    "billing_entitlements_activation_event_idx",
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX ${index}`));
  }
  assert.match(sql, /UNIQUE \(provider, provider_event_id\)/);
  assert.match(sql, /webhook_receipt_id UUID NOT NULL UNIQUE/);
  assert.match(sql, /XEOMX_BILLING_IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /billing_payment_events_immutable/);
  assert.match(sql, /billing_webhook_receipts_immutable/);
});

test("aggregate advisory locks make create/event/entitlement idempotency race-safe", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /hashtextextended/);
  assert.match(sql, /'checkout-request:' \|\| p_user_id::TEXT \|\| ':' \|\| p_idempotency_key/);
  assert.match(sql, /'provider-event:' \|\| p_provider \|\| ':' \|\| p_provider_event_id/);
  assert.ok((sql.match(/'checkout:' \|\|/g) ?? []).length >= 5);
  assert.match(sql, /v_event\.occurred_at IS DISTINCT FROM p_occurred_at/);
  assert.match(sql, /v_event\.metadata IS DISTINCT FROM p_metadata/);
});

test("checkout and subscription lifecycle transitions fail closed", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const checkout = sql.match(
    /CREATE OR REPLACE FUNCTION public\.xeomx_transition_billing_checkout_intent[\s\S]*?\n\$\$;/,
  )?.[0];
  const subscription = sql.match(
    /CREATE OR REPLACE FUNCTION public\.xeomx_upsert_billing_subscription[\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(checkout);
  assert.ok(subscription);
  assert.match(checkout, /XEOMX_INVALID_BILLING_TRANSITION/);
  assert.match(checkout, /XEOMX_PROVIDER_SESSION_REQUIRED/);
  assert.match(checkout, /XEOMX_BILLING_FAILURE_CODE_REQUIRED/);
  assert.match(subscription, /v_subscription\.status = 'active'/);
  assert.match(subscription, /v_subscription\.status = 'cancelled' AND p_status = 'refunded'/);
  assert.match(subscription, /XEOMX_INVALID_BILLING_TRANSITION/);
});

test("service-only helpers revoke public and client execution", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const fn of serviceFunctions) {
    assert.match(sql, new RegExp(`SECURITY DEFINER[\\s\\S]*?SET search_path = ''`));
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated;`,
      ),
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role;`),
    );
  }
});

test("entitlement activation locks and validates a confirmed payment event", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const activation = sql.match(
    /CREATE OR REPLACE FUNCTION public\.xeomx_activate_billing_entitlement[\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(activation);
  assert.match(activation, /FROM public\.billing_entitlements[\s\S]*?FOR UPDATE;/);
  assert.match(activation, /FROM public\.billing_payment_events[\s\S]*?FOR UPDATE;/);
  assert.match(activation, /v_event\.signature_verified IS DISTINCT FROM true/);
  assert.match(activation, /v_event\.event_type <> 'payment_confirmed'/);
  assert.match(activation, /v_event\.user_id <> v_entitlement\.user_id/);
  assert.match(activation, /v_event\.checkout_intent_id <> v_entitlement\.checkout_intent_id/);
  assert.doesNotMatch(sql, /CHECK\s*\([^;]*(?:SELECT|EXISTS)/is);
});

test("migration remains provider-neutral and contains no credentials", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.doesNotMatch(sql, /stripe|paypal|adyen|braintree|paddle|lemonsqueezy/i);
  assert.doesNotMatch(
    sql,
    /service_role_key|authorization\s*[:=]\s*['"][A-Za-z0-9_-]{20}|sk_(?:live|test)_/i,
  );
});

test("metadata is recursively filtered and raw webhook payloads are never persisted", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /private\.xeomx_billing_metadata_is_safe\(p_value JSONB\)/);
  assert.match(sql, /jsonb_each\(p_value\)/);
  assert.match(sql, /jsonb_array_elements\(p_value\)/);
  assert.match(sql, /secret\|token\|password\|api\[_-\]\?key\|service\[_-\]\?role\|authorization/);
  assert.equal(sql.match(/NOT private\.xeomx_billing_metadata_is_safe\(p_metadata\)/g)?.length, 4);
  assert.doesNotMatch(sql, /raw_payload|raw_webhook|webhook_payload/i);
  assert.match(sql, /payload_digest TEXT NOT NULL/);
});
