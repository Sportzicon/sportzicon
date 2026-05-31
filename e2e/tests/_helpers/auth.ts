import { Page, request, APIRequestContext } from "@playwright/test";

// Helpers for getting a scoring-app session in tests without going through
// the login UI. Persists auth into the zustand-persist localStorage key
// that the scoring SPA reads (`scoring-auth`).

export type ScoringSession = {
  ctx: APIRequestContext;
  token: string;
  user: { id: string; email: string; full_name: string; role: string };
};

export async function scoringApiLogin(apiBase: string, email: string, password: string): Promise<ScoringSession | null> {
  try {
    const ctx = await request.newContext();
    const r = await ctx.post(`${apiBase}/auth/login`, { data: { email, password } });
    if (!r.ok()) return null;
    const data = await r.json();
    return { ctx, token: data.access_token, user: data.user };
  } catch {
    return null;
  }
}

/** Inject auth into localStorage so the SPA boots already signed-in. */
export async function persistScoringAuth(page: Page, session: ScoringSession) {
  await page.addInitScript((s) => {
    const payload = {
      state: {
        user: s.user,
        access_token: s.token,
        refresh_token: ""
      },
      version: 0
    };
    localStorage.setItem("scoring-auth", JSON.stringify(payload));
  }, session as any);
}
