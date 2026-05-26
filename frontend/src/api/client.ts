import axios, { AxiosError, type AxiosInstance } from "axios";
import { useAuthStore } from "../store/auth";

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
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError & { config?: any }) => {
    const original = error.config;
    if (!original || original._retry) return Promise.reject(error);
    if (error.response?.status === 401 && !original.url?.includes("/auth/")) {
      original._retry = true;
      refreshing ||= doRefresh().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (!newToken) return Promise.reject(error);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function getApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (data?.error) return data.error;
    return { code: "NETWORK", message: err.message };
  }
  return { code: "UNKNOWN", message: String(err) };
}
