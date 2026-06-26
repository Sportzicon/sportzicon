import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getApiError } from "../api/client";
import { authService } from "../services";
import { useAuthStore } from "../store/auth";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { setSession, user, accessToken } = useAuthStore();

  if (user && accessToken) return <Navigate to="/dashboard" replace />;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setEmailUnverified(false);
    setResendSent(false);
    try {
      const r = await authService.login({ email, password });
      setSession({ user: r.user, accessToken: r.access_token, refreshToken: r.refresh_token });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      const apiErr = getApiError(e);
      if (apiErr.code === "NETWORK") {
        setErr("Unable to reach the server. Check your internet connection or try again in a moment.");
      } else if (apiErr.code === "RATE_LIMITED") {
        setErr("Too many attempts. Please try again in a few minutes.");
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
      await authService.resendVerification(email);
      setResendSent(true);
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-paper grid lg:grid-cols-[420px_1fr]">
      {/* left ink rail */}
      <div className="hidden lg:flex flex-col bg-ink text-paper px-10 py-12">
        <h1 className="font-disp text-5xl text-paper leading-[0.97]">
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
      <div className="flex items-start justify-center px-6 pt-14 pb-12">
        <div className="w-full max-w-sm">
          <div className="kicker">Account access</div>
          <h2 className="font-disp text-4xl mt-2">Sign in</h2>
          <p className="lab mt-3">
            New here?{" "}
            <Link to="/signup" className="text-brand-500 normal-case tracking-normal text-[11px]">Create an account →</Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <label className="block">
              <span className="label">Email</span>
              <input className="input min-h-[44px]" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="block">
              <div className="flex items-center justify-between mb-1.5">
                <span className="label" style={{ marginBottom: 0 }}>Password</span>
                <Link to="/forgot-password" className="font-mononum text-[10px] text-brand-500 uppercase tracking-[0.1em]">Forgot?</Link>
              </div>
              <div className="relative">
                <input className="input pr-9 min-h-[44px]" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition" tabIndex={-1}>
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

            {emailUnverified && !resendSent && (
              <div className="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Email not verified — check your inbox (and spam/junk folder) for the verification link.{" "}
                <button type="button" onClick={resendVerification} className="font-semibold underline hover:no-underline">
                  Resend link
                </button>
              </div>
            )}
            {resendSent && (
              <div className="rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                ✓ Verification email sent — check your inbox and <strong>spam/junk folder</strong>.
              </div>
            )}

            <button className="btn-primary w-full mt-2 min-h-[44px]" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
