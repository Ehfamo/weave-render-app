import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql = await readFile(
  new URL("../supabase/migrations/20260913000000_p4_automation_collaboration.sql", import.meta.url),
  "utf8",
);
test("P4 reuses canonical workflow run approval project and membership tables", () => {
  for (const x of [
    "controlled_runs",
    "approval_requests",
    "workflow_definitions",
    "project_members",
  ])
    assert.match(sql, new RegExp(x));
  assert.doesNotMatch(sql, /CREATE TABLE public\.approval_requests/);
});
test("P4 durable state is additive indexed and RLS protected", () => {
  for (const x of [
    "automation_run_steps",
    "automation_events",
    "project_assignments",
    "project_collaboration_activity",
    "project_collaboration_comments",
  ])
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${x} ENABLE ROW LEVEL SECURITY`));
  assert.match(sql, /UNIQUE\(workflow_id,event_key\)/);
  assert.match(sql, /REFERENCES public\.projects/);
});
test("browser writes are narrow and membership scoped", () => {
  assert.doesNotMatch(sql, /GRANT (ALL|UPDATE|DELETE).* TO authenticated/);
  assert.match(sql, /author_id=auth\.uid\(\)/);
  assert.match(sql, /m\.user_id=auth\.uid\(\)/);
});
