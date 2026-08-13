import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!baseURL || !email || !password) {
  throw new Error("E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD are required");
}

test.use({
  baseURL,
  viewport: { width: 1440, height: 1000 },
  ignoreHTTPSErrors: false,
});

test("real browser completes generation, grounded research, and live search with reload persistence", async ({
  page,
}) => {
  test.setTimeout(360_000);

  const consoleErrors = [];
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];

  page.on("console", (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    consoleErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText ?? "unknown",
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      badResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto("/auth?next=%2Fprojects", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/XEOMX/i);
  await expect(page.locator("body")).not.toBeEmpty();
  await page.waitForLoadState("networkidle");

  const emailOption = page.getByRole("button", { name: /email/i });
  await expect(emailOption).toBeVisible();
  await emailOption.click();
  await expect(page.locator("#auth-email")).toBeVisible({ timeout: 5_000 });

  const hydrationState = await page.evaluate(() => ({
    url: window.location.href,
    emailPresent: Boolean(document.querySelector("#auth-email")),
    scripts: Array.from(document.scripts).map((script) => ({
      src: script.src,
      type: script.type,
      async: script.async,
      defer: script.defer,
    })),
    resources: performance
      .getEntriesByType("resource")
      .filter((entry) => /\.(?:js|mjs)(?:\?|$)/i.test(entry.name))
      .map((entry) => ({ name: entry.name, duration: entry.duration })),
  }));

  if (!hydrationState.emailPresent) {
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      "test-results/hydration-diagnostics.json",
      JSON.stringify(
        {
          hydrationState,
          consoleMessages,
          pageErrors,
          requestFailures,
          badResponses,
        },
        null,
        2,
      ),
    );
    throw new Error("Auth SSR rendered, but the email view did not activate after hydration");
  }

  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/projects(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "XEOMX Project Workspace" })).toBeVisible();
  await expect(page.getByText("LIVE STAGING", { exact: true })).toBeVisible();

  const projectName = `Browser E2E ${Date.now()}`;
  await page.getByPlaceholder("Project name").first().fill(projectName);
  await page
    .getByPlaceholder("Description")
    .first()
    .fill("Real authenticated browser vertical slice verification");
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByRole("button", { name: new RegExp(projectName) })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByPlaceholder("Ask XEOMX…").fill("Reply with exactly: XEOMX LIVE VERIFIED");
  await page.getByRole("button", { name: /^Send$/ }).click();

  const verifiedOutput = page.getByText("XEOMX LIVE VERIFIED", { exact: true });
  await expect(verifiedOutput).toBeVisible({ timeout: 95_000 });
  await expect(page.getByText(/Credits:\s*24/)).toBeVisible({ timeout: 10_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "XEOMX Project Workspace" })).toBeVisible();
  await expect(page.getByText("XEOMX LIVE VERIFIED", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Credits:\s*24/)).toBeVisible();

  await page
    .getByPlaceholder("Ask XEOMX…")
    .fill(
      "What does Cloudflare Browser Rendering Workers Binding allow a Worker to do? Answer briefly.",
    );
  await page.getByTestId("research-web-button").click();

  const researchSources = page.getByTestId("research-sources").last();
  await expect(researchSources).toBeVisible({ timeout: 150_000 });
  await expect(researchSources.locator("a").first()).toHaveAttribute("href", /^https:\/\//);

  const researchAnswer = page.locator("article p").last();
  await expect(researchAnswer).toContainText(/\[[1-3]\]/, { timeout: 20_000 });
  await expect(page.getByText(/Credits:\s*23/)).toBeVisible({ timeout: 20_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "XEOMX Project Workspace" })).toBeVisible();
  await expect(page.getByTestId("research-sources").last()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("article p").last()).toContainText(/\[[1-3]\]/);
  await expect(page.getByText(/Credits:\s*23/)).toBeVisible();

  const searchTerm = "xeomxsearchlivev1";
  await page.goto(`/search?q=${searchTerm}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("search-input")).toHaveValue(searchTerm);
  await expect(page.getByTestId("search-prompts")).toContainText(`Live Search ${searchTerm}`, {
    timeout: 20_000,
  });
  await expect(page.getByTestId("search-creators")).toContainText(`Creator ${searchTerm}`);
  await expect(page.getByTestId("search-collections")).toContainText(
    `Collection ${searchTerm}`,
  );

  await page.getByRole("tab", { name: "Writing" }).click();
  await expect(page).toHaveURL(/category=Writing/);
  await expect(page.getByTestId("search-prompts")).toContainText(`Live Search ${searchTerm}`);
  await expect(page.getByTestId("search-creators")).toHaveCount(0);
  await expect(page.getByTestId("search-collections")).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/category=Writing/);
  await expect(page.getByTestId("search-input")).toHaveValue(searchTerm);
  await expect(page.getByTestId("search-prompts")).toContainText(`Live Search ${searchTerm}`, {
    timeout: 20_000,
  });

  await page.screenshot({
    path: "test-results/xeomx-request7-live.png",
    fullPage: true,
  });

  const relevantErrors = consoleErrors.filter(
    (entry) =>
      !/favicon|ResizeObserver loop|upgrade-insecure-requests.*report-only policy/i.test(entry),
  );
  expect(relevantErrors, `Browser console/page errors:\n${relevantErrors.join("\n")}`).toEqual([]);
});
