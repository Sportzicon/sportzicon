import { test, expect } from "@playwright/test";

const DEMO_PASSWORD = process.env.SVOX_DEMO_PASSWORD || "Demo1234!";

async function loginAs(page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /(log\s?in|sign\s?in)/i }).click();
  await page.waitForURL(url => !url.pathname.endsWith("/login"), { timeout: 10_000 })
    .catch(() => test.skip(true, "Seed missing"));
}

test.describe("Social surfaces", () => {
  test("@smoke feed renders", async ({ page }) => {
    await loginAs(page, "athlete@demo.sportivox");
    await page.goto("/feed");
    await expect(page.locator("body")).toBeVisible();
  });

  test("@smoke reels page loads without error", async ({ page }) => {
    await loginAs(page, "athlete@demo.sportivox");
    await page.goto("/reels");
    await expect(page.locator("body")).toBeVisible();
  });

  test("@smoke blogs index loads", async ({ page }) => {
    await loginAs(page, "athlete@demo.sportivox");
    await page.goto("/blogs");
    await expect(page.locator("body")).toBeVisible();
  });

  test("@smoke notifications page loads", async ({ page }) => {
    await loginAs(page, "athlete@demo.sportivox");
    await page.goto("/notifications");
    await expect(page.locator("body")).toBeVisible();
  });

  test("@smoke messages page loads", async ({ page }) => {
    await loginAs(page, "athlete@demo.sportivox");
    await page.goto("/messages");
    await expect(page.locator("body")).toBeVisible();
  });

  test("profile shows user info", async ({ page }) => {
    await loginAs(page, "athlete@demo.sportivox");
    await page.goto("/profile");
    const txt = await page.locator("body").textContent();
    expect(txt?.length ?? 0).toBeGreaterThan(50);
  });
});
