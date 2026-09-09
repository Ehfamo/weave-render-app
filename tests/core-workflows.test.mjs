import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  CORE_WORKFLOWS,
  EVIDENCE_SOURCE_CLASSES,
  EVENT_CORE_PHASES,
  createWorkflowRuntimeSnapshot,
  routeProviderCandidate,
  transitionWorkflow,
} from "../src/lib/core-workflows.ts";
import { PRODUCT_ENVIRONMENTS } from "../src/lib/product-architecture.ts";

test("all twenty core workflows have unique identities and real route targets", () => {
  assert.equal(CORE_WORKFLOWS.length, 20);
  assert.equal(new Set(CORE_WORKFLOWS.map(({ id }) => id)).size, 20);
  assert.equal(new Set(CORE_WORKFLOWS.map(({ key }) => key)).size, 20);
  assert.deepEqual(
    CORE_WORKFLOWS.map(({ id }) => id),
    Array.from({ length: 20 }, (_, index) => `W${String(index + 1).padStart(2, "0")}`),
  );

  const routeTargets = new Set(
    PRODUCT_ENVIRONMENTS.flatMap((environment) =>
      environment.subpages.map((subpage) => `${environment.id}/${subpage.key}`),
    ),
  );

  for (const workflow of CORE_WORKFLOWS) {
    assert.ok(workflow.stages.length >= 5, `${workflow.id} needs an actionable workflow`);
    assert.ok(workflow.recovery.length > 0, `${workflow.id} needs recovery`);
    assert.ok(
      routeTargets.has(`${workflow.entry.environment}/${workflow.entry.view}`),
      `${workflow.id} targets a missing product view`,
    );
    if (workflow.externalEffect === "destructive") {
      assert.equal(workflow.requiresApproval, true);
    }
  }
});

test("the event core preserves policy, audit and notification boundaries", () => {
  assert.deepEqual(EVENT_CORE_PHASES, [
    "event",
    "policy",
    "workflow",
    "action",
    "audit",
    "notification",
  ]);

  let state = createWorkflowRuntimeSnapshot();
  assert.throws(() => transitionWorkflow(state, "START"), /Invalid workflow transition/);
  state = transitionWorkflow(state, "EVALUATE_POLICY");
  state = transitionWorkflow(state, "REQUIRE_APPROVAL");
  assert.equal(state.state, "awaiting-approval");
  assert.equal(state.executionConfirmed, false);
  state = transitionWorkflow(state, "ALLOW");
  state = transitionWorkflow(state, "START");
  state = transitionWorkflow(state, "REPORT_PARTIAL");
  assert.equal(state.state, "partial");
  state = transitionWorkflow(state, "COMPLETE");
  assert.equal(state.state, "completed");
  assert.equal(state.phase, "notification");
  assert.equal(state.executionConfirmed, true);
});

test("provider routing fails closed without verified capability evidence", () => {
  const candidates = [
    {
      id: "unverified-provider",
      capabilities: ["reasoning"],
      verifiedAvailable: true,
    },
    {
      id: "offline-provider",
      capabilities: ["reasoning"],
      verifiedAvailable: false,
      evidenceReference: "evidence-opaque",
    },
  ];

  assert.deepEqual(
    routeProviderCandidate({ mode: "auto", requiredCapabilities: ["reasoning"], candidates }),
    { state: "unavailable", reason: "NO_VERIFIED_CANDIDATE" },
  );

  assert.deepEqual(
    routeProviderCandidate({
      mode: "manual",
      requiredCapabilities: ["reasoning"],
      candidates,
      manualCandidateId: "unverified-provider",
    }),
    { state: "unavailable", reason: "MANUAL_SELECTION_UNAVAILABLE" },
  );

  const ready = routeProviderCandidate({
    mode: "pro",
    requiredCapabilities: ["reasoning", "tool-use"],
    candidates: [
      ...candidates,
      {
        id: "verified-provider",
        capabilities: ["reasoning", "tool-use"],
        verifiedAvailable: true,
        evidenceReference: "evidence-opaque",
      },
    ],
  });
  assert.deepEqual(ready, {
    state: "ready",
    candidateId: "verified-provider",
    mode: "pro",
  });
});

test("model evidence sources remain explicitly separated", () => {
  assert.deepEqual(EVIDENCE_SOURCE_CLASSES, [
    "official-benchmark",
    "xeomx-evaluation",
    "community-evaluation",
    "user-preference",
  ]);
});

test("home defers marketplace discovery and its heavy prompt-card dependency", async () => {
  const home = await readFile(
    new URL("../src/components/xeomx/os/HomeExperience.tsx", import.meta.url),
    "utf8",
  );
  const discovery = await readFile(
    new URL("../src/components/xeomx/os/HomeDiscoverySection.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(home.includes("lazy(() =>"));
  assert.ok(home.includes("IntersectionObserver"));
  assert.ok(!home.includes('from "@/components/xeomx/PromptCard"'));
  assert.ok(!home.includes('from "@/lib/discovery"'));
  assert.ok(discovery.includes('from "@/components/xeomx/PromptCard"'));
  assert.ok(discovery.includes('from "@/lib/discovery"'));
});
