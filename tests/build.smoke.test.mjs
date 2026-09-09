import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertNonEmptyFile(filePath) {
  const fileStats = await stat(filePath);

  assert.equal(fileStats.isFile(), true, `${filePath} must be a file`);
  assert.ok(fileStats.size > 0, `${filePath} must not be empty`);
}

test("the Cloudflare build emits a deployable Worker package", async () => {
  const outputRoot = resolve(repositoryRoot, ".output");
  const nitroMetadataPath = resolve(outputRoot, "nitro.json");
  const deployConfigPath = resolve(repositoryRoot, ".wrangler/deploy/config.json");

  const nitroMetadata = await readJson(nitroMetadataPath);
  assert.equal(nitroMetadata.preset, "cloudflare-module");
  await assertNonEmptyFile(resolve(outputRoot, nitroMetadata.serverEntry));

  const deployConfig = await readJson(deployConfigPath);
  const workerConfigPath = resolve(dirname(deployConfigPath), deployConfig.configPath);
  const workerConfig = await readJson(workerConfigPath);

  assert.equal(workerConfig.name, "weave-render-app");
  await assertNonEmptyFile(resolve(dirname(workerConfigPath), workerConfig.main));

  const assetDirectory = resolve(dirname(workerConfigPath), workerConfig.assets.directory);
  const assetNames = await readdir(resolve(assetDirectory, "assets"));

  assert.ok(assetNames.some((name) => name.endsWith(".js")));
  assert.ok(assetNames.some((name) => name.endsWith(".css")));
  await assertNonEmptyFile(resolve(assetDirectory, "_headers"));
});
