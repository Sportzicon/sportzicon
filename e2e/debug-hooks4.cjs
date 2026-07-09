const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on("pageerror", (e) => console.log("PAGEERROR at url", page.url(), ":", e.message));
  await page.goto("http://localhost:5173/login");
  await page.fill('input[type="email"]', "scout@demo.sportivox");
  await page.fill('input[type="password"]', "Demo1234!");
  console.log("about to click login, current url:", page.url());
  await page.click("button.btn-primary");
  await page.waitForTimeout(500);
  console.log("right after click, url:", page.url());
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  console.log("landed on:", page.url());
  await page.waitForTimeout(2000);
  await browser.close();
})();
