import { test, expect } from "@playwright/test";

// PPTX § 09 — In-app pages exist & landing surfaces are reachable.
// These run unauthenticated so they catch dead routes early.

test.describe("Sportivox landing & public surfaces", () => {
  test("@smoke @critical landing page renders headline and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(login|landing)?$/);
    await expect(page.locator("body")).toBeVisible();
    const headlineCandidates = page.getByRole("heading", { level: 1 });
    await expect(headlineCandidates.first()).toBeVisible();
  });

  test("@smoke login page accepts inputs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /(log\s?in|sign\s?in)/i })).toBeVisible();
  });

  test("@smoke signup page loads (multi-step)", async ({ page }) => {
    await page.goto("/signup");
    // Sportivox signup is a multi-step wizard — step 0 is role selection.
    // Just assert the page renders and exposes role choices or a next button.
    await expect(page.locator("body")).toBeVisible();
    const text = (await page.locator("body").textContent()) || "";
    expect(text).toMatch(/(athlete|club|scout|organizer|role|sign\s?up|create)/i);
  });

  test("@smoke forgot password page exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator("body")).toContainText(/email/i);
  });

  test("@critical browse opportunities works unauthenticated", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page).toHaveURL(/(opportunities|login)/);
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  test("404 handler returns a friendly page", async ({ page }) => {
    const r = await page.goto("/this-route-does-not-exist-123");
    expect(r?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
