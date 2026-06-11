import axios from "axios";
import { useAuthStore } from "../store/auth";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" }
});

// Try to get main app JWT from localStorage (key "sportivox.auth" from main app)
function getMainAppToken(): string | null {
  try {
    const stored = localStorage.getItem("sportivox.auth");
    if (stored) {
      const data = JSON.parse(stored);
      return data?.state?.accessToken || null;
    }
  } catch {}
  return null;
}

// Perform SSO to get scoring JWT from main app JWT
async function ssoIfNeeded() {
  const scoringAuth = useAuthStore.getState();
  if (scoringAuth.access_token) return; // Already have scoring token

  const mainToken = getMainAppToken();
  if (!mainToken) {
    console.log("[SSO] No main app token found, user must log in to scoring app");
    return;
  }

  try {
    console.log("[SSO] Attempting to exchange main JWT for scoring JWT...");
    // Use /scoring-api path so Vite proxy forwards to scoring backend
    const { data } = await axios.post("/scoring-api/api/auth/sso", { main_token: mainToken });
    if (data.access_token) {
      console.log("[SSO] Success! Stored scoring JWT");
      scoringAuth.setAuth(data.user, data.access_token, data.refresh_token);
    } else {
      console.error("[SSO] No access_token in response:", data);
    }
  } catch (err: any) {
    console.error("[SSO] Failed:", err.response?.data || err.message);
  }
}

// Initialize SSO on first request
let ssoAttempted = false;
api.interceptors.request.use(async (config) => {
  if (!ssoAttempted) {
    ssoAttempted = true;
    await ssoIfNeeded();
  }

  const token = useAuthStore.getState().access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refresh_token, setToken, clear } = useAuthStore.getState();
      if (refresh_token) {
        try {
          const { data } = await axios.post("/api/auth/refresh", { refresh_token });
          setToken(data.access_token, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          clear();
        }
      }
    }
    return Promise.reject(err);
  }
);
