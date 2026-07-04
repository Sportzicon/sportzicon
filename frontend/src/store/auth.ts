import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setSession: (s: { user: User; accessToken: string }) => void;
  setAccessToken: (t: string) => void;
  setUser: (u: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: ({ user, accessToken }) => set({ user, accessToken }),
      setAccessToken: (t) => set({ accessToken: t }),
      setUser: (u) => set({ user: u }),
      clear: () => set({ user: null, accessToken: null })
    }),
    { name: "sportivox.auth" }
  )
);
