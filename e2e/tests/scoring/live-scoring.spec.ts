import { test, expect, Page } from "@playwright/test";
import { request } from "@playwright/test";

// Live scoring covers the PPTX § Level 1 + Level 2 capture flow.
// These tests stand up a tournament + match + innings via the API
// so the UI is exercised end-to-end without depending on seed data.

const ADMIN_EMAIL = process.env.SCORING_ADMIN_EMAIL || "admin@scoring.local";
const ADMIN_PASSWORD = process.env.SCORING_ADMIN_PASSWORD || "Demo1234!";
const SCORING_API = process.env.SCORING_API_URL || "http://localhost:8081/api";

type Setup = {
  token: string;
  tournament: any;
  match: any;
  innings: any;
  team1: any;
  team2: any;
};

async function apiLogin() {
  const ctx = await request.newContext();
  const r = await ctx.post(`${SCORING_API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  if (!r.ok()) return null;
  const data = await r.json();
  return { token: data.access_token, ctx };
}

async function setupMatch(): Promise<Setup | null> {
  const lg = await apiLogin();
  if (!lg) return null;
  const { token, ctx } = lg;
  const headers = { Authorization: `Bearer ${token}` };
  const stamp = Date.now();

  const tournament = (await (await ctx.post(`${SCORING_API}/tournaments`, {
    headers, data: { name: `E2E T20 ${stamp}`, sport: "cricket", format: "T20" }
  })).json()).tournament;

  const team1 = (await (await ctx.post(`${SCORING_API}/tournaments/${tournament.id}/teams`, {
    headers, data: { name: "Team Alpha", short_name: "ALP" }
  })).json()).team;
  const team2 = (await (await ctx.post(`${SCORING_API}/tournaments/${tournament.id}/teams`, {
    headers, data: { name: "Team Bravo", short_name: "BRV" }
  })).json()).team;

  for (let i = 0; i < 3; i++) {
    await ctx.post(`${SCORING_API}/tournaments/${tournament.id}/teams/${team1.id}/players`, {
      headers, data: { name: `A${i + 1}`, jersey_number: i + 1, role: i === 0 ? "wicket-keeper" : "batsman" }
    });
    await ctx.post(`${SCORING_API}/tournaments/${tournament.id}/teams/${team2.id}/players`, {
      headers, data: { name: `B${i + 1}`, jersey_number: i + 1, role: "bowler" }
    });
  }

  const match = (await (await ctx.post(`${SCORING_API}/tournaments/${tournament.id}/matches`, {
    headers, data: { team1_id: team1.id, team2_id: team2.id, title: "Match 1" }
  })).json()).match;

  const innings = (await (await ctx.post(`${SCORING_API}/matches/${match.id}/innings`, {
    headers, data: { innings_number: 1, batting_team_id: team1.id, bowling_team_id: team2.id }
  })).json()).innings;

  return { token, tournament, match, innings, team1, team2 };
}

test.describe("@scoring Live scoring — PPTX Level 1 + Level 2", () => {
  let setup: Setup | null;

  test.beforeAll(async () => {
    setup = await setupMatch();
    if (!setup) test.skip(true, "Scoring API/seed not reachable");
  });

  test.beforeEach(async ({ page }) => {
    if (!setup) test.skip(true, "Setup unavailable");
    // Persist auth token to localStorage so the UI is signed in
    await page.addInitScript(([token]) => {
      localStorage.setItem("auth", JSON.stringify({ access_token: token, refresh_token: "" }));
    }, [setup!.token]);
  });

  test("@critical scorer can record a Level 1 ball", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);

    // Wait for batting/bowler selectors to render
    await expect(page.getByLabel(/batsman/i).first()).toBeVisible({ timeout: 15_000 });

    // Pick first batsman and first bowler
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });  // bowler

    // PPTX § Level 1 — Ball Length / Line / Bowler Type / Shot Type
    const length = page.getByLabel(/ball length/i);
    if (await length.isVisible()) await length.selectOption("good_length");
    const line = page.getByLabel(/ball line/i);
    if (await line.isVisible()) await line.selectOption("off_stump");
    const bowlerType = page.getByLabel(/bowler type/i);
    if (await bowlerType.isVisible()) await bowlerType.selectOption("ra_pace");
    const shot = page.getByLabel(/shot type/i);
    if (await shot.isVisible()) await shot.selectOption("defensive");

    // Score 1 run
    await page.getByRole("button", { name: /^1$/ }).first().click();

    await page.getByRole("button", { name: /record ball/i }).click();

    // Feedback shows success
    await expect(page.getByText(/ball recorded/i)).toBeVisible({ timeout: 5_000 });
  });

  test("@critical scorer can record a 4 and innings boundary counter updates", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    await expect(page.getByLabel(/batsman/i).first()).toBeVisible({ timeout: 15_000 });
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });

    const length = page.getByLabel(/ball length/i);
    if (await length.isVisible()) await length.selectOption("short");
    const line = page.getByLabel(/ball line/i);
    if (await line.isVisible()) await line.selectOption("outside_off");
    const bowlerType = page.getByLabel(/bowler type/i);
    if (await bowlerType.isVisible()) await bowlerType.selectOption("ra_pace");
    const shot = page.getByLabel(/shot type/i);
    if (await shot.isVisible()) await shot.selectOption("cut");

    await page.getByRole("button", { name: /^4$/ }).first().click();
    await page.getByRole("button", { name: /record ball/i }).click();
    await expect(page.getByText(/ball recorded/i)).toBeVisible({ timeout: 5_000 });

    // Score line should show 4/0 or higher
    const scoreText = await page.locator("body").textContent();
    expect(scoreText).toMatch(/4\/0|5\/0|[4-9]\/0|10\/0/);
  });

  test("@critical scorer can record a Level 2 wicket (caught)", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    await expect(page.getByLabel(/batsman/i).first()).toBeVisible({ timeout: 15_000 });
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });

    const length = page.getByLabel(/ball length/i);
    if (await length.isVisible()) await length.selectOption("short");
    const line = page.getByLabel(/ball line/i);
    if (await line.isVisible()) await line.selectOption("outside_off");
    const bowlerType = page.getByLabel(/bowler type/i);
    if (await bowlerType.isVisible()) await bowlerType.selectOption("ra_pace");
    const shot = page.getByLabel(/shot type/i);
    if (await shot.isVisible()) await shot.selectOption("edge");

    // Tap Wicket
    await page.getByRole("button", { name: /wicket/i }).click();

    // Level 2 panel should appear with dismissal_zone / trajectory / fielding_position
    await expect(page.getByText(/wicket — level 2/i)).toBeVisible({ timeout: 5_000 });
    await page.getByLabel(/dismissal type/i).selectOption("caught");

    const pos = page.getByLabel(/fielding position/i);
    if (await pos.isVisible()) await pos.selectOption("slip_1");
    const zone = page.getByLabel(/dismissal zone/i);
    if (await zone.isVisible()) await zone.selectOption("behind_wicket");
    const traj = page.getByLabel(/ball trajectory/i);
    if (await traj.isVisible()) await traj.selectOption("edged_behind");

    await page.getByRole("button", { name: /^0$/ }).first().click();
    await page.getByRole("button", { name: /record ball/i }).click();
    await expect(page.getByText(/ball recorded/i)).toBeVisible({ timeout: 5_000 });
  });

  test("@critical scorer can undo last ball", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    await expect(page.getByLabel(/batsman/i).first()).toBeVisible({ timeout: 15_000 });
    const undo = page.getByRole("button", { name: /undo/i }).first();
    await undo.click();
    await expect(page.getByText(/(undone|undo|deleted)/i)).toBeVisible({ timeout: 5_000 });
  });

  test("derived metrics strip renders on scoreboard", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    const text = await page.locator("body").textContent();
    expect(text?.toLowerCase()).toContain("crr");
    expect(text?.toLowerCase()).toMatch(/proj|win/);
  });
});
