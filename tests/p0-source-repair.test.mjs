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
