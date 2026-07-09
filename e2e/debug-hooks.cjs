const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on("pageerror", (e) => console.log("PAGEERROR STACK:\n", e.stack));
  await page.goto("http://localhost:5173/login");
  await page.fill('input[type="email"]', "scout@demo.sportivox");
  await page.fill('input[type="password"]', "Demo1234!");
  await page.click("button.btn-primary");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  console.log("--- navigating to profile ---");
  await page.goto("http://localhost:5173/profile/b5151ce9-909e-446b-95fc-3a0596eb18f8");
  await page.waitForTimeout(3000);
  console.log("--- reload 1 ---");
  await page.reload();
  await page.waitForTimeout(3000);
  await browser.close();
})();
