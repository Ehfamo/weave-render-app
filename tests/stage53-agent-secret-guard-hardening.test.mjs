import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814201500_stage53_agents_secret_guard_hardening.sql",
  import.meta.url,
);

test("compensating agent JSON guard normalizes and recursively rejects common secret keys", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION private\.xeomx_json_has_sensitive_key\(p_value JSONB\)/,
  );
  assert.match(sql, /regexp_replace\(v_key, '\[\^a-zA-Z0-9\]\+'/);
  assert.match(sql, /private\.xeomx_json_has_sensitive_key\(v_child\)/);
  for (const normalized of [
    "clientsecret",
    "accesstoken",
    "authorization",
    "cookie",
    "webhooksignature",
    "rawpayload",
    "servicerolekey",
    "privatekey",
  ]) {
    assert.match(sql, new RegExp(`'${normalized}'`));
  }
});

test("hardened guard remains fixed-path and private to trusted execution", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /SET search_path = ''/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION private\.xeomx_json_has_sensitive_key\(JSONB\)[\s\S]*?FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION private\.xeomx_json_has_sensitive_key\(JSONB\)[\s\S]*?TO service_role;/,
  );
  assert.doesNotMatch(sql, /^\s*(?:BEGIN|COMMIT);\s*$/im);
  assert.doesNotMatch(sql, /DROP\s+|TRUNCATE\s+|DELETE\s+FROM/i);
});
