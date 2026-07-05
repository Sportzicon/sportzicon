import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/auth";
import { useScoringAuthStore } from "../../../store/scoringAuth";
import axios from "axios";
import { Target, Loader2 } from "lucide-react";

// Wraps all scoring pages.
// When a Sportivox user is logged in, auto-exchanges their JWT for a scoring JWT (SSO).
// There is no separate scoring account — if SSO fails, the fix is to log into Sportivox.
export default function ScoringGate({ children }: { children: React.ReactNode }) {
  const { scoringUser, setSession } = useScoringAuthStore();
  const { accessToken: mainToken } = useAuthStore();

  const [ssoState, setSsoState] = useState<"pending" | "done" | "failed">("pending");

  useEffect(() => {
    if (scoringUser) return;
    if (!mainToken) {
      setSsoState("failed");
      return;
    }

    axios
      .post("/scoring-api/api/auth/sso", { main_token: mainToken }, {
        headers: { "Content-Type": "application/json" }
      })
      .then(({ data }) => {
        setSession(data.user, data.access_token);
        setSsoState("done");
      })
      .catch(() => {
        setSsoState("failed");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (scoringUser) return <>{children}</>;

  if (ssoState === "pending") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-ink-sub">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm">Connecting to scoring console…</p>
        </div>
      </div>
    );
  }

  if (ssoState === "done") return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 w-full max-w-sm space-y-4 text-center">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center mx-auto">
          <Target className="w-5 h-5 text-white" />
        </div>
        <p className="font-disp font-semibold text-lg text-ink">Scoring Console</p>
        <p className="text-sm text-ink-sub">
          You need to be signed in to Sportivox to use the scoring console.
        </p>
        <a href="/login" className="btn-primary w-full justify-center min-h-[44px] inline-flex items-center">
          Go to Sign In
        </a>
      </div>
    </div>
  );
}
