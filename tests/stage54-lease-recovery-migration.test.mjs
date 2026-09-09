import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260814193000_stage5_4_stale_generation_lease_recovery.sql",
    import.meta.url,
  ),
  "utf8",
);
const worker = await readFile(
  new URL("../supabase/functions/xeomx-generation-worker/index.ts", import.meta.url),
  "utf8",
);

test("stale running generation jobs have a partial-indexed lease recovery path", () => {
  assert.match(migration, /generation_jobs_running_started_at_idx/i);
  assert.match(migration, /where status = 'running'/i);
  assert.match(migration, /for update skip locked/i);
});

test("lease recovery fails stale work closed through the canonical failure RPC", () => {
  assert.match(migration, /xeomx_fail_generation_job\(/i);
  assert.match(migration, /'GENERATION_FAILED'/i);
  assert.match(migration, /generation worker lease expired; retry safely/i);
  assert.doesNotMatch(migration, /set\s+status\s*=\s*'queued'/i);
});

test("lease recovery is fixed-path and service-role only", () => {
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    migration,
    /revoke all on function public\.xeomx_fail_stale_generation_jobs\(integer, integer\)[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.xeomx_fail_stale_generation_jobs\(integer, integer\)[\s\S]*to service_role/i,
  );
});

test("lease recovery validates bounded timeout and batch size", () => {
  assert.match(migration, /p_lease_seconds < 60/i);
  assert.match(migration, /p_lease_seconds > 3600/i);
  assert.match(migration, /p_limit < 1/i);
  assert.match(migration, /p_limit > 100/i);
});

test("generation worker performs stale-lease cleanup before claiming queued work", () => {
  const recoveryCall = worker.indexOf("xeomx_fail_stale_generation_jobs");
  const queuedQuery = worker.search(/\.eq\([\"']status[\"'],\s*[\"']queued[\"']\)/);
  assert.ok(recoveryCall >= 0);
  assert.ok(queuedQuery > recoveryCall);
  assert.match(worker, /p_lease_seconds: 600/);
  assert.match(worker, /p_limit: 25/);
});
