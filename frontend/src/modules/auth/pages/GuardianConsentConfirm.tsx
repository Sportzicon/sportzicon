import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, humanizeError } from "../../../api/client";

export default function GuardianConsentConfirm() {
  const { token } = useParams();
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("err"); setMsg("Missing token."); return; }
    (async () => {
      try {
        await api.post("/auth/guardian-consent/confirm", { token });
        setState("ok");
      } catch (e) {
        setState("err");
        setMsg(humanizeError(e));
      }
    })();
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {state === "loading" && (
          <div className="panel p-8">
            <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto" />
            <p className="lab mt-5">Confirming guardian consent…</p>
          </div>
        )}

        {state === "ok" && (
          <div className="panel p-8">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">✓</div>
            <h1 className="font-disp text-3xl mt-5">Guardian consent confirmed</h1>
            <p className="text-sm text-ink-sub mt-3 leading-relaxed">Thanks — clubs, scouts, and organizers can now message this athlete.</p>
            <Link to="/" className="btn-primary mt-6 inline-flex w-full justify-center">Done</Link>
          </div>
        )}

        {state === "err" && (
          <div className="panel p-8">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto">✕</div>
            <h1 className="font-disp text-3xl mt-5">Confirmation failed</h1>
            <p className="text-sm text-ink-sub mt-3">{msg}</p>
            <Link to="/" className="btn-secondary mt-6 inline-flex w-full justify-center">Back to Sportzicon</Link>
          </div>
        )}
      </div>
    </div>
  );
}
