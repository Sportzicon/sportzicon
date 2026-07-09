const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ devtools: false });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 500)));
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://localhost:5173/login");
  await page.fill('input[type="email"]', "scout@demo.sportivox");
  await page.fill('input[type="password"]', "Demo1234!");
  await page.click("button.btn-primary");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  // Click a link instead of full navigation, to get client-side routing (React errors surface differently/more verbosely without a full reload)
  await page.evaluate(() => { window.__err = []; window.addEventListener('error', e => window.__err.push(e.message)); });
  await page.goto("http://localhost:5173/profile/b5151ce9-909e-446b-95fc-3a0596eb18f8", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await browser.close();
})();
