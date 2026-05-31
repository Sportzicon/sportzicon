import axios from "axios";
import { useAuthStore } from "../store/auth";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
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
