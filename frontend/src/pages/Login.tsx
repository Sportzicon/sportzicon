import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";

export default function Login() {
  const navigate = useNavigate();
  const loc = useLocation();
  const { setSession } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const r = await api.post("/auth/login", { email, password });
      setSession({ user: r.data.user, accessToken: r.data.access_token, refreshToken: r.data.refresh_token });
      const to = (loc.state as any)?.from?.pathname ?? "/dashboard";
      navigate(to, { replace: true });
    } catch (e) {
      setErr(getApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">S</span>
            <span className="text-lg font-semibold tracking-tight">Sportivox</span>
          </div>
          <h1 className="text-xl font-semibold text-center">Sign in to your account</h1>
          <p className="mt-1 text-center text-sm text-slate-600">New here? <Link to="/signup" className="text-brand-700 font-medium">Create an account</Link></p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <div className="mt-1 text-right text-xs">
                <Link to="/forgot-password" className="text-brand-700">Forgot your password?</Link>
              </div>
            </div>
            {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
            <button className="btn-primary w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
