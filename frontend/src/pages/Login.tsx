import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";

export default function Login() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setEmailUnverified(false);
    setResendSent(false);
    try {
      const r = await api.post("/auth/login", { email, password });
      setSession({ user: r.data.user, accessToken: r.data.access_token, refreshToken: r.data.refresh_token });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      const apiErr = getApiError(e);
      if (apiErr.code === "NETWORK") {
        setErr("Unable to reach the server. Check your internet connection or try again in a moment.");
      } else {
        if (apiErr.message.toLowerCase().includes("not verified")) setEmailUnverified(true);
        setErr(apiErr.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    try {
      await api.post("/auth/resend-verification", { email });
      setResendSent(true);
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-[420px_1fr]">
      {/* left ink rail */}
      <div className="hidden lg:flex flex-col bg-ink text-paper px-10 py-12">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-500 font-disp text-lg text-white">S</span>
          <span className="font-disp text-2xl text-paper">Sportivox</span>
        </Link>
        <h1 className="font-disp text-5xl text-paper mt-14 leading-[0.97]">
          Welcome<br />back.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-white/60 max-w-xs">
          The verified sports recruitment network. Sign in to your account to access opportunities, messages and your profile.
        </p>
        <div className="mt-auto space-y-3">
          {[["Verified profiles", "Every badge-holder is identity-checked."],
            ["Structured workflow", "Pending → Shortlisted → Selected."],
            ["Real opportunities", "Trials, scholarships, coaching jobs."]
          ].map(([t, d]) => (
            <div key={t} className="flex gap-3">
              <span className="text-brand-500 mt-0.5">◆</span>
              <div>
                <div className="text-[13px] font-semibold text-paper/90">{t}</div>
                <div className="text-[12px] text-white/50 leading-snug">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* right form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="flex lg:hidden items-baseline gap-2 mb-8">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-500 font-disp text-lg text-white">S</span>
            <span className="font-disp text-xl">Sportivox</span>
          </Link>

          <div className="kicker">Account access</div>
          <h2 className="font-disp text-4xl mt-2">Sign in</h2>
          <p className="lab mt-3">
            New here?{" "}
            <Link to="/signup" className="text-brand-500 normal-case tracking-normal text-[11px]">Create an account →</Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="block">
              <div className="flex items-center justify-between mb-1.5">
                <span className="label" style={{ marginBottom: 0 }}>Password</span>
                <Link to="/forgot-password" className="font-mononum text-[10px] text-brand-500 uppercase tracking-[0.1em]">Forgot?</Link>
              </div>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

            {emailUnverified && !resendSent && (
              <div className="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Email not verified.{" "}
                <button type="button" onClick={resendVerification} className="font-semibold underline hover:no-underline">
                  Resend link
                </button>
              </div>
            )}
            {resendSent && (
              <div className="rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                ✓ Verification email sent — check your inbox.
              </div>
            )}

            <button className="btn-primary w-full mt-2" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
