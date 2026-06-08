import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth";
import { useScoringAuthStore } from "../../store/scoringAuth";
import axios from "axios";
import { Target, Loader2 } from "lucide-react";

// Wraps all scoring pages.
// When a Sportivox user is logged in, auto-exchanges their JWT for a scoring JWT (SSO).
// Falls back to a manual login form only if SSO fails.
export default function ScoringGate({ children }: { children: React.ReactNode }) {
  const { scoringUser, setSession } = useScoringAuthStore();
  const { user: mainUser, accessToken: mainToken } = useAuthStore();

  const [ssoState, setSsoState] = useState<"pending" | "done" | "failed">("pending");
  const [fallbackForm, setFallbackForm] = useState({ email: mainUser?.email ?? "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already authenticated — render immediately
  if (scoringUser) return <>{children}</>;

  // Auto-SSO: runs once when the gate mounts and a main token is available
  useEffect(() => {
    if (!mainToken) {
      setSsoState("failed");
      return;
    }

    axios
      .post("/scoring-api/api/auth/sso", { main_token: mainToken }, {
        headers: { "Content-Type": "application/json" }
      })
      .then(({ data }) => {
        setSession(data.user, data.access_token, data.refresh_token);
        setSsoState("done");
      })
      .catch(() => {
        setSsoState("failed");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSO in progress — show a spinner instead of a login form
  if (ssoState === "pending") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-ink-sub">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm">Connecting to scoring console…</p>
        </div>
      </div>
    );
  }

  // SSO succeeded — scoringUser will be set, component re-renders at the top guard
  if (ssoState === "done") return null;

  // SSO failed (token expired, not configured, etc.) — show manual login as fallback
  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(
        "/scoring-api/api/auth/login",
        { email: fallbackForm.email, password: fallbackForm.password },
        { headers: { "Content-Type": "application/json" } }
      );
      setSession(data.user, data.access_token, data.refresh_token);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 w-full max-w-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-disp font-semibold text-lg text-ink leading-tight">Scoring Console</p>
            <p className="lab text-ink-sub">Sign in to your scoring account</p>
          </div>
        </div>

        {error && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <form onSubmit={submitLogin} className="space-y-3">
          <div>
            <label className="lab block mb-1">Email</label>
            <input
              className="input w-full"
              type="email"
              value={fallbackForm.email}
              onChange={e => setFallbackForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="lab block mb-1">Password</label>
            <input
              className="input w-full"
              type="password"
              value={fallbackForm.password}
              onChange={e => setFallbackForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? "…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
