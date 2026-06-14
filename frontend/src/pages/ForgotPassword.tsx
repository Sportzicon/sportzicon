import { useState } from "react";
import { Link } from "react-router-dom";
import { api, humanizeError } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="panel p-8">
          {submitted ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center text-2xl mx-auto">✉</div>
              <h1 className="font-disp text-3xl mt-5">Check your inbox</h1>
              <p className="text-sm text-ink-sub mt-3 leading-relaxed">
                If that email is registered, we've sent a reset link to <strong className="text-ink">{email}</strong>.
                The link expires in 30 minutes.
              </p>
              <p className="text-sm text-ink-sub mt-2 leading-relaxed">
                Don't see it? Check your <strong className="text-ink">spam or junk folder</strong>.
              </p>
              <Link to="/login" className="btn-ghost mt-5 inline-flex w-full justify-center min-h-[44px] items-center">← Back to sign in</Link>
            </div>
          ) : (
            <>
              <div className="kicker">Account recovery</div>
              <h1 className="font-disp text-3xl mt-2">Reset password</h1>
              <p className="text-sm text-ink-sub mt-2 leading-relaxed">Enter the email address linked to your account and we'll send a reset link.</p>
              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <label className="block">
                  <span className="label">Email</span>
                  <input
                    className="input min-h-[44px]"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
                <button className="btn-primary w-full min-h-[44px]" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link →"}
                </button>
                <div className="text-center">
                  <Link to="/login" className="lab text-ink-sub hover:text-ink">← Back to sign in</Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
