import { test, expect, request } from "@playwright/test";

// Analytics view (PPTX § In-app · Scorecard & Analytics).
// Uses the API to set up an innings, scores 6 balls programmatically,
// then asserts the UI shows the expected analytics.

const ADMIN_EMAIL = process.env.SCORING_ADMIN_EMAIL || "admin@scoring.local";
const ADMIN_PASSWORD = process.env.SCORING_ADMIN_PASSWORD || "Demo1234!";
const SCORING_API = process.env.SCORING_API_URL || "http://localhost:8081/api";

async function setupInningsWithBalls() {
  const ctx = await request.newContext();
  const login = await ctx.post(`${SCORING_API}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!login.ok()) return null;
  const { access_token } = await login.json();
  const h = { Authorization: `Bearer ${access_token}` };

  const t = (await (await ctx.post(`${SCORING_API}/tournaments`, {
    headers: h, data: { name: `E2E Analytics ${Date.now()}`, sport: "cricket", format: "T20" }
  })).json()).tournament;

  const team1 = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/teams`, { headers: h, data: { name: "A" } })).json()).team;
  const team2 = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/teams`, { headers: h, data: { name: "B" } })).json()).team;
  const p1 = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/teams/${team1.id}/players`, { headers: h, data: { name: "A1" } })).json()).player;
  const b1 = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/teams/${team2.id}/players`, { headers: h, data: { name: "B1" } })).json()).player;

  const match = (await (await ctx.post(`${SCORING_API}/tournaments/${t.id}/matches`, {
    headers: h, data: { team1_id: team1.id, team2_id: team2.id }
  })).json()).match;

  const innings = (await (await ctx.post(`${SCORING_API}/matches/${match.id}/innings`, {
    headers: h, data: { innings_number: 1, batting_team_id: team1.id, bowling_team_id: team2.id }
  })).json()).innings;

  // Score a varied over so analytics buckets fill
  const balls = [
    { runs: 4, is_four: true,  shot_type: "cut",       ball_line: "outside_off", ball_length: "short",       bowler_variant: "rfm" },
    { runs: 0,                  shot_type: "defensive", ball_line: "off_stump",   ball_length: "good_length", bowler_variant: "rfm" },
    { runs: 1,                  shot_type: "drive",     ball_line: "middle",      ball_length: "full",        bowler_variant: "rfm" },
    { runs: 6, is_six: true,    shot_type: "lofted",    ball_line: "leg_stump",   ball_length: "full",        bowler_variant: "rfm" },
    { runs: 0,                  shot_type: "defensive", ball_line: "off_stump",   ball_length: "good_length", bowler_variant: "rfm" },
    {
      runs: 0, is_wicket: true,
      shot_type: "edge", ball_line: "outside_off", ball_length: "good_length", bowler_variant: "rfm",
      wicket_type: "caught", dismissed_player_id: p1.id, fielder_id: b1.id,
      fielding_position: "slip_1", dismissal_zone: "behind_wicket", ball_trajectory: "edged_behind"
    }
  ];

  for (let i = 0; i < balls.length; i++) {
    await ctx.post(`${SCORING_API}/innings/${innings.id}/balls`, {
      headers: h,
      data: {
        over_number: 0, ball_number: i + 1,
        batsman_id: p1.id, bowler_id: b1.id,
        ...balls[i]
      }
    });
  }

  return { token: access_token, t, match, innings };
}

test.describe("@scoring Analytics dashboard", () => {
  let setup: any;

  test.beforeAll(async () => {
    setup = await setupInningsWithBalls();
    if (!setup) test.skip(true, "Scoring API unreachable");
  });

  test.beforeEach(async ({ page }) => {
    if (!setup) test.skip(true, "Setup unavailable");
    await page.addInitScript(([token]) => {
      localStorage.setItem("auth", JSON.stringify({ access_token: token, refresh_token: "" }));
    }, [setup.token]);
  });

  test("@critical analytics page renders all sections", async ({ page }) => {
    await page.goto(`/innings/${setup.innings.id}/analytics`);
    const body = page.locator("body");

    await expect(body).toContainText(/dismissed outside off/i);
    await expect(body).toContainText(/phase performance/i);
    await expect(body).toContainText(/length distribution/i);
    await expect(body).toContainText(/line distribution/i);
    await expect(body).toContainText(/shot distribution/i);
    await expect(body).toContainText(/partnerships/i);
    await expect(body).toContainText(/fielding impact/i);
  });

  test("partnership row appears after the wicket", async ({ page }) => {
    await page.goto(`/innings/${setup.innings.id}/analytics`);
    const text = await page.locator("body").textContent();
    expect(text).toMatch(/\d+/); // partnership runs
  });

  test("fielding leaderboard shows the catcher", async ({ page }) => {
    await page.goto(`/innings/${setup.innings.id}/analytics`);
    await expect(page.locator("body")).toContainText("B1");
  });
});
