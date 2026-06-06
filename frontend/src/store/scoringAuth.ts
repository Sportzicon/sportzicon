import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ScoringUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface ScoringAuthState {
  user: ScoringUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: ScoringUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
}

export const useScoringAuthStore = create<ScoringAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null })
    }),
    { name: "scoring-auth" }
  )
);
