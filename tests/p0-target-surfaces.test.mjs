import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const architecture = fs.readFileSync(path.join(root, "src/lib/product-architecture.ts"), "utf8");
const routeDir = path.join(root, "src/routes");

const targets = [
  ["/inbox", "inbox.tsx"],
  ["/context", "context.tsx"],
  ["/models/registry", "models.registry.tsx"],
  ["/provenance", "provenance.tsx"],
  ["/build/backend", "build.backend.tsx"],
  ["/operator", "operator.tsx"],
  ["/tools", "tools.tsx"],
  ["/agents/registry", "agents.registry.tsx"],
  ["/agents/runtime", "agents.runtime.tsx"],
  ["/agents/observability", "agents.observability.tsx"],
  ["/data", "data.tsx"],
  ["/evals", "evals.tsx"],
  ["/observability", "observability.tsx"],
  ["/evals/registry", "evals.registry.tsx"],
  ["/org/admin", "org.admin.tsx"],
  ["/integrations", "integrations.tsx"],
  ["/legal", "legal.tsx"],
];

test("all 17 P0 target routes exist with exact route declarations", () => {
  for (const [route, file] of targets) {
    const full = path.join(routeDir, file);
    assert.ok(fs.existsSync(full), `${file} must exist`);
    const source = fs.readFileSync(full, "utf8");
    assert.match(
      source,
      new RegExp(`createFileRoute\\(\\"${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\"\\)`),
    );
  }
});

test("four formerly missing P0 product surfaces are now registered", () => {
  for (const label of [
    "Content Authenticity",
    "Operator / Computer Use",
    "Sandbox & Runtime",
    "Dataset Studio",
  ]) {
    assert.ok(architecture.includes(`\"${label}\"`), `${label} should be registered`);
  }
});

test("P0 partial targets receive distinct target-specific surfaces", () => {
  for (const label of [
    "Inbox",
    "Personal Context Center",
    "Model Registry & Governance",
    "Backend Platform",
    "MCP & Tools Hub",
    "Agent Registry",
    "Agent Observability",
    "Evals Lab",
    "Traces & Observability",
    "Eval Registry & Lineage",
    "Admin Center",
    "Integrations Hub",
  ]) {
    assert.ok(architecture.includes(`\"${label}\"`), `${label} should be registered`);
  }
  const legal = fs.readFileSync(
    path.join(root, "src/components/xeomx/product/LegalHubPage.tsx"),
    "utf8",
  );
  for (const route of ["/terms", "/privacy", "/cookies", "/refund-policy"])
    assert.ok(legal.includes(route));
});

test("high-risk P0 surfaces retain approval or policy boundaries", () => {
  for (const phrase of [
    "Sensitive-action approval",
    "Kill switch",
    "Scope disclosure",
    "Destructive change approval",
    "Audit changes",
  ]) {
    assert.ok(architecture.includes(phrase), `${phrase} must remain explicit`);
  }
});
