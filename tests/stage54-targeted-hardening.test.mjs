import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  REQUEST_7_LIVE_TEXT_PROVIDER,
  REQUEST_7_TEXT_PROVIDER_ROUTES,
} from "../src/lib/backend/vertical-slice.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Stage 5.4 app routing registers the exact Cloudflare, Gemini, and Groq models", () => {
  assert.deepEqual(
    REQUEST_7_TEXT_PROVIDER_ROUTES.map(({ id, model }) => ({ id, model })),
    [
      { id: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct-fast" },
      { id: "gemini", model: "gemini-3.5-flash" },
      { id: "groq", model: "llama-3.1-8b-instant" },
    ],
  );
});

test("the verified Cloudflare route remains the default live route", () => {
  assert.equal(REQUEST_7_LIVE_TEXT_PROVIDER, REQUEST_7_TEXT_PROVIDER_ROUTES[0]);
  assert.equal(REQUEST_7_LIVE_TEXT_PROVIDER.reservedCreditUnits, 5);
});

test("server-side manual submission validates against the exact provider registry", async () => {
  const source = await read("../src/lib/backend/vertical-slice.server.ts");
  assert.match(source, /REQUEST_7_TEXT_PROVIDER_ROUTES\.filter/);
  assert.match(source, /route\.id === input\.requestedProvider/);
  assert.match(source, /route\.model === input\.requestedModel/);
  assert.doesNotMatch(source, /input\.requestedProvider !== route\.id/);
});

test("provider success followed by persistence failure fails closed without cross-provider fallback", async () => {
  const source = await read("../supabase/functions/xeomx-generation-worker/index.ts");
  const branchStart = source.indexOf("if (completed.error)");
  const successLog = source.indexOf("xeomx-worker-success", branchStart);
  assert.ok(branchStart > 0 && successLog > branchStart);
  const branch = source.slice(branchStart, successLog);
  assert.match(branch, /xeomx-provider-success-persistence-failed/);
  assert.match(branch, /xeomx_fail_generation_job/);
  assert.match(branch, /p_provider_request_identifier: output\.providerRequestId/);
  assert.match(branch, /reason:\s*[\"']persistence_failed_after_provider_success[\"']/);
  assert.match(branch, /return \{/);
  assert.doesNotMatch(branch, /xeomx_begin_provider_fallback/);
});

test("credit ledger Stage 5.4 migration restores authenticated read-only ACL", async () => {
  const sql = await read(
    "../supabase/migrations/20260814145603_stage5_4_credit_ledger_acl_hardening.sql",
  );
  assert.match(
    sql,
    /revoke all privileges on table public\.credit_ledger from anon, authenticated/i,
  );
  assert.match(sql, /grant select on table public\.credit_ledger to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|truncate).*authenticated/i);
});

test("pending entitlement audit trigger is provider-neutral and privilege-contained", async () => {
  const sql = await read(
    "../supabase/migrations/20260814150120_stage5_4_pending_entitlement_audit.sql",
  );
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /billing\.entitlement\.pending\.created/i);
  assert.match(sql, /after insert on public\.billing_entitlements/i);
  assert.match(sql, /revoke all on function private\.xeomx_audit_pending_billing_entitlement\(\)/i);
  assert.doesNotMatch(sql, /(stripe|paypal|adyen|braintree)/i);
});
