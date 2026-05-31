import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface AuthState {
  user: AuthUser | null;
  access_token: string | null;
  refresh_token: string | null;
  setAuth: (user: AuthUser, access_token: string, refresh_token: string) => void;
  setToken: (access_token: string, refresh_token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access_token: null,
      refresh_token: null,
      setAuth: (user, access_token, refresh_token) => set({ user, access_token, refresh_token }),
      setToken: (access_token, refresh_token) => set({ access_token, refresh_token }),
      clear: () => set({ user: null, access_token: null, refresh_token: null })
    }),
    { name: "scoring-auth" }
  )
);
