import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814202000_stage53_dataset_evals_foundation.sql",
  import.meta.url,
);

const tables = [
  "datasets",
  "dataset_versions",
  "dataset_items",
  "eval_definitions",
  "experiments",
  "benchmarks",
  "eval_runs",
  "benchmark_results",
  "evidence_records",
  "evidence_links",
  "evidence_provenance",
];

const triggerHelpers = [
  "xeomx_evidence_set_updated_at",
  "xeomx_evidence_guard_identity",
  "xeomx_evidence_guard_dataset_version",
  "xeomx_evidence_guard_dataset_item",
  "xeomx_evidence_guard_eval_run",
  "xeomx_evidence_guard_experiment",
  "xeomx_evidence_guard_record",
  "xeomx_evidence_reject_append_only_change",
  "xeomx_evidence_audit_change",
];

test("Stage 5.3 evidence migration is apply_migration-owned and additive", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(sql, /^\s*BEGIN;|COMMIT;\s*$/im);
  assert.doesNotMatch(sql, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+public\./i);
  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table} \\(`, "i"));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, "i"));
  }
});

test("all browser-visible writes have explicit RLS checks and no anonymous grants", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /FOR INSERT TO authenticated WITH CHECK/gi);
  assert.match(sql, /FOR UPDATE TO authenticated USING[\s\S]*?WITH CHECK/gi);
  assert.match(sql, /pm\.user_id = \(SELECT auth\.uid\(\)\)/i);
  assert.match(sql, /pm\.role IN \('owner', 'editor'\)/i);
  assert.match(sql, /REVOKE ALL ON public\.datasets[\s\S]*?FROM PUBLIC, anon, authenticated;/i);
  assert.doesNotMatch(sql, /GRANT\s+(SELECT|INSERT|UPDATE|DELETE)[^;]*\sTO anon/i);
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY/i);
});

test("trigger helpers are fixed-path, service-only SECURITY DEFINER functions", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const helper of triggerHelpers) {
    assert.match(
      sql,
      new RegExp(
        `CREATE OR REPLACE FUNCTION public\\.${helper}\\(\\)[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`,
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${helper}\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated;`,
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${helper}\\(\\) TO service_role;`, "i"),
    );
    assert.doesNotMatch(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${helper}\\(\\)[^;]*authenticated`, "i"),
    );
  }
});

test("version, result, link and provenance immutability fail closed", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /OLD\.state IN \('valid', 'invalid', 'failed'\)/i);
  assert.match(sql, /XEOMX_DATASET_VERSION_IMMUTABLE/i);
  assert.match(sql, /XEOMX_EVAL_RUN_IMMUTABLE/i);
  assert.match(sql, /XEOMX_EVIDENCE_RECORD_IMMUTABLE/i);
  assert.match(sql, /benchmark_results_append_only/i);
  assert.match(sql, /evidence_links_append_only/i);
  assert.match(sql, /evidence_provenance_append_only/i);
  assert.match(sql, /evidence\.['"]? \|\| TG_TABLE_NAME|evidence\.' \|\| TG_TABLE_NAME/i);
});

test("recursive SQL boundary rejects secret-like JSON keys on every JSON surface", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /WITH RECURSIVE walk\(value\)/i);
  assert.match(sql, /xeomx_evidence_json_has_secret_key\(p_value JSONB\)/i);
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /'servicerolekey'/i);
  assert.match(sql, /'privatekey'/i);
  assert.match(sql, /'password'/i);
  assert.match(sql, /'accesstoken'/i);
  assert.match(sql, /'authorization'/i);
  assert.match(sql, /'webhooksignature'/i);
  for (const column of [
    "metadata",
    "schema_definition",
    "validation_summary",
    "input",
    "expected_output",
    "validation_errors",
    "config",
    "control_config",
    "candidate_config",
    "summary",
    "metrics",
    "payload",
  ]) {
    assert.match(sql, new RegExp(`xeomx_evidence_json_has_secret_key\\(${column}\\)`, "i"));
  }
});

test("provider compute is disconnected until verified and FK paths are indexed", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /XEOMX_PROVIDER_COMPUTE_DISCONNECTED/i);
  assert.match(sql, /NEW\.provider_status <> 'verified'/i);
  assert.match(sql, /compute_mode = 'provider' AND provider_status = 'disconnected'/i);
  assert.doesNotMatch(
    sql,
    /FOR INSERT TO authenticated WITH CHECK[\s\S]*?compute_mode = 'provider'[\s\S]*?provider_status = 'verified'/i,
  );
  for (const index of [
    "dataset_versions_dataset_created_idx",
    "dataset_items_version_idx",
    "benchmarks_dataset_version_idx",
    "benchmarks_eval_definition_idx",
    "eval_runs_definition_idx",
    "eval_runs_dataset_version_idx",
    "benchmark_results_benchmark_idx",
    "benchmark_results_eval_run_idx",
    "evidence_links_record_idx",
    "evidence_provenance_record_idx",
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX ${index}`, "i"));
  }
});

test("eval run constraints have non-colliding explicit names", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CONSTRAINT eval_runs_experiment_arm_presence_check CHECK/i);
  assert.equal((sql.match(/CONSTRAINT eval_runs_experiment_arm_presence_check/gi) ?? []).length, 1);
});

test("dataset item admission locks the version against concurrent finalization", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const guard = sql.match(
    /CREATE OR REPLACE FUNCTION public\.xeomx_evidence_guard_dataset_item\(\)[\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(guard);
  assert.match(
    guard,
    /FROM public\.dataset_versions AS dv[\s\S]*?WHERE dv\.id = v_version_id[\s\S]*?FOR SHARE;/,
  );
});

test("migration contains no credential values or broad authenticated result writes", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(
    sql,
    /service[_-]?role[_-]?key\s*[:=]|api[_-]?key\s*[:=]|bearer\s+[a-z0-9._-]{16,}/i,
  );
  assert.doesNotMatch(sql, /GRANT\s+(?:ALL|UPDATE|DELETE)[^;]*benchmark_results TO authenticated/i);
  assert.doesNotMatch(
    sql,
    /GRANT\s+(?:ALL|UPDATE|DELETE)[^;]*evidence_provenance TO authenticated/i,
  );
});
