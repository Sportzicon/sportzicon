import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../models";

/**
 * Stores the scoring-backend-specific JWT session.
 * The scoring backend runs separately and issues its own tokens via SSO
 * (ScoringGate exchanges the main Sportivox JWT for a scoring JWT).
 *
 * User identity is shared with the main auth store — we reuse the User model
 * rather than maintaining a parallel interface.
 */
interface ScoringAuthState {
  scoringUser:  User | null;
  accessToken:  string | null;
  refreshToken: string | null;
  setSession:   (user: User, accessToken: string, refreshToken: string) => void;
  setTokens:    (accessToken: string, refreshToken: string) => void;
  clear:        () => void;
}

export const useScoringAuthStore = create<ScoringAuthState>()(
  persist(
    (set) => ({
      scoringUser:  null,
      accessToken:  null,
      refreshToken: null,
      setSession:   (scoringUser, accessToken, refreshToken) =>
        set({ scoringUser, accessToken, refreshToken }),
      setTokens:    (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      clear: () =>
        set({ scoringUser: null, accessToken: null, refreshToken: null }),
    }),
    { name: "scoring-auth" }
  )
);
