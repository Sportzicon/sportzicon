import axios from "axios";
import { useAuthStore } from "../store/auth";

// In dev, Vite proxies /scoring-api → localhost:4000 (vite.config.ts).
// In production, VITE_SCORING_API_URL is baked in at build time pointing to the scoring backend directly.
// Falls back to the proxy path so local dev still works without setting the env var.
export const scoringApi = axios.create({
  baseURL: (import.meta.env.VITE_SCORING_API_URL as string | undefined) ?? "/scoring-api/api",
  headers: { "Content-Type": "application/json" }
});

// Attach the main Sportivox JWT — no separate scoring login needed
scoringApi.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Reject errors without triggering the main app's auth logout flow
scoringApi.interceptors.response.use(
  (r) => r,
  (err) => Promise.reject(err)
);
