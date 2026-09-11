import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
const sql = await readFile(
  new URL("../supabase/migrations/20260912000000_p1_memory_core.sql", import.meta.url),
  "utf8",
);
test("memory migration protects both tables and uses caller RLS for RPC", () => {
  for (const table of ["xeomx_memories", "xeomx_memory_settings"])
    assert.ok(sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`));
  assert.ok(!sql.includes("SECURITY DEFINER"));
  for (const marker of [
    "WITH CHECK (user_id=(SELECT auth.uid())",
    "v.id=c AND v.project_id=p",
    "public.xeomx_project_role(p) IS NOT NULL",
    "REVOKE ALL ON FUNCTION public.xeomx_memory(text,jsonb) FROM PUBLIC, anon",
    "AND s.enabled",
    "DEFAULT false",
    "source ? 'kind'",
    "jsonb_typeof(source->'kind') = 'string'",
  ])
    assert.ok(sql.includes(marker), marker);
});
test("memory migration preserves immutable ownership/provenance and existing domain entities", () => {
  for (const marker of [
    "NEW.user_id",
    "NEW.project_id",
    "NEW.conversation_id",
    "NEW.source",
    "NEW.created_at",
    "BEFORE UPDATE",
    "ON DELETE CASCADE",
    "CREATE INDEX xeomx_memory_owner_scope_idx",
    "DELETE FROM public.xeomx_memories",
  ])
    assert.ok(sql.includes(marker), marker);
  assert.ok(!/CREATE TABLE public\.(projects|conversations|profiles)\b/.test(sql));
  assert.ok(!/DROP TABLE|DISABLE ROW LEVEL SECURITY/.test(sql));
});
