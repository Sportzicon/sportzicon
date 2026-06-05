import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, humanizeError } from "../api/client";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setState("err"); setMsg("Missing token."); return; }
    (async () => {
      try {
        await api.post("/auth/verify-email", { token });
        setState("ok");
      } catch (e) {
        setState("err");
        setMsg(humanizeError(e));
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {state === "loading" && (
          <div className="panel p-8">
            <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto" />
            <p className="lab mt-5">Verifying your email…</p>
          </div>
        )}

        {state === "ok" && (
          <div className="panel p-8">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">✓</div>
            <h1 className="font-disp text-3xl mt-5">Email verified</h1>
            <p className="text-sm text-ink-sub mt-3 leading-relaxed">Your account is now active. Sign in to get started.</p>
            <Link to="/login" className="btn-primary mt-6 inline-flex w-full justify-center">Sign in →</Link>
          </div>
        )}

        {state === "err" && (
          <div className="panel p-8">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto">✕</div>
            <h1 className="font-disp text-3xl mt-5">Verification failed</h1>
            <p className="text-sm text-ink-sub mt-3">{msg}</p>
            <Link to="/login" className="btn-secondary mt-6 inline-flex w-full justify-center">Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
