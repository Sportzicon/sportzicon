import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { queryKeys } from "../../hooks/queryKeys";
import { ArrowLeft, TrendingUp, Target, Zap } from "lucide-react";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel p-4 text-center">
      <p className="lab text-ink-sub">{label}</p>
      <p className="font-disp text-3xl font-bold text-ink mt-1">{value}</p>
      {hint && <p className="lab text-ink-faint mt-1">{hint}</p>}
    </div>
  );
}

function DistributionBars({ data, kind }: { data: Record<string, any>; kind: string }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1].balls - a[1].balls);
  const max = Math.max(1, ...rows.map(([, v]) => v.balls));
  return (
    <div className="space-y-1.5">
      {rows.length === 0 && <p className="lab text-ink-faint">No balls recorded yet.</p>}
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-32 lab text-ink-sub truncate capitalize">{k.replace(/_/g, " ")}</span>
          <div className="flex-1 bg-fill rounded h-4 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-brand-500" style={{ width: `${(v.balls / max) * 100}%` }} />
          </div>
          <span className="font-mononum w-12 text-right lab text-ink-sub">{v.balls}b</span>
          <span className="font-mononum w-14 text-right lab text-ink-faint">{v.runs}r</span>
          {kind !== "shot" && <span className="font-mononum w-10 text-right lab text-red-500">{v.wickets ?? 0}w</span>}
        </div>
      ))}
    </div>
  );
}

function ScoringInningsAnalyticsInner() {
  const { inningsId } = useParams<{ inningsId: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.scoringInningsAnalytics(inningsId ?? ""),
    queryFn: () => scoringApi.get(`/innings/${inningsId}/analytics`).then(r => r.data),
    enabled: Boolean(inningsId), refetchInterval: 10_000
  });

  const { data: partnerships } = useQuery({
    queryKey: queryKeys.scoringInningsPartnerships(inningsId ?? ""),
    queryFn: () => scoringApi.get(`/innings/${inningsId}/partnerships`).then(r => r.data.partnerships),
    enabled: Boolean(inningsId)
  });

  if (isLoading || !data) return <div className="animate-pulse space-y-4"><div className="h-32 bg-fill rounded-xl" /><div className="h-64 bg-fill rounded-xl" /></div>;

  const inn = data.innings;
  const pat = data.dismissal_patterns ?? {};
  const phases = inn?.phase ?? {};
  const oversFromBalls = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
  const econ = (runs: number, balls: number) => balls > 0 ? ((runs / balls) * 6).toFixed(2) : "—";

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-disp font-bold text-2xl text-ink flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Innings Analytics
        </h1>
        <button onClick={() => inn?.match_id ? navigate(`/scoring/matches/${inn.match_id}`) : navigate(-1)}
          className="btn-ghost text-sm flex items-center gap-1 text-ink-sub">
          <ArrowLeft className="w-4 h-4" /> Back to match
        </button>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Outside off %" value={pat.outside_off_pct != null ? `${pat.outside_off_pct}%` : "—"} hint={pat.total_wickets != null ? `${pat.total_wickets} wkts` : undefined} />
        <StatCard label="Wkts off spin" value={pat.vs_spin_pct != null ? `${pat.vs_spin_pct}%` : "—"} />
        <StatCard label="Wkts off pace" value={pat.vs_pace_pct != null ? `${pat.vs_pace_pct}%` : "—"} />
        <StatCard label="Win probability" value={inn?.win_probability != null ? `${inn.win_probability}%` : "—"} hint={`Proj ${inn?.projected_score ?? "—"}`} />
      </div>

      {/* Phase performance */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2"><Target className="w-5 h-5" /> Phase performance</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {(["pp", "mid", "death"] as const).map(p => (
            <div key={p} className="panel p-4">
              <p className="lab text-ink-sub mb-1">{p === "pp" ? "Powerplay" : p === "mid" ? "Middle" : "Death"}</p>
              <p className="font-disp text-2xl font-bold text-ink">{phases[p]?.runs ?? 0}/{phases[p]?.wickets ?? 0}</p>
              <p className="lab text-ink-faint mt-1">{oversFromBalls(phases[p]?.balls ?? 0)} ov · Econ {econ(phases[p]?.runs ?? 0, phases[p]?.balls ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Distributions */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Length distribution</h3>
          <DistributionBars data={data.length_distribution} kind="length" />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-3">Line distribution</h3>
          <DistributionBars data={data.line_distribution} kind="line" />
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-ink mb-3">Shot distribution</h3>
          <DistributionBars data={data.shot_distribution} kind="shot" />
        </div>
      </div>

      {/* Partnerships */}
      {(partnerships?.length ?? 0) > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-4">Partnerships</h3>
          <div className="space-y-2">
            {partnerships.map((p: any) => (
              <div key={p.id} className="flex items-center gap-4 py-2 border-b border-hairsoft last:border-0">
                <span className="lab text-ink-sub w-6">{p.wicket_number}</span>
                <span className="font-mononum font-bold text-ink text-lg w-16">{p.runs}</span>
                <span className="lab text-ink-faint">{p.balls} balls · {p.fours}×4 · {p.sixes}×6</span>
                {p.is_unbroken && <span className="lab text-emerald-600 ml-auto">unbroken</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoringInningsAnalytics() {
  return <ScoringInningsAnalyticsInner />;
}
