import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setSession: (s: { user: User; accessToken: string }) => void;
  setAccessToken: (t: string) => void;
  setUser: (u: User) => void;
  clear: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      hasHydrated: false,
      setSession: ({ user, accessToken }) => set({ user, accessToken }),
      setAccessToken: (t) => set({ accessToken: t }),
      setUser: (u) => set({ user: u }),
      clear: () => set({ user: null, accessToken: null }),
      setHasHydrated: (v) => set({ hasHydrated: v })
    }),
    {
      name: "sportivox.auth",
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
      // Rehydration from localStorage runs synchronously inside create() (since
      // localStorage itself is synchronous) — i.e. before the `useAuthStore`
      // binding below even exists. Referencing `useAuthStore` from in here hits
      // a temporal-dead-zone error. Call the setter on the hydrated `state`
      // snapshot the callback receives instead, never the outer binding.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
