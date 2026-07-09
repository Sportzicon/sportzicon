const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("response", async (r) => {
    if (r.url().includes("document-access")) {
      console.log("RESP", r.status(), r.url());
      try { console.log("BODY", (await r.text()).slice(0,300)); } catch {}
    }
  });
  page.on("requestfailed", (r) => console.log("FAILED", r.url(), r.failure()?.errorText));
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
  await page.goto("http://localhost:5173/login");
  await page.fill('input[type="email"]', "athlete@demo.sportivox");
  await page.fill('input[type="password"]', "Demo1234!");
  await page.click("button.btn-primary");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("http://localhost:5173/profile/document-access");
  await page.waitForTimeout(4000);
  await browser.close();
})();
