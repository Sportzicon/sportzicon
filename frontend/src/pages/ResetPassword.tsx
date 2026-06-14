import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, humanizeError } from "../api/client";
import { Eye, EyeOff } from "lucide-react";

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: met ? "#16a34a" : "#6b7280" }}>
      <span>{met ? "✓" : "○"}</span>
      {text}
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const meetsLength = password.length >= 8;
  const meetsUpper = /[A-Z]/.test(password);
  const meetsLower = /[a-z]/.test(password);
  const meetsDigit = /[0-9]/.test(password);
  const meetsSpecial = /[!@#$%^&*]/.test(password);
  const passwordStrong = meetsLength && meetsUpper && meetsLower && meetsDigit && meetsSpecial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordStrong) {
      setErr("Password does not meet all requirements.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      const msg = humanizeError(e);
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")) {
        navigate("/forgot-password?expired=1", { replace: true });
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="panel p-8">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">✓</div>
              <h1 className="font-disp text-3xl mt-5">Password updated</h1>
              <p className="text-sm text-ink-sub mt-3">Your password has been successfully changed. You can now sign in.</p>
              <Link to="/login" className="btn-primary mt-6 inline-flex w-full justify-center min-h-[44px] items-center">Sign in →</Link>
            </div>
          ) : (
            <>
              <div className="kicker">Account recovery</div>
              <h1 className="font-disp text-3xl mt-2">Set new password</h1>
              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <label className="block">
                  <span className="label">New password</span>
                  <div className="relative">
                    <input
                      className="input pr-9 min-h-[44px]"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <PasswordRequirement met={meetsLength} text="At least 8 characters" />
                    <PasswordRequirement met={meetsUpper} text="One uppercase letter" />
                    <PasswordRequirement met={meetsLower} text="One lowercase letter" />
                    <PasswordRequirement met={meetsDigit} text="One digit" />
                    <PasswordRequirement met={meetsSpecial} text="One special character (!@#$%^&*)" />
                  </div>
                </label>
                <label className="block">
                  <span className="label">Confirm password</span>
                  <div className="relative">
                    <input
                      className="input pr-9 min-h-[44px]"
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <span className="text-sm text-red-600 mt-1 block">Passwords do not match</span>
                  )}
                </label>
                {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
                <button className="btn-primary w-full min-h-[44px]" disabled={busy || !passwordStrong}>
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
