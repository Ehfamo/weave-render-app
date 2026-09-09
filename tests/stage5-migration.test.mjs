import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814120000_stage5_rls_and_fk_index_hardening.sql",
  import.meta.url,
);

test("Stage 5 migration adds the three missing foreign-key indexes", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const [index, table, column] of [
    ["credit_ledger_project_id_idx", "credit_ledger", "project_id"],
    ["generation_jobs_input_message_id_idx", "generation_jobs", "input_message_id"],
    ["usage_events_provider_request_id_idx", "usage_events", "provider_request_id"],
  ]) {
    assert.match(
      sql,
      new RegExp(
        `create index if not exists ${index}\\s+on public\\.${table} \\(\\s*${column}\\s*\\)`,
        "i",
      ),
    );
  }
});

test("Stage 5 migration preserves RLS and narrows policy roles", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /for select to anon/i);
  assert.match(sql, /for select to authenticated/i);
  assert.match(sql, /\(select auth\.uid\(\)\)/i);
  assert.match(sql, /is_public = true or \(select auth\.uid\(\)\) = owner_id/i);
  assert.match(sql, /is_published = true or \(select auth\.uid\(\)\) = author_id/i);
  assert.doesNotMatch(sql, /disable row level security/i);
  assert.doesNotMatch(sql, /to public[\s\S]*?(insert|update|delete)/i);
  assert.doesNotMatch(sql, /grant\s+(all|insert|update|delete)/i);
});

test("Stage 5 migration is transactional and non-destructive to data", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.ok(sql.trimStart().startsWith("-- XEOMX Stage 5"));
  assert.match(sql, /begin;/i);
  assert.ok(sql.trimEnd().endsWith("commit;"));
  assert.doesNotMatch(sql, /drop\s+table|truncate|delete\s+from/i);
});
