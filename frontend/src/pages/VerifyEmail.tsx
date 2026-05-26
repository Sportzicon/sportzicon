import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getApiError } from "../api/client";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("err");
      setMsg("Missing token.");
      return;
    }
    (async () => {
      try {
        await api.post("/auth/verify-email", { token });
        setState("ok");
      } catch (e) {
        setState("err");
        setMsg(getApiError(e).message);
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md text-center">
        <div className="card-body">
          {state === "loading" && <p>Verifying your email...</p>}
          {state === "ok" && (
            <>
              <h1 className="text-xl font-semibold">Email verified</h1>
              <p className="mt-2 text-sm text-slate-600">You can now sign in to your account.</p>
              <Link to="/login" className="btn-primary mt-6 inline-flex">Go to sign in</Link>
            </>
          )}
          {state === "err" && (
            <>
              <h1 className="text-xl font-semibold text-red-700">Verification failed</h1>
              <p className="mt-2 text-sm text-slate-600">{msg}</p>
              <Link to="/login" className="btn-secondary mt-6 inline-flex">Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
