import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, humanizeError } from "../api/client";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      setErr(humanizeError(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="panel p-8">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">✓</div>
              <h1 className="font-disp text-3xl mt-5">Password updated</h1>
              <p className="text-sm text-ink-sub mt-3">Your password has been successfully changed.</p>
              <Link to="/login" className="btn-primary mt-6 inline-flex w-full justify-center">Sign in →</Link>
            </div>
          ) : (
            <>
              <div className="kicker">Account recovery</div>
              <h1 className="font-disp text-3xl mt-2">Set new password</h1>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="label">New password</span>
                  <input className="input" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
                  <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">
                    Min 8 chars · 1 uppercase · 1 lowercase · 1 digit
                  </span>
                </label>
                {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
                <button className="btn-primary w-full" disabled={busy}>
                  {busy ? "Updating…" : "Set new password →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
