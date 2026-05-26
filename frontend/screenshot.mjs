import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

// Desktop view
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
await page.screenshot({ path: '../desktop.png' });

// Mobile view  
await page.setViewportSize({ width: 375, height: 667 });
await page.screenshot({ path: '../mobile.png' });

await browser.close();
console.log('Screenshots saved');
