import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SystemState } from "../../src/components/xeomx/os/SystemState.tsx";
import { PermissionPreviewPanel } from "../../src/components/xeomx/product/PermissionPreviewPanel.tsx";
import { JobStatusPanel } from "../../src/components/xeomx/product/JobStatusPanel.tsx";
import { FeatureStatusBadge } from "../../src/components/xeomx/status/FeatureStatusBadge.tsx";
import { FEATURES } from "../../src/lib/feature-status.ts";

const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const loading = render(SystemState, {
  variant: "loading",
  title: "Loading",
  description: "Please wait",
});
assert.match(loading, /aria-busy="true"/);
assert.match(loading, /role="status"/);
const failure = render(SystemState, {
  variant: "error",
  title: "Failure",
  description: "Try again",
});
assert.match(failure, /role="alert"/);

const permission = render(PermissionPreviewPanel, {
  target: "Project",
  action: "Run",
  scopes: ["write"],
  consequence: "Changes content",
  reversible: true,
});
assert.match(permission, /data-decision="unavailable"/);
assert.match(permission, /<button[^>]*disabled/);
assert.doesNotMatch(permission, /data-decision="allowed"/);

const job = render(JobStatusPanel, { capability: "generation-jobs" });
assert.doesNotMatch(job, /<time|role="progressbar"/);
assert.match(job, /Unavailable/);
for (const [state, label] of [
  ["mock", "Sample"],
  ["planned", "Planned"],
  ["unavailable", "Unavailable"],
]) {
  assert.match(render(FeatureStatusBadge, { status: state }), new RegExp(label));
}
for (const feature of Object.values(FEATURES)) {
  if (["planned", "mock", "unavailable"].includes(feature.status))
    assert.equal(feature.allowPrimaryAction, false);
}
console.log(
  "PASS: status accessibility, truthful job absence, permission denial, release labels and planned action gating",
);
