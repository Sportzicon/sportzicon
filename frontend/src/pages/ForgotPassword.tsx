import { useState } from "react";
import { Link } from "react-router-dom";
import { api, humanizeError } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setFound(null);
    try {
      const r = await api.post("/auth/forgot-password", { email });
      const f = r.data?.found;
      if (typeof f === "boolean") {
        setFound(f);
      } else {
        setErr("Unexpected server response. Please try again.");
      }
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  const submitted = found !== null;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="panel p-8">
          {submitted ? (
            <div className="text-center">
              {found ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center text-2xl mx-auto">✉</div>
                  <h1 className="font-disp text-3xl mt-5">Check your inbox</h1>
                  <p className="text-sm text-ink-sub mt-3 leading-relaxed">
                    We've sent a password reset link to <strong className="text-ink">{email}</strong>.
                    The link expires in 30 minutes.
                  </p>
                  <p className="text-sm text-ink-sub mt-2 leading-relaxed">
                    Don't see it? Check your <strong className="text-ink">spam or junk folder</strong>.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl mx-auto">✕</div>
                  <h1 className="font-disp text-3xl mt-5">Email not found</h1>
                  <p className="text-sm text-ink-sub mt-3 leading-relaxed">
                    No account is registered with <strong className="text-ink">{email}</strong>.
                    Please check the address or create a new account.
                  </p>
                  <button
                    onClick={() => { setFound(null); setErr(null); }}
                    className="btn-secondary mt-4 inline-flex w-full justify-center"
                  >
                    Try a different email
                  </button>
                  <Link to="/signup" className="btn-primary mt-3 inline-flex w-full justify-center">Create an account →</Link>
                </>
              )}
              <Link to="/login" className="btn-ghost mt-4 inline-flex w-full justify-center">← Back to sign in</Link>
            </div>
          ) : (
            <>
              <div className="kicker">Account recovery</div>
              <h1 className="font-disp text-3xl mt-2">Reset password</h1>
              <p className="text-sm text-ink-sub mt-2 leading-relaxed">Enter the email address linked to your account and we'll send a reset link.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="label">Email</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </label>
                {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
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
