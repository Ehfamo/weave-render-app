import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  sanitizeSearchTerm,
  searchCatalogPlan,
  uniqueSearchRows,
} from "../src/lib/search-contract.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260814200000_stage53_project_update_audit.sql",
  import.meta.url,
);

test("search planning is Unicode-safe, bounded and wildcard-neutral", () => {
  assert.deepEqual(searchCatalogPlan("  prompt   design  "), {
    term: "prompt design",
    enabled: true,
    pattern: "%prompt design%",
    category: null,
    categoryScoped: false,
  });
  assert.equal(searchCatalogPlan("پرامپت فارسی").enabled, true);
  assert.equal(searchCatalogPlan("بحث عربي").enabled, true);
  assert.equal(searchCatalogPlan("_100%_ test").term, "100 test");
  assert.equal(searchCatalogPlan("x").enabled, false);
  assert.equal(searchCatalogPlan("  ").enabled, false);
  assert.equal(sanitizeSearchTerm("z".repeat(140)).length, 120);
  assert.equal(searchCatalogPlan("image", "All").categoryScoped, false);
  assert.deepEqual(searchCatalogPlan("image", "Portrait"), {
    term: "image",
    enabled: true,
    pattern: "%image%",
    category: "Portrait",
    categoryScoped: true,
  });
});

test("search aggregation removes duplicates without inventing empty results", () => {
  const rows = [
    { id: "a", title: "first" },
    { id: "b", title: "second" },
    { id: "a", title: "newer duplicate" },
  ];
  assert.deepEqual(
    uniqueSearchRows(rows, (row) => row.id),
    [
      { id: "a", title: "newer duplicate" },
      { id: "b", title: "second" },
    ],
  );
  assert.deepEqual(
    uniqueSearchRows([], (row) => row.id),
    [],
  );
});

test("project update audit is trigger-only, fixed-path and privacy-safe", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.xeomx_audit_project_update\(\)/i);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.xeomx_audit_project_update\(\)\s+FROM PUBLIC, anon, authenticated/i,
  );
  assert.match(
    sql,
    /AFTER UPDATE OF name, description, status, default_routing_mode, default_model/i,
  );
  assert.match(sql, /'project\.updated'/i);
  assert.match(sql, /'changed_fields'/i);
  assert.doesNotMatch(sql, /service[_-]?role[_-]?key|api[_-]?key|password|secret\s*=/i);
});
