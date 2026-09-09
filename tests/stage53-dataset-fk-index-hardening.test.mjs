import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260814202500_stage53_dataset_fk_index_hardening.sql",
  import.meta.url,
);

test("Stage 5.3 covers both composite Dataset/Evals foreign keys", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(
    sql,
    /CREATE INDEX dataset_versions_dataset_project_idx\s+ON public\.dataset_versions\(dataset_id, project_id\);/i,
  );
  assert.match(
    sql,
    /CREATE INDEX dataset_items_version_dataset_project_idx\s+ON public\.dataset_items\(dataset_version_id, dataset_id, project_id\);/i,
  );
  assert.doesNotMatch(sql, /^\s*(?:BEGIN|COMMIT);\s*$/im);
  assert.doesNotMatch(sql, /DROP\s+|TRUNCATE\s+|DELETE\s+FROM/i);
});
