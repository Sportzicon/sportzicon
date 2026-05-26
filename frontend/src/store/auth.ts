import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (s: { user: User; accessToken: string; refreshToken: string }) => void;
  setAccessToken: (t: string) => void;
  setRefreshToken: (t: string) => void;
  setUser: (u: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setAccessToken: (t) => set({ accessToken: t }),
      setRefreshToken: (t) => set({ refreshToken: t }),
      setUser: (u) => set({ user: u }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null })
    }),
    { name: "sportivox.auth" }
  )
);
