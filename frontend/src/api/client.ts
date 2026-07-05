import axios, { AxiosError, type AxiosInstance } from "axios";
import { useAuthStore } from "../store/auth";
import { queryClient } from "../main";

const baseURL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080") + "/api/v1";

export const api: AxiosInstance = axios.create({ baseURL, timeout: 30_000, withCredentials: true });

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Refresh-token rotation: queue concurrent 401s, refresh once, then replay.
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  // Refresh token lives in an httpOnly cookie now — invisible to JS, sent automatically.
  const userAtStart = useAuthStore.getState().user;
  try {
    const r = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
    useAuthStore.getState().setSession({
      user: r.data.user,
      accessToken: r.data.access_token
    });
    return r.data.access_token as string;
  } catch {
    // Only clear if the user hasn't logged in fresh since this refresh started.
    // Guards against: stale refresh races a successful login and wipes the new session.
    if (useAuthStore.getState().user === userAtStart) {
      useAuthStore.getState().clear();
      queryClient.clear();
    }
    return null;
  }
}

// Server-side refresh tokens are single-use (rotated on every call). With the
// app open in 2+ tabs, both tabs' access tokens expire around the same time,
// so both independently POST /auth/refresh with the same cookie — the loser
// gets "Session expired" and wipes its session, which then propagates to every
// tab via the storage-based logout sync in App.tsx. That's the intermittent
// logout. Fix: serialize the actual network call across tabs with the Web
// Locks API. A tab that loses the lock rehydrates from localStorage (written
// by the winner's persisted store) and reuses that token instead of racing.
// Falls back to per-tab-only dedup on browsers without Web Locks (Safari <15.4).
export async function refreshAcrossTabs(staleToken: string | null): Promise<string | null> {
  if (!("locks" in navigator)) return doRefresh();
  return navigator.locks.request("sportivox-auth-refresh", async () => {
    await useAuthStore.persist.rehydrate();
    const current = useAuthStore.getState().accessToken;
    if (current && current !== staleToken) return current;
    return doRefresh();
  });
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError & { config?: any }) => {
    const original = error.config;
    if (!original || original._retry) return Promise.reject(error);
    // Skip refresh for auth routes (login, signup, refresh, etc.)
    const isAuthRoute = (original.url ?? "").includes("/auth/");
    if (error.response?.status === 401 && !isAuthRoute) {
      original._retry = true;
      const staleToken = useAuthStore.getState().accessToken;
      refreshing ||= refreshAcrossTabs(staleToken).finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (!newToken) return Promise.reject(error);
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return api(original);
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  code: string;
  message: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
    [key: string]: unknown;
  };
}

export function getApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (data?.error) return data.error;
    if (!err.response) return { code: "NETWORK", message: err.message };
    return { code: `HTTP_${err.response.status}`, message: err.message };
  }
  return { code: "UNKNOWN", message: String(err) };
}

/**
 * Returns a single display-ready string for any API error.
 * Handles network failures, validation field errors, and plain messages.
 */
export function humanizeError(err: unknown): string {
  if (err === null || err === undefined) return "An unexpected error occurred.";

  const apiErr = getApiError(err);

  if (apiErr.code === "NETWORK") {
    return "Unable to reach the server. Check your connection and try again.";
  }

  // If the backend already assembled a good summary message and there are
  // field errors, show the summary (set by the new errorHandler).
  if (apiErr.details?.fieldErrors) {
    const entries = Object.entries(apiErr.details.fieldErrors);
    if (entries.length === 0) return apiErr.message;
    if (entries.length === 1) {
      const [field, msgs] = entries[0];
      const label = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const msg = (msgs as string[])[0];
      return msg ? `${label}: ${msg}` : apiErr.message;
    }
    // Multiple field errors — show them as a list joined with " · "
    return entries
      .map(([field, msgs]) => {
        const label = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const msg = (msgs as string[])[0];
        return msg ? `${label}: ${msg}` : label;
      })
      .join(" · ");
  }

  return apiErr.message || "An unexpected error occurred.";
}
