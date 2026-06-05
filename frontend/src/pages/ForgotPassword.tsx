import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } finally {
      setBusy(false);
      setDone(true);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="panel p-8">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center text-2xl mx-auto">✉</div>
              <h1 className="font-disp text-3xl mt-5">Check your inbox</h1>
              <p className="text-sm text-ink-sub mt-3 leading-relaxed">
                If an account exists for <strong className="text-ink">{email}</strong>, we've sent a reset link.
              </p>
              <Link to="/login" className="btn-secondary mt-6 inline-flex w-full justify-center">← Back to sign in</Link>
            </div>
          ) : (
            <>
              <div className="kicker">Account recovery</div>
              <h1 className="font-disp text-3xl mt-2">Reset password</h1>
              <p className="text-sm text-ink-sub mt-2 leading-relaxed">Enter your email and we'll send a reset link if an account exists.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="label">Email</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </label>
                <button className="btn-primary w-full" disabled={busy}>
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
