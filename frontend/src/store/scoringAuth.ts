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
  setSession:   (user: User, accessToken: string) => void;
  clear:        () => void;
}

export const useScoringAuthStore = create<ScoringAuthState>()(
  persist(
    (set) => ({
      scoringUser:  null,
      accessToken:  null,
      setSession:   (scoringUser, accessToken) =>
        set({ scoringUser, accessToken }),
      clear: () =>
        set({ scoringUser: null, accessToken: null }),
    }),
    { name: "scoring-auth" }
  )
);
