import axios from "axios";
import { useAuthStore } from "../store/auth";

// Axios instance pointing at the scoring backend via Vite proxy (/scoring-api → localhost:4000)
export const scoringApi = axios.create({
  baseURL: "/scoring-api/api",
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
