import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814201000_stage53_agents_workflows_control_plane.sql",
  import.meta.url,
);

const tables = [
  "agents",
  "agent_versions",
  "workflow_definitions",
  "workflow_versions",
  "controlled_runs",
  "approval_requests",
];

const privateHelpers = [
  ["xeomx_json_has_sensitive_key", "JSONB"],
  ["xeomx_valid_opaque_refs", "TEXT\\[\\]"],
  ["xeomx_definition_guard", ""],
  ["xeomx_controlled_run_guard", ""],
  ["xeomx_create_run_approval", ""],
  ["xeomx_approval_guard", ""],
  ["xeomx_apply_approval", ""],
  ["xeomx_close_pending_approval", ""],
  ["xeomx_control_plane_audit", ""],
];

test("Stage 5.3 creates six durable RLS-protected control-plane tables", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /^-- XEOMX Stage 5\.3/);
  assert.doesNotMatch(sql, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table} \\(`));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated;`),
    );
  }
});

test("risk and state constraints encode R0/R1 allowlists, R2 approval and R3 denial", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /'project\.read', 'dataset\.read', 'search\.read', 'evidence\.read'/);
  assert.match(sql, /'sandbox\.echo', 'sandbox\.transform', 'draft\.write', 'temporary\.create'/);
  assert.match(sql, /'credential\.use', 'external\.write', 'member\.change', 'billing\.change'/);
  assert.match(
    sql,
    /'external\.irreversible', 'production\.deploy', 'payment\.charge', 'data\.delete'/,
  );
  assert.match(sql, /NEW\.risk_tier = 'R2'[\s\S]*NEW\.state := 'awaiting_approval'/);
  assert.match(sql, /NEW\.risk_tier = 'R3'|ELSIF NEW\.risk_tier = 'R2'/);
  assert.match(sql, /NEW\.state := 'denied';[\s\S]*NEW\.failure_code := 'R3_DEFAULT_DENY'/);
  assert.match(sql, /IF OLD\.risk_tier = 'R3' OR OLD\.state = 'denied'/);
});

test("R2 cannot queue before an exact project-owner approval", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /v_approval\.status <> 'approved'/);
  assert.match(sql, /v_approval\.decided_by IS DISTINCT FROM v_owner/);
  assert.match(sql, /APPROVAL_EXACT_PROJECT_OWNER_REQUIRED/);
  assert.match(sql, /p\.owner_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /approval_requests_exact_owner_update/);
  assert.doesNotMatch(sql, /GRANT INSERT[^;]*approval_requests TO authenticated/i);
});

test("idempotency, opaque references, secret rejection and audits are durable", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /UNIQUE \(requested_by, idempotency_key\)/);
  assert.match(sql, /request_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /\^cred_\[A-Za-z0-9_-\]\{8,120\}\$/);
  assert.match(sql, /CONTROL_PLANE_SECRET_REJECTED/);
  assert.match(sql, /INSERT INTO public\.audit_events/);
  assert.doesNotMatch(sql, /jsonb_build_object\([^;]*(?:input|result|credential_refs)/i);
});

test("all foreign keys have intentional covering indexes", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const index of [
    "agents_project_idx",
    "agents_owner_idx",
    "agent_versions_agent_idx",
    "agent_versions_created_by_idx",
    "workflow_definitions_project_idx",
    "workflow_definitions_owner_idx",
    "workflow_versions_workflow_idx",
    "workflow_versions_created_by_idx",
    "controlled_runs_project_created_idx",
    "controlled_runs_requested_by_idx",
    "controlled_runs_agent_version_idx",
    "controlled_runs_workflow_version_idx",
    "approval_requests_project_idx",
    "approval_requests_requested_by_idx",
    "approval_requests_decided_by_idx",
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX ${index}`));
  }
  assert.match(sql, /run_id UUID NOT NULL UNIQUE REFERENCES/);
});

test("private trigger helpers are never executable by authenticated clients", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION private\.[^;]+ TO authenticated;/i);
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.[\s\S]*SECURITY DEFINER/i);
  for (const [name, signature] of privateHelpers) {
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION private\\.${name}\\(${signature}\\) FROM PUBLIC, anon, authenticated;`,
      ),
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION private\\.${name}\\(${signature}\\) TO service_role;`),
    );
  }
});

test("authenticated mutations remain narrow and RLS ownership-bound", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /GRANT UPDATE \(state\) ON public\.controlled_runs TO authenticated;/);
  assert.match(
    sql,
    /GRANT UPDATE \(status, decision_reason\) ON public\.approval_requests TO authenticated;/,
  );
  assert.doesNotMatch(sql, /GRANT ALL[^;]* TO authenticated/i);
  assert.match(sql, /public\.xeomx_project_role\(project_id\) IN \('owner', 'editor'\)/);
  assert.match(sql, /WITH CHECK \([\s\S]*requested_by = \(SELECT auth\.uid\(\)\)/);
});
