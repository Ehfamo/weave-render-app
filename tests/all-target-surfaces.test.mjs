import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const architecture = fs.readFileSync(path.join(root, "src/lib/product-architecture.ts"), "utf8");
const routeDir = path.join(root, "src/routes");

const targets = [
  ["/for-you", "for-you.tsx", "For You"],
  ["/models/fine-tune", "models.fine-tune.tsx", "Fine-tuning Studio"],
  ["/models/deployments", "models.deployments.tsx", "Model Deployment"],
  ["/create/dubbing", "create.dubbing.tsx", "Dubbing Studio"],
  ["/create/avatar", "create.avatar.tsx", "Avatar Studio"],
  ["/publish", "publish.tsx", "Publishing Center"],
  ["/build/database", "build.database.tsx", "Database Studio"],
  ["/build/git", "build.git.tsx", "Git & DevOps"],
  ["/agents/teams", "agents.teams.tsx", "Multi-Agent Teams"],
  ["/research/monitoring", "research.monitoring.tsx", "Research Monitoring"],
  ["/knowledge/graph", "knowledge.graph.tsx", "Knowledge Graph"],
  ["/data/annotation", "data.annotation.tsx", "Annotation Studio"],
  ["/data/synthetic", "data.synthetic.tsx", "Synthetic Data"],
  ["/evals/experiments", "evals.experiments.tsx", "A/B Testing"],
  ["/billing/disputes", "billing.disputes.tsx", "Refunds & Disputes"],
  ["/events", "events.tsx", "Events & Webinars"],
  ["/community/challenges", "community.challenges.tsx", "Challenges"],
  ["/security/supply-chain", "security.supply-chain.tsx", "Software Supply Chain Security"],
  ["/security/automation", "security.automation.tsx", "Security Automation"],
  ["/security/evidence", "security.evidence.tsx", "Security Evidence & Compliance"],
  ["/security/lab", "security.lab.tsx", "Security Lab / Sandbox"],
];

test("all 21 former non-P0 gaps have exact direct routes", () => {
  for (const [route, file] of targets) {
    const full = path.join(routeDir, file);
    assert.ok(fs.existsSync(full), `${file} must exist`);
    const source = fs.readFileSync(full, "utf8");
    assert.ok(source.includes(`createFileRoute("${route}")`), `${route} must be exact`);
  }
});

test("all 21 former non-P0 gaps have target-specific registered surfaces", () => {
  for (const [, , label] of targets) {
    assert.ok(architecture.includes(`"${label}"`), `${label} should be registered`);
  }
});

test("full UI closure preserves guarded dependency language", () => {
  for (const phrase of [
    "Permission-aware recommendations",
    "Provider capability",
    "Publish gate",
    "Migration preview",
    "Approval boundaries",
    "Evidence updates",
    "Control mapping",
    "Approval boundary",
  ]) {
    assert.ok(architecture.includes(phrase), `${phrase} must remain explicit`);
  }
});
