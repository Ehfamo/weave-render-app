import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260811000000_request_7_backend_vertical_slice.sql",
  import.meta.url,
);

const tables = [
  "projects",
  "project_members",
  "conversations",
  "messages",
  "generation_jobs",
  "provider_requests",
  "assets",
  "generation_outputs",
  "usage_events",
  "credit_ledger",
  "audit_events",
];

test("Request 7 migration is additive, indexed and RLS protected", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.ok(sql.startsWith("BEGIN;"));
  assert.ok(sql.trimEnd().endsWith("COMMIT;"));
  assert.doesNotMatch(sql, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+public\./i);

  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table} \\(`));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
  }
  assert.match(sql, /UNIQUE \(user_id, idempotency_key\)/);
  assert.match(sql, /hashtextextended\('credits:' \|\| p_actor_id::text, 0\)/);
  assert.match(sql, /generation_jobs_active_idx/);
  assert.match(sql, /credit_ledger_user_created_idx/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.xeomx_cancel_generation_job/);
  assert.match(sql, /v_actor UUID := \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /generation-cancel-release:/);
});

test("Request 7 migration keeps sensitive writes server-only and storage private", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of [
    "messages",
    "generation_jobs",
    "provider_requests",
    "assets",
    "generation_outputs",
    "usage_events",
    "credit_ledger",
    "audit_events",
  ]) {
    assert.doesNotMatch(
      sql,
      new RegExp(`GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*public\\.${table} TO authenticated`, "i"),
    );
  }

  for (const fn of [
    "xeomx_create_generation_job",
    "xeomx_record_unavailable_generation",
    "xeomx_start_generation_job",
    "xeomx_complete_generation_job",
    "xeomx_fail_generation_job",
  ]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}`));
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role;`),
    );
  }

  assert.match(sql, /'xeomx-assets',[\s\S]*?false,/);
  assert.match(sql, /bucket_id = 'xeomx-assets'/);
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = \(SELECT auth\.uid\(\)\)::text/);
  assert.doesNotMatch(sql, /service_role_key|authorization\s*[:=]\s*['"][A-Za-z0-9_-]{20}/i);
});
