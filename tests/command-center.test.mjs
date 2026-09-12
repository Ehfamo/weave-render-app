import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  ACTIONS,
  classifyIntent,
  isCommandShortcut,
  runAction,
} from "../src/lib/command-center/actions.ts";
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
test("Ctrl and Cmd K shortcuts ignore composition and unrelated keys", () => {
  const e = { key: "k", ctrlKey: true, metaKey: false, altKey: false };
  assert.ok(isCommandShortcut(e));
  assert.ok(isCommandShortcut({ ...e, ctrlKey: false, metaKey: true }));
  assert.ok(!isCommandShortcut({ ...e, isComposing: true }));
  assert.ok(!isCommandShortcut({ ...e, key: "x" }));
  assert.ok(!isCommandShortcut({ ...e, altKey: true }));
});
test("intent mapping is deterministic and does not execute actions", () => {
  assert.deepEqual(classifyIntent("Find my shoe campaign"), { query: "shoe campaign" });
  assert.equal(classifyIntent("Open my last project").action, "recentProject");
  assert.equal(classifyIntent("Create an ad for this product").action, "create");
  assert.equal(classifyIntent("Show recent generations").action, "generations");
  assert.equal(classifyIntent("آخرین پروژه").action, "recentProject");
});
test("canonical actions execute only selected handlers and resume authorized recent project", async () => {
  const calls = [];
  const h = {
    recent: "/workspace?projectId=known",
    navigate: (p) => calls.push(p),
    createProject: async () => {
      calls.push("create");
      return "/workspace?projectId=new";
    },
    search: () => calls.push("search"),
    more: () => calls.push("more"),
  };
  await runAction("recentProject", h);
  assert.deepEqual(calls, [h.recent]);
  await runAction("newProject", h);
  assert.deepEqual(calls.slice(1), ["create", "/workspace?projectId=new"]);
  await runAction("search", h);
  await runAction("more", h);
  assert.deepEqual(calls.slice(-2), ["search", "more"]);
  await assert.rejects(runAction("recentProject", { ...h, recent: undefined }), /UNAVAILABLE/);
  await assert.rejects(runAction("invalid", h), /UNKNOWN/);
});
test("action failures do not navigate and registry contains no provider execution", async () => {
  let navigated = false;
  await assert.rejects(
    runAction("newProject", {
      navigate: () => {
        navigated = true;
      },
      createProject: async () => {
        throw new Error("denied");
      },
      search: () => {},
      more: () => {},
    }),
  );
  assert.equal(navigated, false);
  assert.ok(!/groq|gemini|openai|agent/i.test(JSON.stringify(ACTIONS)));
});
test("command composition retains keyboard primitives RTL touch sizes and private query boundaries", async () => {
  const source = await read("src/components/xeomx/command-center/CommandCenter.tsx"),
    provider = await read("src/components/xeomx/os/GlobalLauncherProvider.tsx");
  for (const value of [
    "CommandInput",
    "CommandItem",
    "DialogTitle",
    "onCloseAutoFocus",
    "min-h-11",
    "85svh",
    "globalSearchFn",
    "user?.id",
    "gcTime: 0",
    "getLocale()",
    "rtl",
  ])
    assert.ok(source.includes(value), value);
  assert.ok(provider.includes("isCommandShortcut(event)"));
  assert.ok(provider.includes("data-command-trigger"));
  assert.ok(!source.includes("service_role"));
});
test("all five locale catalogs include the same real command labels", async () => {
  const catalogs = await Promise.all(
    ["en", "fa", "ar", "zh", "hi"].map(async (l) => JSON.parse(await read(`messages/${l}.json`))),
  );
  const keys = Object.keys(catalogs[0]).filter((k) => k.startsWith("cc_"));
  assert.equal(keys.length, 21);
  for (const c of catalogs) {
    assert.deepEqual(
      Object.keys(c)
        .filter((k) => k.startsWith("cc_"))
        .sort(),
      [...keys].sort(),
    );
    for (const k of keys) assert.ok(c[k].trim());
  }
});
