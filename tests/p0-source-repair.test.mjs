import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("reconstructed P0 status components render with fail-closed controls", () => {
  const result = spawnSync(
    process.execPath,
    ["--loader", "./tests/helpers/p0-source-loader.mjs", "./tests/helpers/p0-source-render.mjs"],
    { cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS:/);
});

test("catalog filters quote user syntax and retain public-query boundaries", async () => {
  const { promptSearchFilter, searchCatalogPlan } = await import("../src/lib/search-contract.ts");
  const pattern = searchCatalogPlan('hello\",is_published.eq.false,description.ilike.\"*').pattern;
  const quoted = JSON.stringify(pattern);
  assert.equal(
    promptSearchFilter(pattern),
    ["title", "description", "body"].map((column) => `${column}.ilike.${quoted}`).join(","),
  );
  assert.equal(searchCatalogPlan("x").enabled, false);
  assert.equal(searchCatalogPlan("%_*").enabled, false);
});
