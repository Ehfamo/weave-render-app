import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UX_JOURNEYS, journeyMetrics, PRIMARY_NAV_DESTINATIONS } from "../src/lib/ux/journeys.ts";
import {
  permissionDiff,
  SURFACE_NEXT_ACTION,
  MARKETPLACE_STATUS_LABELS,
} from "../src/lib/ux/marketplace.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
test("universal goal input dominates home and normal flow requires no model or agent choice", async () => {
  const home = await read("src/components/xeomx/os/HomeExperience.tsx");
  assert.match(home, /universal-goal/);
  assert.match(home, /p8_goal_title/);
  assert.doesNotMatch(home, /providerId|modelId|requestedAgent/);
  assert.ok(home.indexOf("universal-goal") < home.indexOf("p8_continue"));
});
test("home is project-centered with continue recent and compact known context", async () => {
  const home = await read("src/components/xeomx/os/HomeExperience.tsx");
  for (const token of [
    "p8_using",
    "p8_project",
    "p8_character",
    "p8_format",
    "p8_continue",
    "p8_recent_projects",
  ])
    assert.match(home, new RegExp(token));
  assert.match(home, /<details/);
});
test("primary navigation has no feature sprawl", async () => {
  const header = await read("src/components/xeomx/Header.tsx");
  assert.deepEqual(PRIMARY_NAV_DESTINATIONS, ["projects", "marketplace"]);
  assert.doesNotMatch(
    header,
    /nav_feed|nav_collections|nav_creators|nav_studio|nav_magazine|nav_pricing/,
  );
  assert.match(header, /p8_command_center/);
});
test("journey inventory has zero dead ends and exceeds the eighty percent two-interaction gate", () => {
  const metrics = journeyMetrics();
  assert.equal(metrics.count, 30);
  assert.equal(metrics.deadEnds, 0);
  assert.equal(metrics.withinTwo, 29);
  assert.equal(metrics.percentWithinTwo, 97);
  assert.equal(new Set(UX_JOURNEYS.map((x) => x.id)).size, UX_JOURNEYS.length);
});
test("all operational surface states provide a next action", () => {
  assert.deepEqual(
    Object.keys(SURFACE_NEXT_ACTION).sort(),
    [
      "empty",
      "loading",
      "partial",
      "permission_denied",
      "recoverable_failure",
      "success",
      "terminal_failure",
      "unavailable",
    ].sort(),
  );
  assert.ok(Object.values(SURFACE_NEXT_ACTION).every(Boolean));
});
test("marketplace starts with a goal and exposes factual filters progressively", async () => {
  const ui = await read("src/components/xeomx/marketplace/MarketplaceWorkspace.tsx");
  assert.match(ui, /p8_market_goal/);
  for (const token of ["p8_category", "p8_price", "p8_compatibility", "p8_language"])
    assert.match(ui, new RegExp(token));
  assert.match(ui, /<details/);
});
test("listing shows trust permissions compatibility price provenance and honest runtime cost before acquire", async () => {
  const ui = await read("src/components/xeomx/marketplace/MarketplaceWorkspace.tsx");
  const acquire = ui.indexOf("p8_acquire");
  for (const token of [
    "p8_trust_permissions",
    "p8_can_read",
    "p8_external_approval",
    "p8_cannot_escalate",
    "p8_compatible",
    "p8_acquisition_price",
    "p8_runtime_varies",
    "p8_license",
    "p8_provenance",
  ])
    assert.ok(ui.indexOf(token) >= 0);
  assert.ok(ui.indexOf("p8_trust_permissions") < acquire);
  assert.doesNotMatch(ui, /security score|success rate|active installations/i);
});
test("permission updates identify consequential increases and require review", () => {
  const before = [{ id: "project.read", reason: "read", risk: "safe_read" }],
    after = [...before, { id: "email.send", reason: "send", risk: "external" }];
  assert.deepEqual(permissionDiff(before, after), [
    { id: "email.send", kind: "added", to: "external", requiresReview: true },
  ]);
});
test("marketplace readiness and trial controls invoke canonical services without fake install success", async () => {
  const ui = await read("src/components/xeomx/marketplace/MarketplaceWorkspace.tsx");
  for (const token of [
    "marketplaceReadinessFn",
    "marketplaceApproveFn",
    "marketplaceTrialFn",
    "p8_review_permissions",
    "fi4_no_install",
  ])
    assert.ok(ui.includes(token));
  assert.doesNotMatch(ui, /setAcquired\(true\)|setInstalled\(true\)/);
});
test("marketplace exposes truthful trials reviews moderation and maintenance without fabricated commerce", async () => {
  const ui = await read("src/components/xeomx/marketplace/MarketplaceWorkspace.tsx");
  for (const token of [
    "fi4_sample_notice",
    "p8_no_reviews",
    "fi4_moderation",
    "fi4_maintenance",
    "fi4_unknown",
  ])
    assert.ok(ui.includes(token));
  assert.doesNotMatch(ui, /setAcquired\(true\)|setInstalled\(true\)/);
  assert.deepEqual(MARKETPLACE_STATUS_LABELS, {
    draft: "Draft",
    validating: "Validating",
    invalid: "Needs fixes",
    review_required: "Under review",
    approved: "Approved",
    published: "Published",
    suspended: "Suspended",
    deprecated: "Deprecated",
  });
});
test("mobile RTL keyboard touch and semantic source gates cover primary UX", async () => {
  const [home, market, header] = await Promise.all([
    read("src/components/xeomx/os/HomeExperience.tsx"),
    read("src/components/xeomx/marketplace/MarketplaceWorkspace.tsx"),
    read("src/components/xeomx/Header.tsx"),
  ]);
  const source = home + market + header;
  assert.match(source, /dir="auto"/);
  assert.match(source, /rtl:rotate-180/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /sm:|lg:/);
  assert.match(source, /min-h-11/);
  assert.match(source, /focus-visible:ring/);
  assert.match(source, /aria-label|aria-labelledby/);
});
test("five locale catalogs retain exact P8 parity and native RTL labels", async () => {
  const names = ["en", "fa", "ar", "zh", "hi"],
    locales = await Promise.all(
      names.map(async (name) => JSON.parse(await read(`messages/${name}.json`))),
    );
  const keys = Object.keys(locales[0]).sort();
  for (const locale of locales) assert.deepEqual(Object.keys(locale).sort(), keys);
  const p8 = keys.filter((x) => x.startsWith("p8_"));
  assert.ok(p8.length >= 80);
  assert.equal(locales[1].p8_goal_title, "می‌خواهید چه کاری انجام دهید؟");
  assert.equal(locales[2].p8_goal_title, "ما الذي تريد إنجازه؟");
});
test("UX inventory preserves capability routes while removing them from primary navigation", async () => {
  const inventory = await read("docs/P8_UX_SURFACE_INVENTORY.md");
  assert.match(inventory, /HIDE_BEHIND_CONTEXT/);
  assert.match(inventory, /REMOVE_FROM_PRIMARY_NAV/);
  assert.match(inventory, /remain intact/);
});
