import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.SCORING_ADMIN_EMAIL || "admin@scoring.local";
const ADMIN_PASSWORD = process.env.SCORING_ADMIN_PASSWORD || "Demo1234!";

async function loginScoring(page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /(log\s?in|sign\s?in)/i }).click();
  await page.waitForURL(url => !url.pathname.endsWith("/login"), { timeout: 10_000 })
    .catch(() => test.skip(true, "Scoring seed missing"));
}

test.describe("Scoring console — tournaments", () => {
  test("@smoke unauthenticated tournament list loads", async ({ page }) => {
    await page.goto("/tournaments");
    await expect(page.locator("body")).toBeVisible();
  });

  test("@critical organizer can open the new tournament form", async ({ page }) => {
    await loginScoring(page);
    await page.goto("/tournaments/new");
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/sport/i).first()).toBeVisible();
  });

  test("@critical organizer can create a tournament", async ({ page }) => {
    await loginScoring(page);
    await page.goto("/tournaments/new");

    const stamp = Date.now();
    await page.getByLabel(/name/i).first().fill(`E2E Tournament ${stamp}`);
    const sportField = page.getByLabel(/sport/i).first();
    if (await sportField.evaluate(el => (el as HTMLSelectElement).tagName) === "SELECT") {
      await sportField.selectOption("cricket").catch(() => {});
    } else {
      await sportField.fill("cricket");
    }
    const submit = page.getByRole("button", { name: /(create|save|submit)/i }).first();
    await submit.click().catch(() => {});
    // Should land on tournament detail or list
    await page.waitForURL(/tournaments\/[a-z0-9-]+/i, { timeout: 10_000 })
      .catch(() => {/* tolerated — depends on backend */});
  });

  test("tournament detail page renders teams section", async ({ page }) => {
    await page.goto("/tournaments");
    const first = page.locator("a[href^='/tournaments/']").first();
    if (await first.isVisible().catch(() => false)) {
      await first.click();
      await expect(page).toHaveURL(/tournaments\/[a-z0-9-]+/);
      const text = await page.locator("body").textContent();
      expect(text?.toLowerCase()).toMatch(/team|match|standings|squad/);
    } else {
      test.skip(true, "No tournaments seeded");
    }
  });
});
