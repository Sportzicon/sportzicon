import { defineConfig, devices } from "@playwright/test";

// Playwright config for Sportivox + Scoring console.
// Two projects so the same runner exercises both SPAs without
// re-launching browsers between specs.

const SVOX_URL = process.env.SVOX_BASE_URL || "http://localhost:5173";
const SCORING_URL = process.env.SCORING_BASE_URL || "http://localhost:5174";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["json", { outputFile: "reports/results.json" }],
    ["junit", { outputFile: "reports/junit.xml" }],
    ...(process.env.GITHUB_ACTIONS ? [["github" as const]] : [])
  ],

  use: {
    baseURL: SVOX_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },

  projects: [
    {
      name: "sportivox-chromium",
      testDir: "./tests/sportivox",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: SVOX_URL
      }
    },
    {
      name: "scoring-chromium",
      testDir: "./tests/scoring",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: SCORING_URL
      }
    },
    {
      name: "mobile-chrome",
      testDir: "./tests/sportivox",
      testMatch: ["landing.spec.ts"],
      use: {
        ...devices["Pixel 7"],
        baseURL: SVOX_URL
      }
    }
  ]
});
