import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const repositoryRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

function parseTypeScript(text, filename) {
  return ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function findVariable(file, name) {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return declaration;
    }
  }
  throw new Error(`Missing variable ${name}`);
}

function objectProperty(object, name) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ((ts.isIdentifier(candidate.name) && candidate.name.text === name) ||
        (ts.isStringLiteral(candidate.name) && candidate.name.text === name)),
  );
  assert.ok(property && ts.isPropertyAssignment(property), `Missing property ${name}`);
  return unwrap(property.initializer);
}

function stringValue(expression, label) {
  assert.ok(ts.isStringLiteral(expression), `${label} must be a string literal`);
  return expression.text;
}

function callName(expression) {
  const target = unwrap(expression);
  return ts.isCallExpression(target) && ts.isIdentifier(target.expression)
    ? target.expression.text
    : undefined;
}

async function readProductContract() {
  const text = await source("src/lib/product-architecture.ts");
  const file = parseTypeScript(text, "product-architecture.ts");
  const declaration = findVariable(file, "PRODUCT_ENVIRONMENTS");
  const initializer = unwrap(declaration.initializer);
  assert.ok(ts.isArrayLiteralExpression(initializer));

  const environments = [];
  let featureCount = 0;
  for (const element of initializer.elements) {
    assert.equal(callName(element), "product");
    const call = unwrap(element);
    const definition = unwrap(call.arguments[0]);
    assert.ok(ts.isObjectLiteralExpression(definition));
    const id = stringValue(objectProperty(definition, "id"), "environment id");
    const subpagesExpression = objectProperty(definition, "subpages");
    assert.ok(ts.isArrayLiteralExpression(subpagesExpression));
    const subpages = [];
    for (const item of subpagesExpression.elements) {
      assert.equal(callName(item), "view", `${id} subpages must use the shared view contract`);
      const viewCall = unwrap(item);
      const key = stringValue(unwrap(viewCall.arguments[0]), `${id} view key`);
      const label = stringValue(unwrap(viewCall.arguments[1]), `${id}/${key} label`);
      const state = stringValue(unwrap(viewCall.arguments[2]), `${id}/${key} state`);
      const dependency = unwrap(viewCall.arguments[3]);
      assert.ok(
        ts.isStringLiteral(dependency) || ts.isIdentifier(dependency),
        `${id}/${key} must declare a dependency`,
      );
      const features = unwrap(viewCall.arguments[4]);
      assert.ok(ts.isArrayLiteralExpression(features), `${id}/${key} must declare features`);
      assert.ok(features.elements.length > 0, `${id}/${key} must not be an empty shell`);
      featureCount += features.elements.length;
      subpages.push({ key, label, state });
    }
    environments.push({ id, subpages });
  }
  return { environments, featureCount, text };
}

test("the 25-environment product contract is complete and internally unique after the full target-surface closure wave", async () => {
  const { environments, featureCount } = await readProductContract();
  assert.equal(environments.length, 25);
  assert.equal(new Set(environments.map(({ id }) => id)).size, 25);
  assert.equal(
    environments.reduce((total, environment) => total + environment.subpages.length, 0),
    295,
  );
  // Step 3 full closure adds 21 additional target-specific views after the P0 wave.
  assert.equal(featureCount, 927);
  for (const environment of environments) {
    assert.equal(
      new Set(environment.subpages.map(({ key }) => key)).size,
      environment.subpages.length,
      `${environment.id} has duplicate subpage keys`,
    );
  }
});

test("all twelve critical journeys point to real product views", async () => {
  const { environments } = await readProductContract();
  const validTargets = new Set(
    environments.flatMap((environment) =>
      environment.subpages.map((subpage) => `${environment.id}/${subpage.key}`),
    ),
  );
  const text = await source("src/lib/critical-journeys.ts");
  const file = parseTypeScript(text, "critical-journeys.ts");
  const declaration = findVariable(file, "CRITICAL_JOURNEYS");
  const initializer = unwrap(declaration.initializer);
  assert.ok(ts.isArrayLiteralExpression(initializer));
  assert.equal(initializer.elements.length, 12);

  const ids = [];
  for (const element of initializer.elements) {
    const journey = unwrap(element);
    assert.ok(ts.isObjectLiteralExpression(journey));
    const id = stringValue(objectProperty(journey, "id"), "journey id");
    ids.push(id);
    const steps = objectProperty(journey, "steps");
    assert.ok(ts.isArrayLiteralExpression(steps));
    assert.ok(steps.elements.length >= 3, `${id} must have an actionable path`);
    for (const item of steps.elements) {
      assert.equal(callName(item), "step");
      const stepCall = unwrap(item);
      const environment = stringValue(unwrap(stepCall.arguments[1]), `${id} environment`);
      const view = stringValue(unwrap(stepCall.arguments[2]), `${id} view`);
      const state = stringValue(unwrap(stepCall.arguments[3]), `${id} state`);
      assert.ok(validTargets.has(`${environment}/${view}`), `${id} targets ${environment}/${view}`);
      assert.ok(state.length > 0, `${id} must expose the step release state`);
    }
  }
  assert.deepEqual(
    ids,
    Array.from({ length: 12 }, (_, index) => `J${String(index + 1).padStart(2, "0")}`),
  );
});

test("locale contracts stay in exact parity", async () => {
  const locales = ["en", "fa", "ar", "zh", "hi"];
  const catalogs = await Promise.all(
    locales.map(async (locale) => JSON.parse(await source(`messages/${locale}.json`))),
  );
  const baseline = Object.keys(catalogs[0]).sort();
  assert.ok(baseline.length > 850);
  for (const [index, catalog] of catalogs.entries()) {
    assert.deepEqual(Object.keys(catalog).sort(), baseline, `${locales[index]} keys differ`);
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value, "string", `${locales[index]}.${key} must be a string`);
      assert.ok(value.trim().length > 0, `${locales[index]}.${key} must not be empty`);
    }
  }
});

test("release truth and safety controls are explicit in product previews", async () => {
  const workspace = await source("src/components/xeomx/product/ProductWorkspacePreview.tsx");
  for (const label of [
    "Budget and time limit",
    "Risk preview",
    "Human approval",
    "Monitor",
    "Pause or stop",
    "Audit trail",
    "Recovery",
    "Confidence",
    "Recommended action",
    "Impact preview",
    "Reversibility",
  ]) {
    assert.ok(workspace.includes(label), `Missing safety stage: ${label}`);
  }
  assert.ok(!workspace.includes("CheckCircle2"), "planned stages must not look completed");

  const states = await source("src/components/xeomx/os/SystemState.tsx");
  for (const variant of [
    "loading",
    "slow-network",
    "empty",
    "error",
    "offline",
    "permission-denied",
    "provider-unavailable",
    "rate-limited",
    "expired-credential",
    "expired-session",
    "payment-failure",
    "generation-failed",
    "partial-completion",
    "job-processing",
    "job-failed",
    "job-cancelled",
    "job-resumed",
    "success",
  ]) {
    assert.ok(states.includes(`"${variant}"`), `Missing global state ${variant}`);
  }
});

test("legacy simulations, fake metrics, and soft product 404s stay removed", async () => {
  for (const route of ["studio", "xeomx-ai"]) {
    const text = await source(`src/routes/${route}.tsx`);
    assert.ok(text.includes("ProductEnvironmentPage"));
    assert.ok(!text.includes("requestAnimationFrame"));
    assert.ok(text.split("\n").length < 80, `${route} must remain a thin product entry route`);
  }

  const prompts = await source("src/lib/prompts.ts");
  assert.ok([...prompts.matchAll(/views:\s*"([^"]+)"/g)].every((match) => match[1] === "—"));
  assert.ok([...prompts.matchAll(/likes:\s*"([^"]+)"/g)].every((match) => match[1] === "—"));
  for (const metric of ["copies", "saves", "shares", "remixes", "viralScore"]) {
    assert.ok(
      [...prompts.matchAll(new RegExp(`${metric}:\\s*(\\d+)`, "g"))].every(
        (match) => Number(match[1]) === 0,
      ),
      `${metric} includes an invented value`,
    );
  }
  assert.ok(
    [...prompts.matchAll(/author:\s*"([^"]+)"/g)].every((match) => match[1] === "XeomX"),
    "preview prompt authors must not impersonate creator profiles",
  );
  for (const unsupportedClaim of [
    "most copied prompt this week",
    "most-remixed prompt of the month",
    "drops in",
  ]) {
    assert.ok(!prompts.toLowerCase().includes(unsupportedClaim), `Found ${unsupportedClaim}`);
  }

  const productRoute = await source("src/routes/os.$environment.$view.tsx");
  assert.ok(productRoute.includes("throw notFound()"));
  const legacyExplore = await source("src/routes/explore_.$slug.tsx");
  assert.ok(legacyExplore.includes('redirect({ to: "/ecosystem"'));
});

test("public listing, auth, SEO, and runtime warning boundaries remain safe", async () => {
  const marketplace = await source("src/lib/marketplace.ts");
  const listSelect = marketplace.slice(
    marketplace.indexOf("const PROMPT_LIST_SELECT"),
    marketplace.indexOf("const PROMPT_DETAIL_SELECT"),
  );
  assert.ok(!listSelect.includes("body"), "listing queries must not fetch full prompt bodies");
  assert.ok(marketplace.includes("fetchFeedPrompts"));
  assert.ok(!marketplace.includes("fetchViralPrompts"));

  const authenticatedRoute = await source("src/routes/_authenticated/route.tsx");
  assert.ok(authenticatedRoute.includes("supabase.auth.getUser()"));
  assert.ok(!authenticatedRoute.includes("supabase.auth.getSession()"));
  const middleware = await source("src/integrations/supabase/auth-middleware.ts");
  assert.ok(middleware.includes("supabase.auth.getClaims(token)"));

  const root = await source("src/routes/__root.tsx");
  assert.ok(!root.includes("console.warn ="));
  assert.ok(!root.includes("ovqhdzppfbdvnzuglukf"));
  const seo = await source("src/lib/seo.ts");
  assert.ok(seo.includes("buildAlternateLinks"));
  const sitemap = await source("public/sitemap.xml");
  assert.ok(sitemap.includes("/en/prompt-hub"));
  assert.ok(sitemap.includes("/en/contact"));
  for (const noindexPath of ["auth", "studio", "pricing", "xeomx-ai"]) {
    assert.ok(!sitemap.includes(`/${noindexPath}</loc>`), `${noindexPath} must not be in sitemap`);
  }

  const launcher = await source("src/components/xeomx/os/GlobalLauncher.tsx");
  assert.ok(!launcher.includes("min-h-9"), "launcher controls must keep 44px touch targets");

  const dashboard = await source("src/routes/_authenticated/dashboard.tsx");
  assert.ok(dashboard.includes('view: "notifications"'));
  assert.ok(!dashboard.includes("This Month"));
  assert.ok(!dashboard.includes('|| "nocturne"'));
});

test("release dependency surface excludes proven unused direct packages", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  for (const dependency of ["@hookform/resolvers", "date-fns", "zod"]) {
    assert.equal(packageJson.dependencies[dependency], undefined, `${dependency} is still direct`);
  }
});

test("secondary global tools stay outside the initial client path", async () => {
  const root = await source("src/routes/__root.tsx");
  assert.ok(root.includes("GlobalLauncherProvider"));
  assert.ok(!root.includes('from "@/components/xeomx/os/GlobalLauncher"'));

  const provider = await source("src/components/xeomx/os/GlobalLauncherProvider.tsx");
  assert.ok(provider.includes("lazy("));
  assert.ok(provider.includes('import("@/components/xeomx/os/GlobalLauncher")'));

  const support = await source("src/components/xeomx/SupportButton.tsx");
  assert.ok(support.includes("lazy("));
  assert.ok(!support.includes('import { SupportDrawer } from "./SupportDrawer"'));

  const legacyExplore = await source("src/routes/explore_.$slug.tsx");
  assert.ok(!legacyExplore.includes("@/lib/explore-sections"));
});

test("request 4 hardening stays centralized, fail-closed, and context preserving", async () => {
  const status = await source("src/lib/feature-status.ts");
  assert.ok(status.includes("CapabilityReleaseState"));
  assert.ok(!status.includes('status: "coming_soon"'));

  const architecture = await source("src/lib/product-architecture.ts");
  for (const adapter of [
    "ai-provider",
    "generation-jobs",
    "research-jobs",
    "model-benchmarks",
    "evidence-datasets",
    "payments",
    "entitlements",
    "credentials",
    "policy-decisions",
    "approvals",
    "audit-events",
    "telemetry",
    "storage",
    "realtime",
    "deployment",
    "cybersecurity-events",
  ]) {
    assert.ok(architecture.includes(`"${adapter}"`), `Product contract does not map ${adapter}`);
  }
  assert.ok(architecture.includes("adapter: subpage.dependency.adapter"));

  const environmentPage = await source("src/components/xeomx/product/ProductEnvironmentPage.tsx");
  for (const boundary of [
    "CapabilityBoundary",
    "ProjectContextSummary",
    "rememberHandoff",
    "viewHeadingRef",
  ]) {
    assert.ok(environmentPage.includes(boundary), `Missing route hardening: ${boundary}`);
  }

  const workspace = await source("src/components/xeomx/product/ProductWorkspacePreview.tsx");
  for (const panel of [
    "JobStatusPanel",
    "PaymentSafetyPanel",
    "PermissionPreviewPanel",
    "SecurityIncidentPanel",
  ]) {
    assert.ok(workspace.includes(panel), `Missing shared safety panel: ${panel}`);
  }
  assert.ok(!workspace.includes('variant="payment-failure"'));

  const root = await source("src/routes/__root.tsx");
  assert.ok(root.includes("ProjectContextProvider"));
  const launcher = await source("src/components/xeomx/os/GlobalLauncher.tsx");
  assert.ok(launcher.includes("RECENT_ACTION_KEY"));
  assert.ok(launcher.includes("getClientPolicyHint"));
});
