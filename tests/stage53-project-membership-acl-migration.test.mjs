import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814200500_stage53_project_membership_acl_hardening.sql",
  import.meta.url,
);

test("authenticated membership mutation privileges are removed while RLS read remains", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(
    sql,
    /REVOKE INSERT, UPDATE, DELETE ON public\.project_members\s+FROM PUBLIC, anon, authenticated;/i,
  );
  assert.match(sql, /GRANT SELECT ON public\.project_members TO authenticated;/i);
  assert.doesNotMatch(sql, /^\s*(?:BEGIN|COMMIT);\s*$/im);
  assert.doesNotMatch(sql, /DROP\s+|TRUNCATE\s+|DELETE\s+FROM/i);
});
