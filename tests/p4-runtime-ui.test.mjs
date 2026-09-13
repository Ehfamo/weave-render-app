import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SupabaseP4Store } from "../src/lib/automation/runtime.server.ts";
import { p4IntentTarget } from "../src/lib/command-center/actions.ts";
test("Supabase adapter derives actor and role from authenticated server context", async () => {
  const calls = [];
  const q = {
    select() {
      return this;
    },
    eq(k, v) {
      calls.push([k, v]);
      return this;
    },
    maybeSingle: async () => ({ data: { role: "editor" }, error: null }),
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "server-user" } }, error: null }) },
    from: (n) => (calls.push(["table", n]), q),
  };
  const store = await SupabaseP4Store.create(client);
  assert.equal(store.actorId, "server-user");
  assert.equal(await store.role("project"), "editor");
  assert.deepEqual(calls.slice(-3), [
    ["table", "project_members"],
    ["project_id", "project"],
    ["user_id", "server-user"],
  ]);
});
test("Supabase adapter rejects missing auth and forged collaboration actors", async () => {
  await assert.rejects(
    () =>
      SupabaseP4Store.create({
        auth: { getUser: async () => ({ data: { user: null }, error: new Error("bad") }) },
      }),
    /AUTH_REQUIRED/,
  );
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "server-user" } }, error: null }) },
    from: () => ({}),
  };
  const store = await SupabaseP4Store.create(client);
  await assert.rejects(() => store.saveAssignment({ creatorId: "forged" }), /FORBIDDEN/);
  await assert.rejects(() => store.appendActivity({ actorId: "forged" }), /FORBIDDEN/);
});
test("adapter source has no service role secret and maps every P4 durable table", async () => {
  const s = await readFile(
    new URL("../src/lib/automation/runtime.server.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(s, /service.role|SERVICE_ROLE_KEY/);
  for (const n of [
    "workflow_definitions",
    "workflow_versions",
    "controlled_runs",
    "automation_events",
    "project_assignments",
    "project_collaboration_activity",
    "project_collaboration_comments",
  ])
    assert.match(s, new RegExp(n));
});
test("project operations UI is authenticated responsive RTL-aware and interactive", async () => {
  const [route, ui] = await Promise.all([
    readFile(
      new URL("../src/routes/_authenticated/project-operations.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/xeomx/team/ProjectOperations.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(route, /\/_authenticated\/project-operations/);
  for (const x of [
    'dir="auto"',
    "md:grid-cols",
    "overflow-x-auto",
    "aria-current",
    "aria-pressed",
    "min-h-11",
  ])
    assert.match(ui, new RegExp(x));
  assert.match(ui, /setCreating|setEnabled|setRan/);
});
test("all five locales retain exact P4 key parity", async () => {
  const locales = await Promise.all(
    ["en", "fa", "ar", "zh", "hi"].map(async (l) =>
      JSON.parse(await readFile(new URL(`../messages/${l}.json`, import.meta.url), "utf8")),
    ),
  );
  const keys = Object.keys(locales[0]).filter((k) => k.startsWith("p4_"));
  assert.ok(keys.length >= 16);
  for (const locale of locales)
    assert.deepEqual(
      Object.keys(locale)
        .filter((k) => k.startsWith("p4_"))
        .sort(),
      [...keys].sort(),
    );
});
test("Command Center P4 intents hand off to project operations", () => {
  assert.equal(p4IntentTarget("automation"), "/project-operations?tab=automations");
  assert.equal(p4IntentTarget("assignment"), "/project-operations?tab=tasks");
  assert.equal(p4IntentTarget("approval"), "/project-operations?tab=activity");
});
