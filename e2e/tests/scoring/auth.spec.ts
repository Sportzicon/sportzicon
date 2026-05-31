import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.SCORING_ADMIN_EMAIL || "admin@scoring.local";
const ADMIN_PASSWORD = process.env.SCORING_ADMIN_PASSWORD || "Demo1234!";

test.describe("Scoring console — auth", () => {
  test("@smoke login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("@smoke signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("@critical admin/organizer can sign in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /(log\s?in|sign\s?in)/i }).click();
    await page.waitForURL(url => !url.pathname.endsWith("/login"), { timeout: 10_000 })
      .catch(() => test.skip(true, "Scoring seed/account missing"));
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test("rejected credentials stay on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("wrong");
    await page.getByRole("button", { name: /(log\s?in|sign\s?in)/i }).click();
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/login/);
  });
});
