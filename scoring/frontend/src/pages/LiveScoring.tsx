import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { CheckCircle, AlertCircle, Undo2, BarChart3, Eye } from "lucide-react";
import {
  SHOT_TYPES, BALL_LINES, BALL_LENGTHS, BOWLER_TYPE_SHORT, bowlerVariantFromShort,
  WICKET_TYPES, FIELDING_POSITIONS, DISMISSAL_ZONES, BALL_TRAJECTORIES
} from "../data/cricket";

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

interface BallInput {
  batsman_id: string;
  bowler_id: string;
  non_striker_id: string;
  runs: number;
  is_wide: boolean;
  is_no_ball: boolean;
  is_bye: boolean;
  is_leg_bye: boolean;
  is_wicket: boolean;
  is_four: boolean;
  is_six: boolean;
  is_free_hit: boolean;
  // PPTX § Level 1 — mandatory dropdowns
  shot_type: string;
  ball_line: string;
  ball_length: string;
  bowler_type_short: string;  // UI-only, mapped to bowler_variant on submit
  // PPTX § Level 2 wicket panel
  wicket_type: string;
  dismissed_player_id: string;
  fielder_id: string;
  fielder_name: string;
  fielding_position: string;
  dismissal_zone: string;
  ball_trajectory: string;
}

const DEFAULT_BALL: BallInput = {
  batsman_id: "", bowler_id: "", non_striker_id: "", runs: 0,
  is_wide: false, is_no_ball: false, is_bye: false, is_leg_bye: false,
  is_wicket: false, is_four: false, is_six: false, is_free_hit: false,
  shot_type: "", ball_line: "", ball_length: "", bowler_type_short: "",
  wicket_type: "", dismissed_player_id: "", fielder_id: "", fielder_name: "",
  fielding_position: "", dismissal_zone: "", ball_trajectory: ""
};

export default function LiveScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canScore = user?.role === "admin" || user?.role === "scorer";

  const [activeInningsId, setActiveInningsId] = useState<string | null>(null);
  const [ball, setBall] = useState<BallInput>({ ...DEFAULT_BALL });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showNewInnings, setShowNewInnings] = useState(false);
  const [newInningsForm, setNewInningsForm] = useState({ innings_number: "1", batting_team_id: "", bowling_team_id: "", target: "" });
  const [matchResultForm, setMatchResultForm] = useState({ winner_team_id: "", result_summary: "" });
  const [showResult, setShowResult] = useState(false);

  const { data: match, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: 5_000
  });

  // Auto-pin the latest innings as active so the form/mutations are wired up
  // even when the scorer arrives via a deep link without tapping a tab.
  useEffect(() => {
    if (activeInningsId) return;
    const innings = match?.innings;
    if (innings?.length) setActiveInningsId(innings[innings.length - 1].id);
  }, [match, activeInningsId]);

  const { data: ballsData } = useQuery({
    queryKey: ["balls", activeInningsId],
    queryFn: () => api.get(`/innings/${activeInningsId}/balls`).then(r => r.data.balls),
    enabled: Boolean(activeInningsId),
    refetchInterval: 5_000
  });

  const addBallMutation = useMutation({
    mutationFn: (input: any) => api.post(`/innings/${activeInningsId}/balls`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      qc.invalidateQueries({ queryKey: ["balls", activeInningsId] });
      // Keep batsman/bowler/non-striker for fast next-ball entry (PPTX § Level 1 fast flow).
      setBall(prev => ({
        ...DEFAULT_BALL,
        batsman_id: prev.batsman_id,
        bowler_id: prev.bowler_id,
        non_striker_id: prev.non_striker_id,
        bowler_type_short: prev.bowler_type_short
      }));
      setFeedback({ type: "success", msg: "Ball recorded" });
      setTimeout(() => setFeedback(null), 2000);
    },
    onError: (err: any) => setFeedback({ type: "error", msg: err.response?.data?.error?.message || "Failed" })
  });

  const undoMutation = useMutation({
    mutationFn: () => api.post(`/innings/${activeInningsId}/balls/undo`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      qc.invalidateQueries({ queryKey: ["balls", activeInningsId] });
      setFeedback({ type: "success", msg: "Last ball undone" });
    },
    onError: (err: any) => setFeedback({ type: "error", msg: err.response?.data?.error?.message || "Undo failed" })
  });

  const createInningsMutation = useMutation({
    mutationFn: (input: any) => api.post(`/matches/${matchId}/innings`, input),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      setActiveInningsId(r.data.innings.id);
      setBall(prev => ({ ...prev, batsman_id: "", bowler_id: "" }));
      setShowNewInnings(false);
      setFeedback({ type: "success", msg: "Innings started" });
    },
    onError: (err: any) => setFeedback({ type: "error", msg: err.response?.data?.error?.message || "Failed" })
  });

  const completeMatchMutation = useMutation({
    mutationFn: (input: any) => api.put(`/matches/${matchId}`, { status: "completed", ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      navigate(`/matches/${matchId}`);
    }
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-100 rounded-xl" /><div className="h-64 bg-gray-100 rounded-xl" /></div>;
  if (!match) return <div className="text-center py-20 text-gray-400">Match not found.</div>;

  const allPlayers = [...(match.team1?.players ?? []), ...(match.team2?.players ?? [])];
  const activeInnings = match.innings?.find((i: any) => i.id === activeInningsId) || match.innings?.[match.innings.length - 1];
  const battingTeam = activeInnings ? (activeInnings.batting_team_id === match.team1.id ? match.team1 : match.team2) : null;
  const bowlingTeam = activeInnings ? (activeInnings.batting_team_id === match.team1.id ? match.team2 : match.team1) : null;

  const battingPlayers = battingTeam?.players ?? [];
  const bowlingPlayers = bowlingTeam?.players ?? [];

  const currentOver = activeInnings ? Math.floor(activeInnings.total_balls / 6) : 0;
  const currentBallNum = activeInnings ? (activeInnings.total_balls % 6) + 1 : 1;

  function handleBallSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeInningsId) return;
    if (!ball.batsman_id || !ball.bowler_id) {
      setFeedback({ type: "error", msg: "Select batsman and bowler" });
      return;
    }
    addBallMutation.mutate({
      over_number: currentOver,
      ball_number: currentBallNum,
      batsman_id: ball.batsman_id,
      bowler_id: ball.bowler_id,
      non_striker_id: ball.non_striker_id || undefined,
      runs: Number(ball.runs),
      is_wide: ball.is_wide,
      is_no_ball: ball.is_no_ball,
      is_bye: ball.is_bye,
      is_leg_bye: ball.is_leg_bye,
      is_wicket: ball.is_wicket,
      is_four: ball.is_four,
      is_six: ball.is_six,
      is_free_hit: ball.is_free_hit,
      // PPTX § Level 1 dropdowns
      shot_type: ball.shot_type || undefined,
      ball_line: ball.ball_line || undefined,
      ball_length: ball.ball_length || undefined,
      bowler_variant: bowlerVariantFromShort(ball.bowler_type_short),
      // PPTX § Level 2 wicket panel
      wicket_type: ball.is_wicket ? ball.wicket_type || undefined : undefined,
      dismissed_player_id: ball.is_wicket ? ball.dismissed_player_id || ball.batsman_id : undefined,
      fielder_id: ball.is_wicket ? ball.fielder_id || undefined : undefined,
      fielder_name: ball.is_wicket ? ball.fielder_name || undefined : undefined,
      fielding_position: ball.is_wicket ? ball.fielding_position || undefined : undefined,
      dismissal_zone: ball.is_wicket ? ball.dismissal_zone || undefined : undefined,
      ball_trajectory: ball.is_wicket ? ball.ball_trajectory || undefined : undefined
    });
  }

  function update(k: keyof BallInput, v: any) {
    setBall(prev => {
      const next = { ...prev, [k]: v };
      // Auto-set is_four / is_six
      if (k === "runs") {
        if (Number(v) === 4) next.is_four = true; else if (Number(v) !== 4) next.is_four = false;
        if (Number(v) === 6) next.is_six = true; else if (Number(v) !== 6) next.is_six = false;
      }
      return next;
    });
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Match header */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bold text-lg">{match.team1.name} vs {match.team2.name}</h1>
          <p className="text-sm text-gray-400 capitalize">{match.sport} · {match.format}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeInnings && (
            <Link to={`/innings/${activeInnings.id}/analytics`} className="btn-secondary text-sm inline-flex items-center gap-1">
              <BarChart3 className="w-4 h-4" /> Analytics
            </Link>
          )}
          {canScore && (
            <>
              <button
                onClick={() => undoMutation.mutate()}
                disabled={!activeInningsId || undoMutation.isPending}
                className="btn-secondary text-sm inline-flex items-center gap-1"
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button onClick={() => {
                const nextNum = String((match.innings?.length ?? 0) + 1);
                let defaultBattingId = "";
                let defaultBowlingId = "";
                const prevInnings = match.innings;
                if (prevInnings?.length >= 1) {
                  const prev = prevInnings[prevInnings.length - 1];
                  defaultBattingId = prev.batting_team_id === match.team1.id ? match.team2.id : match.team1.id;
                  defaultBowlingId = prev.batting_team_id === match.team1.id ? match.team1.id : match.team2.id;
                } else if (match.toss_winner_id && match.toss_decision) {
                  if (match.toss_decision === "bat") {
                    defaultBattingId = match.toss_winner_id;
                    defaultBowlingId = match.toss_winner_id === match.team1.id ? match.team2.id : match.team1.id;
                  } else {
                    defaultBowlingId = match.toss_winner_id;
                    defaultBattingId = match.toss_winner_id === match.team1.id ? match.team2.id : match.team1.id;
                  }
                }
                setNewInningsForm(f => ({ ...f, innings_number: nextNum, batting_team_id: defaultBattingId, bowling_team_id: defaultBowlingId, target: "" }));
                setShowNewInnings(true);
              }} className="btn-secondary text-sm">
                + New Innings
              </button>
              <button onClick={() => setShowResult(true)} className="btn-danger text-sm">
                End Match
              </button>
            </>
          )}
        </div>
      </div>

      {!canScore && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm">
          <Eye className="w-4 h-4 shrink-0" />
          <span>You are viewing this match as a spectator. Only admins and scorers can enter scores.</span>
        </div>
      )}

      {/* Innings tabs */}
      {match.innings?.length > 0 && (
        <div className="flex gap-2">
          {match.innings.map((inn: any) => {
            const team = inn.batting_team_id === match.team1.id ? match.team1 : match.team2;
            return (
              <button
                key={inn.id}
                onClick={() => setActiveInningsId(inn.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${inn.id === (activeInningsId || match.innings[match.innings.length - 1]?.id) ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                Inn {inn.innings_number}: {team.short_name || team.name}
                {" "}{inn.total_runs}/{inn.total_wickets} ({oversFromBalls(inn.total_balls)})
              </button>
            );
          })}
        </div>
      )}

      {/* Active innings score */}
      {activeInnings && (
        <div className="bg-gray-900 text-white rounded-xl p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">
                {(activeInnings.batting_team_id === match.team1.id ? match.team1 : match.team2).name} batting
                · Inn {activeInnings.innings_number}
              </p>
              <span className="text-4xl font-bold">{activeInnings.total_runs}/{activeInnings.total_wickets}</span>
              <span className="text-gray-400 ml-2 text-xl">({oversFromBalls(activeInnings.total_balls)} Ov)</span>
            </div>
            {activeInnings.target && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Target</p>
                <p className="text-2xl font-bold">{activeInnings.target}</p>
                <p className="text-xs text-gray-400">Need {activeInnings.target - activeInnings.total_runs}</p>
              </div>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Extras: {activeInnings.extras} (W:{activeInnings.wides} NB:{activeInnings.no_balls} B:{activeInnings.byes} LB:{activeInnings.leg_byes})
          </p>
          {/* PPTX § Live Innings Tracking — derived metrics */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            <div className="bg-gray-800 rounded-md py-1.5 px-2">
              <p className="text-[10px] uppercase text-gray-400">CRR</p>
              <p className="text-sm font-bold">
                {activeInnings.total_balls > 0
                  ? ((activeInnings.total_runs / activeInnings.total_balls) * 6).toFixed(2)
                  : "0.00"}
              </p>
            </div>
            {activeInnings.target && (
              <div className="bg-gray-800 rounded-md py-1.5 px-2">
                <p className="text-[10px] uppercase text-gray-400">RRR</p>
                <p className="text-sm font-bold">
                  {(() => {
                    const maxOvers = match?.format === "T20" ? 20 : match?.format === "ODI" ? 50 : match?.format === "T10" ? 10 : null;
                    const maxBalls = maxOvers ? maxOvers * 6 : null;
                    const ballsLeft = maxBalls ? maxBalls - activeInnings.total_balls : null;
                    const need = activeInnings.target - activeInnings.total_runs;
                    return ballsLeft && ballsLeft > 0 && need > 0 ? ((need / ballsLeft) * 6).toFixed(2) : "—";
                  })()}
                </p>
              </div>
            )}
            <div className="bg-gray-800 rounded-md py-1.5 px-2">
              <p className="text-[10px] uppercase text-gray-400">Proj</p>
              <p className="text-sm font-bold">{activeInnings.projected_score ?? "—"}</p>
            </div>
            <div className="bg-gray-800 rounded-md py-1.5 px-2">
              <p className="text-[10px] uppercase text-gray-400">Win %</p>
              <p className="text-sm font-bold">{activeInnings.win_probability ?? "—"}</p>
            </div>
            <div className="bg-gray-800 rounded-md py-1.5 px-2">
              <p className="text-[10px] uppercase text-gray-400">4s/6s · Dot</p>
              <p className="text-sm font-bold">{activeInnings.boundary_4s ?? 0}/{activeInnings.boundary_6s ?? 0} · {activeInnings.dot_balls ?? 0}</p>
            </div>
          </div>
          {/* Current batsmen at crease — updates immediately on dropdown selection */}
          {(ball.batsman_id || ball.non_striker_id) && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm border-t border-gray-700 pt-3">
              <div>
                <p className="text-[10px] uppercase text-gray-400 mb-0.5">On Strike</p>
                <p className="font-semibold text-white">
                  {battingPlayers.find((p: any) => p.id === ball.batsman_id)?.name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-400 mb-0.5">Non-Striker</p>
                <p className="font-semibold text-white">
                  {battingPlayers.find((p: any) => p.id === ball.non_striker_id)?.name ?? "—"}
                </p>
              </div>
            </div>
          )}

          {/* Recent balls */}
          {ballsData && (
            <div className="mt-3 flex gap-1.5 flex-wrap">
              <span className="text-xs text-gray-400">Last over:</span>
              {(ballsData as any[])
                .filter((b: any) => b.over_number === Math.max(0, currentOver - (currentBallNum === 1 ? 1 : 0)))
                .map((b: any, i: number) => (
                  <span key={i} className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${b.is_wicket ? "bg-red-500" : b.is_six ? "bg-purple-500" : b.is_four ? "bg-blue-500" : b.is_wide || b.is_no_ball ? "bg-yellow-500" : "bg-gray-600"}`}>
                    {b.is_wide ? "Wd" : b.is_no_ball ? "NB" : b.is_wicket ? "W" : b.runs}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      {/* Ball entry form — admin/scorer only */}
      {activeInnings && !activeInnings.is_completed && canScore && (
        <form onSubmit={handleBallSubmit} className="card p-4 space-y-4">
          <h2 className="font-semibold">Over {currentOver + 1} · Ball {currentBallNum}</h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Batsman (on strike) *</label>
              <select className="input" value={ball.batsman_id} onChange={e => update("batsman_id", e.target.value)} required>
                <option value="">Select batsman</option>
                {battingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.is_captain ? " (c)" : ""}{p.is_keeper ? " (wk)" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Non-striker</label>
              <select className="input" value={ball.non_striker_id} onChange={e => update("non_striker_id", e.target.value)}>
                <option value="">Select non-striker</option>
                {battingPlayers.filter((p: any) => p.id !== ball.batsman_id).map((p: any) =>
                  <option key={p.id} value={p.id}>{p.name}</option>
                )}
              </select>
            </div>
            <div>
              <label className="label">Bowler *</label>
              <select className="input" value={ball.bowler_id} onChange={e => update("bowler_id", e.target.value)} required>
                <option value="">Select bowler</option>
                {bowlingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* PPTX § Level 1 — Ball Length / Line / Bowler Type / Shot Type (mandatory) */}
          <div className="grid sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <label className="label">Ball Length *</label>
              <select className="input" value={ball.ball_length} onChange={e => update("ball_length", e.target.value)} required>
                <option value="">Select length</option>
                {BALL_LENGTHS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ball Line *</label>
              <select className="input" value={ball.ball_line} onChange={e => update("ball_line", e.target.value)} required>
                <option value="">Select line</option>
                {BALL_LINES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bowler Type *</label>
              <select className="input" value={ball.bowler_type_short} onChange={e => update("bowler_type_short", e.target.value)} required>
                <option value="">Select bowler type</option>
                {BOWLER_TYPE_SHORT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Shot Type *</label>
              <select className="input" value={ball.shot_type} onChange={e => update("shot_type", e.target.value)} required>
                <option value="">Select shot</option>
                {SHOT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Runs */}
          <div>
            <label className="label">Runs</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6].map(r => (
                <button
                  key={r} type="button"
                  onClick={() => update("runs", r)}
                  className={`w-10 h-10 rounded-full font-bold text-sm transition ${ball.runs === r && !ball.is_wide && !ball.is_no_ball ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Extras row */}
          <div>
            <label className="label">Extras / Events</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "is_wide", label: "Wide", color: "yellow" },
                { key: "is_no_ball", label: "No Ball", color: "orange" },
                { key: "is_bye", label: "Bye", color: "blue" },
                { key: "is_leg_bye", label: "Leg Bye", color: "blue" },
                { key: "is_free_hit", label: "Free Hit", color: "green" },
                { key: "is_wicket", label: "Wicket!", color: "red" },
              ].map(({ key, label, color }) => {
                const active = ball[key as keyof BallInput] as boolean;
                const colorMap: Record<string, string> = {
                  yellow: "bg-yellow-500 text-white",
                  orange: "bg-orange-500 text-white",
                  blue: "bg-blue-500 text-white",
                  green: "bg-emerald-600 text-white",
                  red: "bg-red-600 text-white"
                };
                return (
                  <button key={key} type="button" onClick={() => update(key as keyof BallInput, !active)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? colorMap[color] : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PPTX § Level 2 — Wicket panel (expanded automatically on W) */}
          {ball.is_wicket && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
              <p className="text-sm font-semibold text-red-700">Wicket — Level 2 panel</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Dismissal Type *</label>
                  <select className="input" value={ball.wicket_type} onChange={e => update("wicket_type", e.target.value)} required>
                    <option value="">Select</option>
                    {WICKET_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Batsman Out</label>
                  <select className="input" value={ball.dismissed_player_id} onChange={e => update("dismissed_player_id", e.target.value)}>
                    <option value="">Same as on-strike</option>
                    {battingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {["caught", "cb", "run_out", "stumped"].includes(ball.wicket_type) && (
                  <div>
                    <label className="label">Fielder</label>
                    <select className="input" value={ball.fielder_id} onChange={e => update("fielder_id", e.target.value)}>
                      <option value="">Select from roster</option>
                      {bowlingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="text" placeholder="…or fielder name"
                      className="input mt-1.5"
                      value={ball.fielder_name}
                      onChange={e => update("fielder_name", e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Fielding position</label>
                  <select className="input" value={ball.fielding_position} onChange={e => update("fielding_position", e.target.value)}>
                    <option value="">Select position</option>
                    {FIELDING_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Dismissal zone</label>
                  <select className="input" value={ball.dismissal_zone} onChange={e => update("dismissal_zone", e.target.value)}>
                    <option value="">Select zone</option>
                    {DISMISSAL_ZONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ball trajectory</label>
                  <select className="input" value={ball.ball_trajectory} onChange={e => update("ball_trajectory", e.target.value)}>
                    <option value="">Select trajectory</option>
                    {BALL_TRAJECTORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-red-600/80">
                Level 2 reuses Level 1 dropdowns (length · line · shot · bowler type). Covers 95%+ of dismissals with no extra taps.
              </p>
            </div>
          )}

          <button type="submit" disabled={addBallMutation.isPending} className="btn-primary w-full justify-center">
            {addBallMutation.isPending ? "Recording…" : "Record Ball"}
          </button>
        </form>
      )}

      {/* No innings yet */}
      {(!match.innings || match.innings.length === 0) && (
        <div className="card p-8 text-center text-gray-400">
          <p className="mb-3">No innings started yet.</p>
          <button onClick={() => setShowNewInnings(true)} className="btn-primary mx-auto">Start First Innings</button>
        </div>
      )}

      {/* New Innings modal — admin/scorer only */}
      {showNewInnings && canScore && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-lg">Start New Innings</h2>
            <div>
              <label className="label">Innings Number</label>
              <select className="input" value={newInningsForm.innings_number} onChange={e => setNewInningsForm(f => ({ ...f, innings_number: e.target.value }))}>
                <option value="1">1st Innings</option>
                <option value="2">2nd Innings</option>
                <option value="3">3rd Innings</option>
                <option value="4">4th Innings</option>
              </select>
            </div>
            <div>
              <label className="label">Batting Team *</label>
              <select className="input" value={newInningsForm.batting_team_id} onChange={e => setNewInningsForm(f => ({ ...f, batting_team_id: e.target.value, bowling_team_id: e.target.value === match.team1.id ? match.team2.id : match.team1.id }))}>
                <option value="">Select team</option>
                <option value={match.team1.id}>{match.team1.name}</option>
                <option value={match.team2.id}>{match.team2.name}</option>
              </select>
            </div>
            <div>
              <label className="label">Target (for 2nd innings)</label>
              <input className="input" type="number" placeholder="Optional" value={newInningsForm.target} onChange={e => setNewInningsForm(f => ({ ...f, target: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => createInningsMutation.mutate({
                  innings_number: Number(newInningsForm.innings_number),
                  batting_team_id: newInningsForm.batting_team_id,
                  bowling_team_id: newInningsForm.bowling_team_id,
                  target: newInningsForm.target ? Number(newInningsForm.target) : undefined
                })}
                disabled={!newInningsForm.batting_team_id || createInningsMutation.isPending}
                className="btn-primary"
              >
                {createInningsMutation.isPending ? "Starting…" : "Start Innings"}
              </button>
              <button onClick={() => setShowNewInnings(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* End Match modal — admin/scorer only */}
      {showResult && canScore && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-lg">End Match</h2>
            <div>
              <label className="label">Winner</label>
              <select className="input" value={matchResultForm.winner_team_id} onChange={e => setMatchResultForm(f => ({ ...f, winner_team_id: e.target.value }))}>
                <option value="">No result / tied</option>
                <option value={match.team1.id}>{match.team1.name} won</option>
                <option value={match.team2.id}>{match.team2.name} won</option>
              </select>
            </div>
            <div>
              <label className="label">Result Summary</label>
              <input className="input" placeholder="e.g. Team A won by 5 wickets" value={matchResultForm.result_summary} onChange={e => setMatchResultForm(f => ({ ...f, result_summary: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => completeMatchMutation.mutate({
                    winner_team_id: matchResultForm.winner_team_id || undefined,
                    result_summary: matchResultForm.result_summary || undefined,
                  })}
                disabled={completeMatchMutation.isPending}
                className="btn-danger"
              >
                {completeMatchMutation.isPending ? "Ending…" : "End Match"}
              </button>
              <button onClick={() => setShowResult(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
