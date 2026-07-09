const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await page.addInitScript(() => { Error.stackTraceLimit = 100; });
  page.on("pageerror", (e) => console.log("PAGEERROR STACK:\n" + e.stack));
  await page.goto("http://localhost:5173/login");
  await page.fill('input[type="email"]', "scout@demo.sportivox");
  await page.fill('input[type="password"]', "Demo1234!");
  await page.click("button.btn-primary");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForTimeout(2000);
  await browser.close();
})();
