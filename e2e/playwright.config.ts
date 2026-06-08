import { defineConfig, devices } from "@playwright/test";

const SVOX_URL = process.env.SVOX_BASE_URL || "http://localhost:5173";
const SCORING_URL = process.env.SCORING_BASE_URL || "http://localhost:5174";

const isLocalhostSvox = /localhost|127\.0\.0\.1/.test(SVOX_URL);
const isLocalhostScoring = /localhost|127\.0\.0\.1/.test(SCORING_URL);

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

  // Auto-start Vite dev servers when testing against localhost.
  // Both vite.config.ts files already hard-code the correct ports (5173 / 5174),
  // so `npm run dev` is enough — no port flags needed.
  // reuseExistingServer:true means: if a server is already listening at `url`,
  // skip launching `command` (useful when running tests locally with servers
  // already up, or in CI where the workflow pre-installs deps but leaves
  // server startup to Playwright).
  webServer: [
    ...(isLocalhostSvox
      ? [
          {
            command: "npm run dev",
            cwd: "../frontend",
            url: SVOX_URL,
            reuseExistingServer: true,
            timeout: 120_000,
            stdout: "pipe",
            stderr: "pipe",
          },
        ]
      : []),
    ...(isLocalhostScoring
      ? [
          {
            command: "npm run dev",
            cwd: "../scoring/frontend",
            url: SCORING_URL,
            reuseExistingServer: true,
            timeout: 120_000,
            stdout: "pipe",
            stderr: "pipe",
          },
        ]
      : []),
  ],

  projects: [
    {
      name: "sportivox-chromium",
      testDir: "./tests/sportivox",
      use: { ...devices["Desktop Chrome"], baseURL: SVOX_URL }
    },
    {
      name: "scoring-chromium",
      testDir: "./tests/scoring",
      use: { ...devices["Desktop Chrome"], baseURL: SCORING_URL }
    },
    {
      name: "mobile-chrome",
      testDir: "./tests/sportivox",
      testMatch: ["landing.spec.ts"],
      use: { ...devices["Pixel 7"], baseURL: SVOX_URL }
    }
  ]
});
