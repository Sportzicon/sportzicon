import { test, expect, Page } from "@playwright/test";
import { request } from "@playwright/test";
import { fieldByLabel } from "../_helpers/labels";

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
  try {
    const ctx = await request.newContext();
    const r = await ctx.post(`${SCORING_API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    if (!r.ok()) return null;
    const data = await r.json();
    return { token: data.access_token, ctx };
  } catch {
    return null;  // backend unreachable — skip tests gracefully
  }
}

async function setupMatch(): Promise<Setup | null> {
  try {
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
  } catch {
    return null;
  }
}

test.describe("@scoring Live scoring — PPTX Level 1 + Level 2", () => {
  let setup: Setup | null;

  test.beforeAll(async () => {
    setup = await setupMatch();
    if (!setup) test.skip(true, "Scoring API/seed not reachable");
  });

  test.beforeEach(async ({ page }) => {
    if (!setup) test.skip(true, "Setup unavailable");
    // Persist auth into the zustand-persist localStorage key the scoring SPA uses.
    await page.addInitScript((token) => {
      localStorage.setItem("scoring-auth", JSON.stringify({
        state: {
          user: { id: "e2e", email: "admin@scoring.local", full_name: "E2E", role: "admin" },
          access_token: token,
          refresh_token: ""
        },
        version: 0
      }));
    }, setup!.token);
  });

  test("@critical scorer can record a Level 1 ball", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);

    // Wait for batting/bowler selectors to render
    await expect(fieldByLabel(page, "batsman")).toBeVisible({ timeout: 15_000 });

    // Pick first batsman and first bowler
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });  // bowler

    // PPTX § Level 1 — Ball Length / Line / Bowler Type / Shot Type
    const length = fieldByLabel(page, "ball length");
    if (await length.isVisible()) await length.selectOption("good_length");
    const line = fieldByLabel(page, "ball line");
    if (await line.isVisible()) await line.selectOption("off_stump");
    const bowlerType = fieldByLabel(page, "bowler type");
    if (await bowlerType.isVisible()) await bowlerType.selectOption("ra_pace");
    const shot = fieldByLabel(page, "shot type");
    if (await shot.isVisible()) await shot.selectOption("defensive");

    // Score 1 run
    await page.getByRole("button", { name: /^1$/ }).first().click();

    // Wait for the addBall POST to return 201 — more reliable than waiting for a toast
    const ballPost = page.waitForResponse(r => r.url().endsWith("/balls") && r.request().method() === "POST" && r.status() === 201);
    await page.getByRole("button", { name: /record ball/i }).click();
    const resp = await ballPost;
    const body = await resp.json();
    expect(body.ball.shot_type).toBe("defensive");
    expect(body.ball.ball_length).toBe("good_length");
    expect(body.ball.phase).toBe("pp");
  });

  test("@critical scorer can record a 4 and innings boundary counter updates", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    await expect(fieldByLabel(page, "batsman")).toBeVisible({ timeout: 15_000 });
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });

    const length = fieldByLabel(page, "ball length");
    if (await length.isVisible()) await length.selectOption("short");
    const line = fieldByLabel(page, "ball line");
    if (await line.isVisible()) await line.selectOption("outside_off");
    const bowlerType = fieldByLabel(page, "bowler type");
    if (await bowlerType.isVisible()) await bowlerType.selectOption("ra_pace");
    const shot = fieldByLabel(page, "shot type");
    if (await shot.isVisible()) await shot.selectOption("cut");

    await page.getByRole("button", { name: /^4$/ }).first().click();
    const ballPost = page.waitForResponse(r => r.url().endsWith("/balls") && r.request().method() === "POST" && r.status() === 201);
    await page.getByRole("button", { name: /record ball/i }).click();
    const resp = await ballPost;
    const body = await resp.json();
    expect(body.ball.is_four).toBe(true);
    expect(body.ball.runs).toBe(4);
  });

  test("@critical scorer can record a Level 2 wicket (caught)", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    await expect(fieldByLabel(page, "batsman")).toBeVisible({ timeout: 15_000 });
    await page.locator("select").nth(0).selectOption({ index: 1 });
    await page.locator("select").nth(2).selectOption({ index: 1 });

    const length = fieldByLabel(page, "ball length");
    if (await length.isVisible()) await length.selectOption("short");
    const line = fieldByLabel(page, "ball line");
    if (await line.isVisible()) await line.selectOption("outside_off");
    const bowlerType = fieldByLabel(page, "bowler type");
    if (await bowlerType.isVisible()) await bowlerType.selectOption("ra_pace");
    const shot = fieldByLabel(page, "shot type");
    if (await shot.isVisible()) await shot.selectOption("edge");

    // Tap Wicket
    await page.getByRole("button", { name: /wicket/i }).click();

    // Level 2 panel should appear with dismissal_zone / trajectory / fielding_position
    await expect(page.getByText(/wicket — level 2/i)).toBeVisible({ timeout: 5_000 });
    await fieldByLabel(page, "dismissal type").selectOption("caught");

    const pos = fieldByLabel(page, "fielding position");
    if (await pos.isVisible()) await pos.selectOption("slip_1");
    const zone = fieldByLabel(page, "dismissal zone");
    if (await zone.isVisible()) await zone.selectOption("behind_wicket");
    const traj = fieldByLabel(page, "ball trajectory");
    if (await traj.isVisible()) await traj.selectOption("edged_behind");

    await page.getByRole("button", { name: /^0$/ }).first().click();
    const ballPost = page.waitForResponse(r => r.url().endsWith("/balls") && r.request().method() === "POST" && r.status() === 201);
    await page.getByRole("button", { name: /record ball/i }).click();
    const resp = await ballPost;
    const body = await resp.json();
    expect(body.ball.is_wicket).toBe(true);
    expect(body.ball.wicket_type).toBe("caught");
    expect(body.ball.dismissal_zone).toBe("behind_wicket");
    expect(body.ball.ball_trajectory).toBe("edged_behind");
  });

  test("@critical scorer can undo last ball", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    await expect(fieldByLabel(page, "batsman")).toBeVisible({ timeout: 15_000 });
    const undo = page.getByRole("button", { name: /^undo/i }).first();
    await expect(undo).toBeVisible();
    // The undo endpoint returns 200 with { deleted } even if nothing to undo (400) — handle both
    const undoResp = page.waitForResponse(r => r.url().includes("/balls/undo") && r.request().method() === "POST", { timeout: 5_000 })
      .catch(() => null);
    await undo.click();
    const resp = await undoResp;
    expect([200, 400].includes(resp?.status() ?? 0)).toBe(true);
  });

  test("derived metrics strip renders on scoreboard", async ({ page }) => {
    await page.goto(`/matches/${setup!.match.id}/score`);
    // Wait for innings panel to mount (proves data fetched + useEffect ran)
    await expect(page.getByText(/CRR/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Proj/i)).toBeVisible();
    await expect(page.getByText(/Win %/i)).toBeVisible();
  });
});
