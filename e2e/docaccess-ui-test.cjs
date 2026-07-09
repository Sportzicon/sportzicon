const { chromium } = require("playwright");

const BASE = "http://localhost:5173";
const ATH_ID = "b5151ce9-909e-446b-95fc-3a0596eb18f8";
const shot = (name) => `/private/tmp/claude-501/-Users-maheshsingare-sportzicon/f8872e60-a146-4521-aa45-7d0198bc04c3/scratchpad/${name}.png`;

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click("button.btn-primary");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ── Mobile: scout viewing athlete profile (375x667) ──
  const scoutCtx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const scoutPage = await scoutCtx.newPage();
  scoutPage.on("pageerror", (e) => errors.push(`scoutPage pageerror: ${e.message}`));
  scoutPage.on("console", (m) => { if (m.type() === "error") errors.push(`scoutPage console: ${m.text()}`); });

  await login(scoutPage, "scout@demo.sportivox", "Demo1234!");
  await scoutPage.goto(`${BASE}/profile/${ATH_ID}`);
  await scoutPage.waitForSelector("text=Documents", { timeout: 10000 });
  await scoutPage.screenshot({ path: shot("01-scout-mobile-pending"), fullPage: true });
  const pendingMsg = await scoutPage.getByText("Request pending", { exact: false }).count();
  console.log("RESULT scout sees 'Request pending' (mobile):", pendingMsg > 0);

  // ── Desktop: athlete reviews + approves (1280x800) ──
  const athCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const athPage = await athCtx.newPage();
  athPage.on("pageerror", (e) => errors.push(`athPage pageerror: ${e.message}`));
  athPage.on("console", (m) => { if (m.type() === "error") errors.push(`athPage console: ${m.text()}`); });

  await login(athPage, "athlete@demo.sportivox", "Demo1234!");
  await athPage.goto(`${BASE}/profile/document-access`);
  await athPage.waitForSelector("text=Maya Iyer", { timeout: 10000 });
  await athPage.screenshot({ path: shot("02-athlete-desktop-pending-list"), fullPage: true });

  // Exact-text match on the card's Approve button — avoids matching the "Approved" tab label.
  const cardApprove = athPage.locator(".panel").getByRole("button", { name: "Approve", exact: true });
  await cardApprove.waitFor({ state: "visible", timeout: 10000 });
  await cardApprove.click();

  // Desktop confirm modal (visible one — the MobileDrawer's own copy stays CSS-hidden at this width).
  const desktopModal = athPage.locator("div.hidden.lg\\:flex");
  await desktopModal.waitFor({ state: "visible", timeout: 5000 });
  await athPage.screenshot({ path: shot("03-athlete-desktop-approve-confirm"), fullPage: true });
  await desktopModal.getByRole("button", { name: "Approve", exact: true }).click();
  await athPage.waitForSelector("text=Maya Iyer", { state: "detached", timeout: 5000 }).catch(() => {});
  await athPage.screenshot({ path: shot("04-athlete-desktop-after-approve"), fullPage: true });

  // ── Back to scout mobile: documents should now be visible, CTA/pending message gone ──
  await scoutPage.reload();
  await scoutPage.waitForSelector("text=Documents", { timeout: 10000 });
  await scoutPage.waitForTimeout(500);
  await scoutPage.screenshot({ path: shot("05-scout-mobile-approved"), fullPage: true });
  const stillLocked = await scoutPage.getByText("private", { exact: false }).count();
  console.log("RESULT scout no longer sees locked/private documents message (mobile):", stillLocked === 0);

  // ── Athlete revokes (desktop) ──
  await athPage.goto(`${BASE}/profile/document-access`);
  await athPage.getByRole("button", { name: "Approved", exact: true }).click();
  await athPage.waitForSelector("text=Maya Iyer", { timeout: 10000 });
  await athPage.screenshot({ path: shot("06-athlete-desktop-approved-tab"), fullPage: true });

  const cardRevoke = athPage.locator(".panel").getByRole("button", { name: "Revoke access", exact: true });
  await cardRevoke.waitFor({ state: "visible", timeout: 10000 });
  await cardRevoke.click();
  const desktopModal2 = athPage.locator("div.hidden.lg\\:flex");
  await desktopModal2.waitFor({ state: "visible", timeout: 5000 });
  await athPage.screenshot({ path: shot("06b-athlete-desktop-revoke-confirm"), fullPage: true });
  await desktopModal2.getByRole("button", { name: "Revoke", exact: true }).click();
  await athPage.waitForTimeout(1000);
  await athPage.screenshot({ path: shot("07-athlete-desktop-after-revoke"), fullPage: true });

  // ── Scout mobile: CTA should reappear ──
  await scoutPage.reload();
  await scoutPage.waitForSelector("text=Documents", { timeout: 10000 });
  await scoutPage.waitForTimeout(500);
  await scoutPage.screenshot({ path: shot("08-scout-mobile-revoked-cta-back"), fullPage: true });
  const ctaBackCount = await scoutPage.getByRole("button", { name: "Request access to documents" }).count();
  console.log("RESULT scout CTA button back after revoke (mobile):", ctaBackCount > 0);

  console.log("CONSOLE/PAGE ERRORS:", errors.length ? errors : "none");

  await browser.close();
})().catch(async (e) => { console.error("SCRIPT ERROR", e); process.exit(1); });
