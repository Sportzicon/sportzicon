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
      setDone(true); // always show the same confirmation — don't leak which emails exist
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <h1 className="text-xl font-semibold">Reset your password</h1>
          {done ? (
            <p className="mt-3 text-sm text-slate-600">
              If an account exists for <strong>{email}</strong>, we've sent a reset link. Check your inbox.
              <br />
              <Link to="/login" className="text-brand-700 font-medium">Back to sign in</Link>
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button className="btn-primary w-full" disabled={busy}>Send reset link</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
