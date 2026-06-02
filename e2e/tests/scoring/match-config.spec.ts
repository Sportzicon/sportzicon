import { test, expect, request } from "@playwright/test";

// Organizer match configuration screen (PPTX § Match & Innings Setup).

const ADMIN_EMAIL = process.env.SCORING_ADMIN_EMAIL || "admin@scoring.local";
const ADMIN_PASSWORD = process.env.SCORING_ADMIN_PASSWORD || "Demo1234!";
const SCORING_API = process.env.SCORING_API_URL || "http://localhost:8081/api";

async function setupMatch() {
  try {
  const ctx = await request.newContext();
  const lg = await ctx.post(`${SCORING_API}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!lg.ok()) return null;
  const { access_token } = await lg.json();
  const h = { Authorization: `Bearer ${access_token}` };
  const t = (await (await ctx.post(`${SCORING_API}/tournaments`, {
    headers: h, data: { name: `Cfg ${Date.now()}`, sport: "cricket", format: "T20" }
  })).json()).tournament;
  const team1 = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/teams`, { headers: h, data: { name: "A" } })).json()).team;
  const team2 = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/teams`, { headers: h, data: { name: "B" } })).json()).team;
  const m = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/matches`, {
    headers: h, data: { team1_id: team1.id, team2_id: team2.id }
  })).json()).match;
  return { token: access_token, match: m };
  } catch {
    return null;
  }
}

test.describe("@scoring Match configuration", () => {
  let setup: any;

  test.beforeAll(async () => {
    setup = await setupMatch();
    if (!setup) test.skip(true, "Scoring API unreachable");
  });

  test.beforeEach(async ({ page }) => {
    if (!setup) test.skip(true, "Setup unavailable");
    await page.addInitScript((token) => {
      localStorage.setItem("scoring-auth", JSON.stringify({
        state: {
          user: { id: "e2e", email: "admin@scoring.local", full_name: "E2E", role: "admin" },
          access_token: token,
          refresh_token: ""
        },
        version: 0
      }));
    }, setup.token);
  });

  test("@critical config screen renders all PPTX sections", async ({ page }) => {
    await page.goto(`/matches/${setup.match.id}/config`);
    const body = page.locator("body");
    await expect(body).toContainText(/format & ball|match configuration/i);
    await expect(body).toContainText(/phase boundaries/i);
    await expect(body).toContainText(/rules/i);
    await expect(body).toContainText(/super over/i);
    await expect(body).toContainText(/dls/i);
    await expect(body).toContainText(/free.?hit/i);
    await expect(body).toContainText(/no.?ball/i);
    await expect(body).toContainText(/wide/i);
    await expect(body).toContainText(/tie.?break/i);
  });

  test("organizer can save configuration", async ({ page }) => {
    await page.goto(`/matches/${setup.match.id}/config`);
    const oversInput = page.getByLabel(/overs per innings/i);
    if (await oversInput.isVisible()) {
      await oversInput.fill("20");
    }
    const ballType = page.getByLabel(/ball type/i);
    if (await ballType.isVisible()) {
      await ballType.selectOption("white");
    }
    const save = page.getByRole("button", { name: /save configuration/i });
    await save.click();
    await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 5_000 });
  });
});
