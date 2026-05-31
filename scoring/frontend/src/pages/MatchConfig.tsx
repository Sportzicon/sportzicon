import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { ArrowLeft, Save, AlertCircle, CheckCircle } from "lucide-react";
import { BALL_TYPES } from "../data/cricket";

// PPTX § Team · Match & Innings setup — organizer-only configuration screen.
// Lives behind /matches/:matchId/config and is linked from MatchDetail when
// the user is organizer or admin.

export default function MatchConfig() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const { data: match, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api.get(`/matches/${matchId}`).then(r => r.data.match)
  });

  const { data: tournament } = useQuery({
    queryKey: ["tournament", match?.tournament_id],
    queryFn: () => api.get(`/tournaments/${match.tournament_id}`).then(r => r.data.tournament),
    enabled: Boolean(match?.tournament_id)
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [cfg, setCfg] = useState<any>({});
  useEffect(() => {
    if (!tournament) return;
    setCfg({
      overs_per_innings: tournament.overs_per_innings ?? (match?.format === "T20" ? 20 : match?.format === "ODI" ? 50 : ""),
      number_of_innings: tournament.number_of_innings ?? 2,
      ball_type: tournament.ball_type ?? "white",
      powerplay_overs: tournament.powerplay_overs ?? { pp_end: 6, mid_end: 15, death_end: 20 },
      super_over_enabled: tournament.super_over_enabled ?? false,
      dls_enabled: tournament.dls_enabled ?? false,
      free_hit_enabled: tournament.free_hit_enabled ?? true,
      no_ball_rule: tournament.no_ball_rule ?? "front_foot",
      wide_rule: tournament.wide_rule ?? "men",
      tie_break_rule: tournament.tie_break_rule ?? "super_over",
      retired_hurt_allowed: tournament.retired_hurt_allowed ?? true,
      substitutes_allowed: tournament.substitutes_allowed ?? true
    });
  }, [tournament, match?.format]);

  const save = useMutation({
    mutationFn: () => api.put(`/matches/${matchId}/config`, cfg),
    onSuccess: () => setFeedback({ type: "success", msg: "Configuration saved" }),
    onError: (err: any) => setFeedback({ type: "error", msg: err.response?.data?.error?.message || "Save failed" })
  });

  const isOrganizer = user?.role === "organizer" || user?.role === "admin";

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;
  if (!match) return <p className="text-center text-gray-400 py-20">Match not found.</p>;
  if (!isOrganizer) return <p className="text-center text-gray-400 py-20">Only organizers can edit match configuration.</p>;

  const update = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));
  const updatePP = (k: string, v: any) => setCfg((c: any) => ({ ...c, powerplay_overs: { ...c.powerplay_overs, [k]: Number(v) } }));

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Match configuration</h1>
        <Link to={`/matches/${matchId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to match
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        These settings apply to all matches in the tournament. Configure once before kickoff.
      </p>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Format & ball</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="label">Overs per innings</span>
            <input type="number" className="input" value={cfg.overs_per_innings ?? ""} onChange={e => update("overs_per_innings", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="label">Number of innings</span>
            <select className="input" value={cfg.number_of_innings ?? 2} onChange={e => update("number_of_innings", Number(e.target.value))}>
              <option value={2}>2 (Limited overs)</option>
              <option value={4}>4 (Test)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Ball type</span>
            <select className="input" value={cfg.ball_type ?? "white"} onChange={e => update("ball_type", e.target.value)}>
              {BALL_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Phase boundaries</h2>
        <p className="text-xs text-gray-500">Used for phase-wise analytics (PPTX § Team · Phase performance). Overs are zero-indexed end-of-phase.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="label">Powerplay ends after over</span>
            <input type="number" className="input" value={cfg.powerplay_overs?.pp_end ?? 6} onChange={e => updatePP("pp_end", e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Middle ends after over</span>
            <input type="number" className="input" value={cfg.powerplay_overs?.mid_end ?? 15} onChange={e => updatePP("mid_end", e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Death ends after over</span>
            <input type="number" className="input" value={cfg.powerplay_overs?.death_end ?? 20} onChange={e => updatePP("death_end", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Rules</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ["super_over_enabled", "Super over enabled"],
            ["dls_enabled", "DLS method enabled"],
            ["free_hit_enabled", "Free-hit rule"],
            ["retired_hurt_allowed", "Retired hurt allowed"],
            ["substitutes_allowed", "Substitutes allowed"]
          ].map(([k, label]) => (
            <label key={k} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm">{label}</span>
              <input type="checkbox" className="h-4 w-4" checked={cfg[k] ?? false} onChange={e => update(k, e.target.checked)} />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="label">No-ball rule</span>
            <select className="input" value={cfg.no_ball_rule ?? "front_foot"} onChange={e => update("no_ball_rule", e.target.value)}>
              <option value="front_foot">Front foot</option>
              <option value="back_foot">Back foot</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Wide rule</span>
            <select className="input" value={cfg.wide_rule ?? "men"} onChange={e => update("wide_rule", e.target.value)}>
              <option value="men">Men (standard tramline)</option>
              <option value="women">Women</option>
              <option value="junior">Junior</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Tie-break</span>
            <select className="input" value={cfg.tie_break_rule ?? "super_over"} onChange={e => update("tie_break_rule", e.target.value)}>
              <option value="super_over">Super over</option>
              <option value="boundary_count">Boundary count</option>
              <option value="shared">Shared trophy</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary inline-flex items-center gap-2">
          <Save className="w-4 h-4" /> {save.isPending ? "Saving…" : "Save configuration"}
        </button>
        <button onClick={() => navigate(`/matches/${matchId}`)} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}
