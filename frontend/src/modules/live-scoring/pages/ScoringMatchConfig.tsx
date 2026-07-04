import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scoringApi } from "../../../api/scoringClient";
import { useAuthStore } from "../../../store/auth";
import { hasRole } from "../../../utils/roles";
import { queryKeys } from "../../../hooks/queryKeys";
import { ArrowLeft, Save, AlertCircle, CheckCircle } from "lucide-react";
import { BALL_TYPES } from "../../../data/cricket";

export default function ScoringMatchConfig() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const canManage = hasRole(user?.role ?? "", "organizer", "scorer");

  const { data: match, isLoading } = useQuery({
    queryKey: queryKeys.scoringMatch(matchId ?? ""),
    queryFn: () => scoringApi.get(`/matches/${matchId}`).then(r => r.data.match),
    enabled: !!matchId,
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [cfg, setCfg] = useState<any>({});
  const [officials, setOfficials] = useState({ umpire1: "", umpire2: "", tv_umpire: "", match_referee: "" });

  useEffect(() => {
    if (!match) return;
    setOfficials({
      umpire1:       match.umpire1       ?? "",
      umpire2:       match.umpire2       ?? "",
      tv_umpire:     match.tv_umpire     ?? "",
      match_referee: match.match_referee ?? "",
    });
    const t = match.tournament ?? {};
    setCfg({
      overs_per_innings:    t.overs_per_innings    ?? (match.format === "T20" ? 20 : match.format === "ODI" ? 50 : ""),
      number_of_innings:    t.number_of_innings    ?? 2,
      ball_type:            t.ball_type            ?? "white",
      powerplay_overs:      t.powerplay_overs      ?? { pp_end: 6, mid_end: 15, death_end: 20 },
      super_over_enabled:   t.super_over_enabled   ?? false,
      dls_enabled:          t.dls_enabled          ?? false,
      free_hit_enabled:     t.free_hit_enabled     ?? true,
      no_ball_rule:         t.no_ball_rule         ?? "front_foot",
      wide_rule:            t.wide_rule            ?? "men",
      tie_break_rule:       t.tie_break_rule       ?? "super_over",
      retired_hurt_allowed: t.retired_hurt_allowed ?? true,
      substitutes_allowed:  t.substitutes_allowed  ?? true,
    });
  }, [match]);

  const save = useMutation({
    mutationFn: async () => {
      await Promise.all([
        scoringApi.put(`/matches/${matchId}/config`, cfg),
        scoringApi.put(`/matches/${matchId}`, officials),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scoringMatch(matchId ?? "") });
      qc.invalidateQueries({ queryKey: queryKeys.scoringMatchLive(matchId ?? "") });
      setFeedback({ type: "success", msg: "Configuration saved" });
    },
    onError: (err: any) =>
      setFeedback({ type: "error", msg: err.response?.data?.error?.message || "Save failed" }),
  });

  const update    = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));
  const updatePP  = (k: string, v: any) => setCfg((c: any) => ({
    ...c, powerplay_overs: { ...c.powerplay_overs, [k]: Number(v) }
  }));

  if (isLoading) return (
    <div className="animate-pulse space-y-4 max-w-3xl">
      <div className="skel h-10 rounded-xl" />
      <div className="skel h-48 rounded-xl" />
      <div className="skel h-36 rounded-xl" />
    </div>
  );

  if (!match) return <p className="text-center text-ink-sub py-20">Match not found.</p>;
  if (!canManage) return <p className="text-center text-ink-sub py-20">Only organizers and scorers can edit match configuration.</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            to={`/scoring/matches/${matchId}`}
            className="inline-flex items-center gap-1.5 lab text-ink-sub hover:text-ink transition-colors text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to match
          </Link>
          <h1 className="font-disp font-bold text-xl text-ink">Match Configuration</h1>
          <p className="lab text-ink-sub">
            {match.title || `${match.team1?.name} vs ${match.team2?.name}`}
            {match.format ? ` · ${match.format}` : ""}
          </p>
        </div>
      </div>

      <p className="lab text-ink-sub text-sm">
        Tournament-level settings apply to all matches. Match officials are per-match.
      </p>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          feedback.type === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {feedback.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* Format & ball */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink">Format &amp; Ball</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="lab text-ink-sub text-sm block mb-1">Overs per innings</span>
            <input
              type="number" min={1} max={90} className="input w-full"
              value={cfg.overs_per_innings ?? ""}
              onChange={e => update("overs_per_innings", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="lab text-ink-sub text-sm block mb-1">Number of innings</span>
            <select className="input w-full" value={cfg.number_of_innings ?? 2} onChange={e => update("number_of_innings", Number(e.target.value))}>
              <option value={2}>2 (Limited overs)</option>
              <option value={4}>4 (Test)</option>
            </select>
          </label>
          <label className="block">
            <span className="lab text-ink-sub text-sm block mb-1">Ball type</span>
            <select className="input w-full" value={cfg.ball_type ?? "white"} onChange={e => update("ball_type", e.target.value)}>
              {BALL_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Phase boundaries */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Phase Boundaries</h2>
          <p className="lab text-ink-faint text-xs mt-0.5">Used for phase-wise analytics (PowerPlay / Middle / Death). End-of-phase over number.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="lab text-ink-sub text-sm block mb-1">PowerPlay ends after over</span>
            <input
              type="number" min={1} max={50} className="input w-full"
              value={cfg.powerplay_overs?.pp_end ?? 6}
              onChange={e => updatePP("pp_end", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="lab text-ink-sub text-sm block mb-1">Middle ends after over</span>
            <input
              type="number" min={1} max={80} className="input w-full"
              value={cfg.powerplay_overs?.mid_end ?? 15}
              onChange={e => updatePP("mid_end", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="lab text-ink-sub text-sm block mb-1">Death ends after over</span>
            <input
              type="number" min={1} max={90} className="input w-full"
              value={cfg.powerplay_overs?.death_end ?? 20}
              onChange={e => updatePP("death_end", e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Rules */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink">Rules</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["super_over_enabled",   "Super over enabled"],
            ["dls_enabled",          "DLS method enabled"],
            ["free_hit_enabled",     "Free-hit rule"],
            ["retired_hurt_allowed", "Retired hurt allowed"],
            ["substitutes_allowed",  "Substitutes allowed"],
          ] as [string, string][]).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between bg-fill rounded-lg px-3 py-2.5 cursor-pointer">
              <span className="text-sm text-ink">{label}</span>
              <input
                type="checkbox" className="h-4 w-4 accent-brand-500"
                checked={cfg[k] ?? false}
                onChange={e => update(k, e.target.checked)}
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="lab text-ink-sub text-sm block mb-1">No-ball rule</span>
            <select className="input w-full" value={cfg.no_ball_rule ?? "front_foot"} onChange={e => update("no_ball_rule", e.target.value)}>
              <option value="front_foot">Front foot</option>
              <option value="back_foot">Back foot</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="lab text-ink-sub text-sm block mb-1">Wide rule</span>
            <select className="input w-full" value={cfg.wide_rule ?? "men"} onChange={e => update("wide_rule", e.target.value)}>
              <option value="men">Men (standard tramline)</option>
              <option value="women">Women</option>
              <option value="junior">Junior</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="lab text-ink-sub text-sm block mb-1">Tie-break rule</span>
            <select className="input w-full" value={cfg.tie_break_rule ?? "super_over"} onChange={e => update("tie_break_rule", e.target.value)}>
              <option value="super_over">Super over</option>
              <option value="boundary_count">Boundary count</option>
              <option value="shared">Shared trophy</option>
            </select>
          </label>
        </div>
      </div>

      {/* Match Officials */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Match Officials</h2>
          <p className="lab text-ink-faint text-xs mt-0.5">Optional — displayed on the match scorecard.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["umpire1",       "Umpire 1"],
            ["umpire2",       "Umpire 2"],
            ["tv_umpire",     "TV Umpire"],
            ["match_referee", "Match Referee"],
          ] as [keyof typeof officials, string][]).map(([k, label]) => (
            <label key={k} className="block">
              <span className="lab text-ink-sub text-sm block mb-1">{label}</span>
              <input
                className="input w-full"
                value={officials[k]}
                onChange={e => setOfficials(o => ({ ...o, [k]: e.target.value }))}
                placeholder="Name (optional)"
                minLength={0}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-primary inline-flex items-center gap-2 min-h-[44px]"
        >
          <Save className="w-4 h-4" />
          {save.isPending ? "Saving…" : "Save configuration"}
        </button>
        <button
          onClick={() => navigate(`/scoring/matches/${matchId}`)}
          className="btn-secondary min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
