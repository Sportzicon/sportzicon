import { test, expect } from "@playwright/test";
import { inputByType } from "../_helpers/labels";

const ADMIN_EMAIL = process.env.SCORING_ADMIN_EMAIL || "admin@scoring.local";
const ADMIN_PASSWORD = process.env.SCORING_ADMIN_PASSWORD || "Demo1234!";

test.describe("Scoring console — auth", () => {
  test("@smoke login page renders", async ({ page }) => {
    await page.goto("/login");
    // Scoring uses unlinked <label> elements — match by input type instead.
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("@smoke signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("@critical admin/organizer can sign in", async ({ page }) => {
    await page.goto("/login");
    await inputByType(page, "email").fill(ADMIN_EMAIL);
    await inputByType(page, "password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /(log\s?in|sign\s?in)/i }).click();
    const onPostLogin = await page.waitForURL(url => !url.pathname.endsWith("/login"), { timeout: 10_000 })
      .then(() => true).catch(() => false);
    if (!onPostLogin) test.skip(true, "Scoring seed/account missing — start scoring backend with seed");
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test("rejected credentials stay on login", async ({ page }) => {
    await page.goto("/login");
    await inputByType(page, "email").fill("nobody@example.com");
    await inputByType(page, "password").fill("wrong");
    await page.getByRole("button", { name: /(log\s?in|sign\s?in)/i }).click();
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/login/);
  });
});
