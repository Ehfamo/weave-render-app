import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql = await readFile(
  new URL(
    "../supabase/migrations/20260912220000_p2_agent_approval_consumption.sql",
    import.meta.url,
  ),
  "utf8",
);
test("approval consumption is atomic exact scoped expiring and service only", () => {
  for (const token of [
    "consumed_at IS NULL",
    "ar.project_id=p_project_id",
    "ar.expires_at>now()",
    "r.state='queued'",
    "r.input->>'taskId'=p_task_id",
    "r.input->>'executionId'=p_execution_id",
    "r.input->>'stepId'=p_step_id",
    "r.input->>'toolId'=p_tool_id",
    "SERVICE_ROLE_REQUIRED",
    "TO service_role",
  ])
    assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC,anon,authenticated/i);
});
test("migration is additive and does not apply production changes", () => {
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
});
