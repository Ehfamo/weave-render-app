import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/p0-full-validation.yml", import.meta.url),
  "utf8",
);
const matrix = workflow
  .split("      - name: Validation matrix\n")[1]
  .split("        run: |\n")[1]
  .split("\n")
  .map((line) => line.replace(/^          /, ""))
  .join("\n");
const required = [
  ...new Set([...matrix.matchAll(/steps\.(\w+)\.outcome/g)].map((match) => match[1])),
];
function evaluate(overrides = {}) {
  const rendered = matrix.replace(
    /\$\{\{ steps\.(\w+)\.outcome \}\}/g,
    (_, name) => overrides[name] ?? "success",
  );
  return spawnSync("bash", ["-e", "-o", "pipefail", "-c", rendered], { encoding: "utf8" });
}
test("matrix accepts all required successes and does not claim external verification", () => {
  assert.equal(required.length, 15);
  const result = evaluate();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /SOURCE_VALIDATION=PASS/);
  assert.match(result.stdout, /EXTERNAL_VALIDATION=SEPARATE_NOT_PROVEN/);
});
test("every required gate fails closed for failure, cancellation, skipped and missing outcomes", () => {
  for (const gate of required) {
    for (const outcome of ["failure", "cancelled", "skipped", "", "unknown"]) {
      assert.notEqual(evaluate({ [gate]: outcome }).status, 0, `${gate}:${outcome}`);
    }
  }
});
test("source audit resolves dotted modules and ignores import text inside comments", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xeomx-source-audit-"));
  try {
    fs.mkdirSync(path.join(dir, "src"));
    for (const name of [
      "core-workflows.ts",
      "platform-contracts.ts",
      "product-architecture.ts",
      "ProductWorkspacePreview.tsx",
      "routeTree.gen.ts",
      "client.server.ts",
    ])
      fs.writeFileSync(path.join(dir, "src", name), "");
    const entry = path.join(dir, "src", "index.ts");
    fs.writeFileSync(entry, 'import "./client.server";\n// import "./missing-comment";\n');
    const run = () =>
      spawnSync(
        process.execPath,
        [new URL("../scripts/p0-source-audit.mjs", import.meta.url).pathname],
        { cwd: dir, encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    fs.appendFileSync(entry, 'import "./truly-missing";');
    assert.notEqual(run().status, 0);
    fs.writeFileSync(entry, 'import "./client.server";');
    fs.writeFileSync(path.join(dir, "src", "client.server.ts"), 'import "./index";');
    assert.notEqual(run().status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
