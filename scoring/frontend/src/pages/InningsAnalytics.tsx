import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ArrowLeft, TrendingUp, Target, Zap } from "lucide-react";

// PPTX § In-app · Scorecard & Analytics — shows dismissal patterns, pitch map,
// shot distribution, phase splits and the headline "key numbers" cards.

type Counts = Record<string, { balls: number; runs: number; wickets?: number; dots?: number; fours?: number; sixes?: number }>;

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function DistributionBars({ data, kind }: { data: Counts; kind: "length" | "line" | "shot" }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1].balls - a[1].balls);
  const max = Math.max(1, ...rows.map(([, v]) => v.balls));
  return (
    <div className="space-y-1.5">
      {rows.length === 0 && <p className="text-xs text-gray-400">No balls recorded yet.</p>}
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-32 text-xs text-gray-600 truncate capitalize">{k.replace(/_/g, " ")}</span>
          <div className="flex-1 bg-gray-100 rounded-md h-5 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(v.balls / max) * 100}%` }} />
          </div>
          <span className="w-14 text-right text-xs font-medium">{v.balls}b</span>
          <span className="w-16 text-right text-xs text-gray-500">{v.runs}r</span>
          {kind !== "shot" && <span className="w-12 text-right text-xs text-red-600">{v.wickets ?? 0}w</span>}
        </div>
      ))}
    </div>
  );
}

export default function InningsAnalytics() {
  const { inningsId } = useParams<{ inningsId: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["innings-analytics", inningsId],
    queryFn: () => api.get(`/innings/${inningsId}/analytics`).then(r => r.data),
    enabled: Boolean(inningsId),
    refetchInterval: 10_000
  });

  const { data: partnerships } = useQuery({
    queryKey: ["innings-partnerships", inningsId],
    queryFn: () => api.get(`/innings/${inningsId}/partnerships`).then(r => r.data.partnerships),
    enabled: Boolean(inningsId)
  });

  const { data: fielding } = useQuery({
    queryKey: ["innings-fielding", inningsId],
    queryFn: () => api.get(`/innings/${inningsId}/fielding`).then(r => r.data.fielding),
    enabled: Boolean(inningsId)
  });

  if (isLoading || !data) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-100 rounded-xl" /><div className="h-64 bg-gray-100 rounded-xl" /></div>;
  }

  const inn = data.innings;
  const pat = data.dismissal_patterns ?? {};
  const phases = inn?.phase ?? {};

  const oversFromBalls = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
  const econ = (runs: number, balls: number) => (balls > 0 ? ((runs / balls) * 6).toFixed(2) : "—");

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Innings Analytics
        </h1>
        <button onClick={() => data?.innings?.match_id ? navigate(`/matches/${data.innings.match_id}`) : navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* PPTX § Analytics — Key Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Dismissed outside off" value={pat.outside_off_pct != null ? `${pat.outside_off_pct}%` : "—"} hint={pat.total_wickets != null ? `${pat.total_wickets} wkts` : undefined} />
        <StatCard label="Wkts off spin" value={pat.vs_spin_pct != null ? `${pat.vs_spin_pct}%` : "—"} />
        <StatCard label="Wkts off pace" value={pat.vs_pace_pct != null ? `${pat.vs_pace_pct}%` : "—"} />
        <StatCard label="Win probability" value={inn?.win_probability != null ? `${inn.win_probability}%` : "—"} hint={`Proj ${inn?.projected_score ?? "—"}`} />
      </div>

      {/* Phase splits — PPTX § Team · Phase performance */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Target className="w-5 h-5" /> Phase performance</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {(["pp", "mid", "death"] as const).map(p => (
            <div key={p} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500">{p === "pp" ? "Powerplay" : p === "mid" ? "Middle" : "Death"}</p>
              <p className="text-2xl font-bold mt-1">{phases[p]?.runs ?? 0}/{phases[p]?.wickets ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">{oversFromBalls(phases[p]?.balls ?? 0)} ov · Econ {econ(phases[p]?.runs ?? 0, phases[p]?.balls ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pitch map: length / line distribution */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Length distribution</h3>
          <DistributionBars data={data.length_distribution} kind="length" />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Line distribution</h3>
          <DistributionBars data={data.line_distribution} kind="line" />
        </div>
      </div>

      {/* Shot wagon-wheel proxy */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3">Shot distribution (PPTX § Strong scoring zone)</h3>
        <DistributionBars data={data.shot_distribution} kind="shot" />
      </div>

      {/* Partnerships */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="w-5 h-5" /> Partnerships</h3>
        {(!partnerships || partnerships.length === 0) ? (
          <p className="text-sm text-gray-400">No partnerships yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr><th className="py-2">Wkt</th><th>Runs</th><th>Balls</th><th>4s</th><th>6s</th><th>Status</th></tr>
            </thead>
            <tbody>
              {partnerships.map((p: any) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="py-2">{p.wicket_number + 1}</td>
                  <td className="font-medium">{p.runs}</td>
                  <td>{p.balls}</td>
                  <td>{p.fours}</td>
                  <td>{p.sixes}</td>
                  <td>{p.is_unbroken ? <span className="text-emerald-600">Unbroken</span> : <span className="text-gray-500">Ended {p.ended_over}.{p.ended_ball}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Fielding impact (PPTX § Fielder) */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3">Fielding impact</h3>
        {(!fielding || fielding.length === 0) ? (
          <p className="text-sm text-gray-400">No fielding events yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2">Player</th><th>Catches</th><th>Drops</th>
                <th>Run-outs</th><th>Stumpings</th><th>Misfields</th><th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {fielding.map((f: any) => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="py-2 font-medium">{f.player?.name} {f.player?.is_keeper && <span className="text-xs text-gray-400">(wk)</span>}</td>
                  <td>{f.catches}</td>
                  <td>{f.drops}</td>
                  <td>{f.run_outs_direct + f.run_outs_assist}</td>
                  <td>{f.stumpings}</td>
                  <td>{f.misfields}</td>
                  <td className={f.impact_score >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>{f.impact_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
