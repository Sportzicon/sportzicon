import axios, { AxiosError, type AxiosInstance } from "axios";
import { useAuthStore } from "../store/auth";
import { queryClient } from "../main";

const baseURL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080") + "/api/v1";

export const api: AxiosInstance = axios.create({ baseURL, timeout: 30_000 });

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Refresh-token rotation: queue concurrent 401s, refresh once, then replay.
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const s = useAuthStore.getState();
  if (!s.refreshToken) return null;
  try {
    const r = await axios.post(`${baseURL}/auth/refresh`, { refresh_token: s.refreshToken });
    useAuthStore.getState().setSession({
      user: r.data.user,
      accessToken: r.data.access_token,
      refreshToken: r.data.refresh_token
    });
    return r.data.access_token as string;
  } catch {
    useAuthStore.getState().clear();
    queryClient.clear();
    return null;
  }
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
      refreshing ||= doRefresh().finally(() => { refreshing = null; });
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
