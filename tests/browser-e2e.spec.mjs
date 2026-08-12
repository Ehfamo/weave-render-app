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

test(
  "real browser completes and reloads the Request7 Cloudflare vertical slice",
  async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/auth?next=%2Fprojects", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/XEOMX/i);
    await expect(page.locator("body")).not.toBeEmpty();

    const emailOption = page.getByRole("button", { name: /email/i });
    await expect(emailOption).toBeVisible();
    await emailOption.click();

    await page.locator("#auth-email").fill(email);
    await page.locator("#auth-password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/projects(?:\?|$)/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "XEOMX Project Workspace" }),
    ).toBeVisible();
    await expect(page.getByText("LIVE STAGING", { exact: true })).toBeVisible();

    const projectName = `Browser E2E ${Date.now()}`;
    await page.getByPlaceholder("Project name").first().fill(projectName);
    await page
      .getByPlaceholder("Description")
      .first()
      .fill("Real authenticated browser vertical slice verification");
    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(projectName) }),
    ).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByPlaceholder("Ask XEOMX…")
      .fill("Reply with exactly: XEOMX LIVE VERIFIED");
    await page.getByRole("button", { name: /^Send$/ }).click();

    const verifiedOutput = page.getByText("XEOMX LIVE VERIFIED", { exact: true });
    await expect(verifiedOutput).toBeVisible({ timeout: 95_000 });
    await expect(page.getByText(/Credits:\s*24/)).toBeVisible({ timeout: 10_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "XEOMX Project Workspace" }),
    ).toBeVisible();
    await expect(
      page.getByText("XEOMX LIVE VERIFIED", { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Credits:\s*24/)).toBeVisible();

    await page.screenshot({
      path: "test-results/xeomx-request7-live.png",
      fullPage: true,
    });

    const relevantErrors = consoleErrors.filter(
      (entry) => !/favicon|ResizeObserver loop/i.test(entry),
    );
    expect(
      relevantErrors,
      `Browser console/page errors:\n${relevantErrors.join("\n")}`,
    ).toEqual([]);
  },
);
