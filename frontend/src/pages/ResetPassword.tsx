import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getApiError } from "../api/client";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      setErr(getApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <h1 className="text-xl font-semibold">Reset your password</h1>
          {done ? (
            <p className="mt-3 text-sm text-slate-600">
              Your password has been updated.{" "}
              <Link to="/login" className="text-brand-700 font-medium">Sign in</Link>
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <p className="text-xs text-slate-500 mt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 digit.</p>
              </div>
              {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
              <button className="btn-primary w-full" disabled={busy}>Set new password</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
