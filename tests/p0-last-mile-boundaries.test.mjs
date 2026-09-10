import assert from "node:assert/strict";
import { test } from "node:test";
import { selectDiscoveryRows } from "../src/lib/discovery.ts";
import { getClientPolicyHint, recentNavigation } from "../src/lib/navigation-policy.ts";
import { createEmptyProjectContext, recordProjectHandoff } from "../src/lib/project-context.ts";

test("discovery removes unknown and repeated references without mutating source rails", () => {
  const rows = [
    { title: "samples", ids: ["known", "missing", "known"] },
    { title: "empty", ids: ["absent"] },
  ];
  assert.deepEqual(selectDiscoveryRows([{ id: "known" }], rows), [
    { title: "samples", ids: ["known"] },
  ]);
  assert.deepEqual(rows[0].ids, ["known", "missing", "known"]);
});

test("recent navigation excludes external URLs, arbitrary actions and malformed storage", () => {
  assert.deepEqual(
    recentNavigation([
      "https://other.test",
      "javascript:alert(1)",
      "/data",
      "/data",
      "/legal",
      { to: "/inbox" },
    ]),
    ["/data", "/legal"],
  );
  assert.deepEqual(recentNavigation({ data: "/data" }), []);
  for (const state of ["live", "beta", "preview", "planned", "unavailable"]) {
    assert.equal(getClientPolicyHint(state).executionAuthorized, false);
  }
});

test("navigation handoff retains opaque project references and leaves previous context intact", () => {
  const initial = { ...createEmptyProjectContext(), projectId: "project-a", assetIds: ["asset-a"] };
  const next = recordProjectHandoff(initial, {
    environment: "evidence",
    view: "datasets",
    at: "2026-09-10T00:00:00Z",
  });
  assert.equal(next.projectId, "project-a");
  assert.deepEqual(next.assetIds, ["asset-a"]);
  assert.equal(initial.lastLocation, null);
  assert.throws(() =>
    recordProjectHandoff(initial, {
      environment: "",
      view: "datasets",
      at: "2026-09-10T00:00:00Z",
    }),
  );
});
