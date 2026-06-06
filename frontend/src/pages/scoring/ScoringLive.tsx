import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import {
  CheckCircle, AlertCircle, Undo2, BarChart3, Radio,
  ArrowLeftRight, Star, Trophy
} from "lucide-react";
import {
  SHOT_TYPES, BALL_LINES, BALL_LENGTHS, BOWLER_TYPE_SHORT,
  FIELDING_POSITIONS, DISMISSAL_ZONES, BALL_TRAJECTORIES, WICKET_TYPES,
  bowlerVariantFromShort
} from "../../data/cricket";

// ── helpers ──────────────────────────────────────────────────────────────────
const ov  = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const sr  = (r: number, b: number) => b > 0 ? ((r / b) * 100).toFixed(1) : "0.0";
const eco = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2) : "–";
const crr = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2) : "0.00";

function ballLabel(b: any) {
  if (b.is_wicket)  return "W";
  if (b.is_six)     return "6";
  if (b.is_four)    return "4";
  if (b.is_wide)    return "WD";
  if (b.is_no_ball) return "NB";
  if (b.runs === 0) return "·";
  return String(b.runs);
}
function ballCls(b: any) {
  if (b.is_wicket)  return "bg-red-600 text-white";
  if (b.is_six)     return "bg-brand-500 text-white";
  if (b.is_four)    return "bg-ink text-paper";
  if (b.is_wide || b.is_no_ball) return "bg-fill2 text-ink-sub border border-hair";
  if (b.runs === 0) return "bg-fill text-ink-faint border border-hair";
  return "bg-ink-70 text-paper";
}

// WICKET_TYPES, SHOT_TYPES etc. imported from ../../data/cricket

interface BallInput {
  // Players
  batsman_id: string; bowler_id: string; non_striker_id: string;
  // Runs & flags
  runs: number; is_wide: boolean; is_no_ball: boolean; is_bye: boolean;
  is_leg_bye: boolean; is_wicket: boolean; is_four: boolean; is_six: boolean; is_free_hit: boolean;
  // Level 1 — every ball (PPTX § Ball Entry Level 1)
  ball_length: string; ball_line: string; bowler_type_short: string; shot_type: string;
  // Level 2 — on wicket (PPTX § Wicket Panel Level 2)
  wicket_type: string; dismissed_player_id: string;
  fielder_id: string; fielder_name: string;
  fielding_position: string; dismissal_zone: string; ball_trajectory: string;
}
const DEFAULT_BALL: BallInput = {
  batsman_id:"", bowler_id:"", non_striker_id:"", runs:0,
  is_wide:false, is_no_ball:false, is_bye:false, is_leg_bye:false,
  is_wicket:false, is_four:false, is_six:false, is_free_hit:false,
  ball_length:"", ball_line:"", bowler_type_short:"", shot_type:"",
  wicket_type:"", dismissed_player_id:"",
  fielder_id:"", fielder_name:"",
  fielding_position:"", dismissal_zone:"", ball_trajectory:""
};

// ── Batsman card ──────────────────────────────────────────────────────────────
function BatsmanCard({
  entry, isStriker, onClick, milestone
}: {
  entry: any; isStriker: boolean; onClick: () => void; milestone: number | null;
}) {
  const runs   = entry?.runs ?? 0;
  const balls  = entry?.balls_faced ?? 0;
  const fours  = entry?.fours ?? 0;
  const sixes  = entry?.sixes ?? 0;
  const name   = entry?.player?.name ?? "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded border-2 p-3 text-left transition-all ${
        isStriker
          ? "border-brand-500 bg-ink text-paper shadow-pop/10"
          : "border-hair bg-panel text-ink hover:border-ink-70"
      }`}
    >
      {/* Name + role */}
      <div className="flex items-center gap-1.5 mb-2">
        {isStriker && (
          <span className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
            <Star className="w-2.5 h-2.5 text-white fill-white" />
          </span>
        )}
        <p className={`font-semibold text-sm truncate ${isStriker ? "text-paper" : "text-ink"}`}>
          {name}
          {entry?.player?.is_captain && <span className="text-brand-500"> (c)</span>}
          {entry?.player?.is_keeper && <span className={isStriker ? "text-paper/60" : "text-ink-sub"}> †</span>}
        </p>
      </div>
      <p className={`lab mb-2 ${isStriker ? "text-paper/50" : "text-ink-faint"}`}>
        {isStriker ? "ON STRIKE" : "NON STRIKER"}
      </p>

      {/* Milestone badge */}
      {milestone && (
        <div className="mb-2 flex items-center gap-1 bg-brand-500 text-white rounded px-2 py-0.5 w-fit animate-popin">
          <Trophy className="w-3 h-3" />
          <span className="lab">{milestone}★</span>
        </div>
      )}

      {/* Stats grid */}
      {entry ? (
        <div className="grid grid-cols-3 gap-1">
          {[
            { l: "RUNS", v: runs, bold: true },
            { l: "BALLS", v: balls },
            { l: "SR", v: sr(runs, balls) },
            { l: "4s", v: fours },
            { l: "6s", v: sixes },
            { l: "DOTS", v: entry?.dot_balls ?? 0 },
          ].map(({ l, v, bold }) => (
            <div key={l} className={`rounded px-1.5 py-1 ${isStriker ? "bg-paper/10" : "bg-fill"}`}>
              <p className={`lab text-[9px] ${isStriker ? "text-paper/40" : "text-ink-faint"}`}>{l}</p>
              <p className={`font-mononum font-bold text-sm ${bold ? (isStriker ? "text-brand-400 text-lg leading-tight" : "text-brand-500 text-lg leading-tight") : (isStriker ? "text-paper" : "text-ink")}`}>
                {v}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className={`lab ${isStriker ? "text-paper/40" : "text-ink-faint"}`}>No player selected</p>
      )}
    </button>
  );
}

// ── Bowler card ───────────────────────────────────────────────────────────────
function BowlerCard({ entry, currentOverBalls }: { entry: any; currentOverBalls: any[] }) {
  if (!entry) return (
    <div className="panel p-3 text-center">
      <p className="lab text-ink-faint">No bowler selected</p>
    </div>
  );
  const name      = entry?.player?.name ?? "—";
  const ovBowled  = `${Math.floor(entry.balls / 6)}.${entry.balls % 6}`;
  const dotPct    = entry.balls > 0 ? Math.round((entry.dot_balls / entry.balls) * 100) : 0;
  const lastBall  = currentOverBalls[currentOverBalls.length - 1];
  const lastLabel = lastBall ? [
    lastBall.ball_length?.replace(/_/g," "),
    lastBall.ball_line?.replace(/_/g," ")
  ].filter(Boolean).join(" · ") : null;

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="lab text-ink-faint mb-0.5">BOWLING</p>
          <p className="font-semibold text-ink">{name}</p>
          {lastLabel && <p className="lab text-ink-faint mt-0.5">Last: {lastLabel}</p>}
        </div>
        <div className="flex gap-3 text-right">
          {[
            { l:"O",    v: ovBowled },
            { l:"R",    v: entry.runs_conceded },
            { l:"W",    v: entry.wickets },
            { l:"ECO",  v: eco(entry.runs_conceded, entry.balls) },
            { l:"DOT%", v: `${dotPct}%` },
          ].map(({ l, v }) => (
            <div key={l}>
              <p className="lab text-ink-faint">{l}</p>
              <p className={`font-mononum font-bold text-xs ${l === "W" && entry.wickets > 0 ? "text-brand-500" : "text-ink"}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>
      {/* This over balls */}
      {currentOverBalls.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-hairsoft">
          <span className="lab text-ink-faint shrink-0">This over</span>
          <div className="flex gap-1">
            {currentOverBalls.map((b: any, i: number) => (
              <span key={i} className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-mononum font-bold ${ballCls(b)}`}>
                {ballLabel(b)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function ScoringLiveInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const user        = useAuthStore(s => s.user);

  const [activeInningsId, setActiveInningsId] = useState<string | null>(null);
  const [ball, setBall]     = useState<BallInput>({ ...DEFAULT_BALL });
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [milestone, setMilestone] = useState<{ playerId: string; runs: number } | null>(null);
  const [showNewInnings, setShowNewInnings] = useState(false);
  const [newInningsForm, setNewInningsForm] = useState({ innings_number:"1", batting_team_id:"", bowling_team_id:"", target:"" });
  const [showResult, setShowResult] = useState(false);
  const [matchResultForm, setMatchResultForm] = useState({ winner_team_id:"", result_summary:"" });

  // Match data
  const { data: match, isLoading } = useQuery({
    queryKey: ["scoring-match-live", matchId],
    queryFn: () => scoringApi.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: 5_000
  });

  // Playing XI — filters dropdowns to selected 11 per team
  const { data: xiData } = useQuery({
    queryKey: ["scoring-xi-live", matchId],
    queryFn: () => scoringApi.get(`/matches/${matchId}/xi`).then(r => r.data),
    enabled: !!matchId
  });

  // Ball events for current over display
  const { data: ballsData } = useQuery({
    queryKey: ["scoring-balls-live", activeInningsId],
    queryFn: () => scoringApi.get(`/innings/${activeInningsId}/balls`).then(r => r.data.balls ?? []),
    enabled: !!activeInningsId,
    refetchInterval: 5_000
  });
  const allBalls = ballsData ?? [];

  // Auto-set active innings
  useEffect(() => {
    if (activeInningsId) return;
    const innings = match?.innings;
    if (innings?.length) setActiveInningsId(innings[innings.length - 1].id);
  }, [match, activeInningsId]);

  const activeInnings  = match?.innings?.find((i: any) => i.id === activeInningsId) ?? match?.innings?.[match.innings.length - 1];
  const battingTeam    = activeInnings ? (activeInnings.batting_team_id === match?.team1?.id ? match.team1 : match.team2) : null;
  const bowlingTeam    = activeInnings ? (activeInnings.batting_team_id === match?.team1?.id ? match.team2 : match.team1) : null;

  // If Playing XI is set, filter to only those players; otherwise use full squad
  const xiLocked = xiData?.xi_locked;
  const filteredXI = (teamId: string, allPlayers: any[]) => {
    if (!xiLocked || !xiData) return allPlayers;
    const xiTeam = xiData.team1?.id === teamId ? xiData.team1 : xiData.team2;
    const xiIds  = new Set((xiTeam?.players ?? []).filter((p: any) => p.in_xi).map((p: any) => p.id));
    return allPlayers.filter((p: any) => xiIds.has(p.id));
  };

  const battingPlayers = filteredXI(battingTeam?.id ?? "", battingTeam?.players ?? []);
  const bowlingPlayers = filteredXI(bowlingTeam?.id ?? "", bowlingTeam?.players ?? []);

  const currentOver    = activeInnings ? Math.floor(activeInnings.total_balls / 6) : 0;
  const currentBallNum = activeInnings ? (activeInnings.total_balls % 6) + 1 : 1;
  const maxOvers       = match?.format === "T20" ? 20 : match?.format === "ODI" ? 50 : match?.format === "T10" ? 10 : null;

  // Derive batsmen stats from batting_entries
  const getBatEntry = (pid: string) =>
    (activeInnings?.batting_entries ?? []).find((e: any) => e.player_id === pid);
  const strikerEntry    = ball.batsman_id   ? getBatEntry(ball.batsman_id)    : null;
  const nonStrikerEntry = ball.non_striker_id ? getBatEntry(ball.non_striker_id) : null;
  const bowlerEntry     = ball.bowler_id ? (activeInnings?.bowling_entries ?? []).find((e: any) => e.player_id === ball.bowler_id) : null;

  // Current over balls
  const currentOverBalls = allBalls.filter((b: any) => b.over_number === currentOver);

  // Milestone check: did striker just hit 50/100?
  const strikerMilestone = milestone?.playerId === ball.batsman_id
    ? [50, 100, 150, 200].find(n => n === milestone?.runs) ?? null
    : null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scoring-match-live", matchId] });
    qc.invalidateQueries({ queryKey: ["scoring-match", matchId] });
    qc.invalidateQueries({ queryKey: ["scoring-balls-live", activeInningsId] });
  };

  const addBallMutation = useMutation({
    mutationFn: (input: any) => scoringApi.post(`/innings/${activeInningsId}/balls`, input),
    onSuccess: () => {
      invalidate();
      // Check for milestone
      const entry = getBatEntry(ball.batsman_id);
      if (entry) {
        const newRuns = entry.runs + Number(ball.runs);
        const prev    = entry.runs;
        const hit = [50, 100, 150, 200].find(n => prev < n && newRuns >= n);
        if (hit) {
          setMilestone({ playerId: ball.batsman_id, runs: hit });
          setTimeout(() => setMilestone(null), 4000);
        }
      }
      // Auto-swap on odd runs (1,3,5) — striker and non-striker switch ends
      const runsScored = Number(ball.runs);
      const isLegal    = !ball.is_wide && !ball.is_no_ball;
      const oddRuns    = isLegal && runsScored % 2 === 1;
      // End of over swap (ball 6 of a legal over) — non-wicket
      const endOfOver  = isLegal && !ball.is_wicket && currentBallNum === 6;

      setBall(prev => {
        const next = { ...DEFAULT_BALL, bowler_id: prev.bowler_id, batsman_id: prev.batsman_id, non_striker_id: prev.non_striker_id, bowler_type_short: prev.bowler_type_short };
        if (oddRuns || endOfOver) {
          next.batsman_id    = prev.non_striker_id;
          next.non_striker_id = prev.batsman_id;
        }
        if (ball.is_wicket) {
          next.batsman_id = ""; // new batter needed
        }
        return next;
      });

      setFeedback({ type:"success", msg: ball.is_wicket ? "Wicket recorded" : ball.is_six ? "SIX! Ball recorded" : ball.is_four ? "FOUR! Ball recorded" : "Ball recorded" });
      setTimeout(() => setFeedback(null), 2500);
    },
    onError: (err: any) => setFeedback({ type:"error", msg: err.response?.data?.error?.message || "Failed to record ball" })
  });

  const undoMutation = useMutation({
    mutationFn: () => scoringApi.post(`/innings/${activeInningsId}/balls/undo`),
    onSuccess: () => { invalidate(); setFeedback({ type:"success", msg:"Last ball undone" }); },
    onError: (err: any) => setFeedback({ type:"error", msg: err.response?.data?.error?.message || "Undo failed" })
  });

  const createInningsMutation = useMutation({
    mutationFn: (input: any) => scoringApi.post(`/matches/${matchId}/innings`, input),
    onSuccess: (r) => {
      invalidate();
      setActiveInningsId(r.data.innings.id);
      setBall({ ...DEFAULT_BALL });
      setShowNewInnings(false);
      setFeedback({ type:"success", msg:"New innings started" });
    },
    onError: (err: any) => setFeedback({ type:"error", msg: err.response?.data?.error?.message || "Failed" })
  });

  const completeMatchMutation = useMutation({
    mutationFn: (input: any) => scoringApi.put(`/matches/${matchId}`, { status:"completed", ...input }),
    onSuccess: () => { invalidate(); navigate(`/scoring/matches/${matchId}`); }
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function submitBall(e: React.FormEvent) {
    e.preventDefault();
    if (!activeInningsId) return;
    if (!ball.batsman_id || !ball.bowler_id) {
      setFeedback({ type:"error", msg:"Select batsman and bowler before recording" });
      return;
    }
    addBallMutation.mutate({
      over_number: currentOver, ball_number: currentBallNum,
      batsman_id: ball.batsman_id, bowler_id: ball.bowler_id,
      non_striker_id: ball.non_striker_id || undefined,
      runs: Number(ball.runs),
      is_wide: ball.is_wide, is_no_ball: ball.is_no_ball,
      is_bye: ball.is_bye, is_leg_bye: ball.is_leg_bye,
      is_wicket: ball.is_wicket, is_four: ball.is_four,
      is_six: ball.is_six, is_free_hit: ball.is_free_hit,
      // Level 1 — every ball
      ball_length: ball.ball_length || undefined,
      ball_line: ball.ball_line || undefined,
      shot_type: ball.shot_type || undefined,
      bowler_variant: ball.bowler_type_short ? bowlerVariantFromShort(ball.bowler_type_short) : undefined,
      // Level 2 — wicket only
      wicket_type: ball.is_wicket ? ball.wicket_type || undefined : undefined,
      dismissed_player_id: ball.is_wicket ? ball.dismissed_player_id || ball.batsman_id : undefined,
      fielder_id: ball.is_wicket ? ball.fielder_id || undefined : undefined,
      fielder_name: ball.is_wicket ? ball.fielder_name || undefined : undefined,
      fielding_position: ball.is_wicket ? ball.fielding_position || undefined : undefined,
      dismissal_zone: ball.is_wicket ? ball.dismissal_zone || undefined : undefined,
      ball_trajectory: ball.is_wicket ? ball.ball_trajectory || undefined : undefined,
    });
  }

  function set(k: keyof BallInput, v: any) {
    setBall(prev => {
      const next = { ...prev, [k]: v };
      if (k === "runs") {
        next.is_four = Number(v) === 4;
        next.is_six  = Number(v) === 6;
      }
      return next;
    });
  }

  function swapEnds() {
    setBall(prev => ({
      ...prev,
      batsman_id: prev.non_striker_id,
      non_striker_id: prev.batsman_id
    }));
  }

  // ── Loading / auth ─────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="animate-pulse space-y-3">
      <div className="skel h-32 rounded" />
      <div className="skel h-24 rounded" />
      <div className="skel h-64 rounded" />
    </div>
  );
  if (!match) return <div className="text-center py-20 text-ink-sub">Match not found.</div>;

  const canScore = user?.role === "admin" || user?.role === "scorer" || user?.role === "organizer";
  if (!canScore) return (
    <div className="text-center py-20 text-ink-sub">Only admins, scorers and organizers can access the live scoring console.</div>
  );

  const isInningsCompleted = activeInnings?.is_completed;

  return (
    <div className="space-y-3 max-w-3xl">

      {/* ── SCOREBOARD ─────────────────────────────────────────────────────── */}
      <div className="bg-ink text-paper rounded p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="lab text-paper/40">{match.sport?.toUpperCase()} · {match.format} · {match.title || `Match ${match.match_number || ""}`}</p>
            <p className="font-disp text-2xl mt-0.5">
              {match.team1?.short_name || match.team1?.name} <span className="text-paper/30">vs</span> {match.team2?.short_name || match.team2?.name}
            </p>
          </div>
          <span className="lab bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shrink-0">
            <Radio className="w-2.5 h-2.5" /> LIVE
          </span>
        </div>

        {activeInnings ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="lab text-paper/40 mb-1">Inn {activeInnings.innings_number} · {battingTeam?.name} bat</p>
              <div className="flex items-end gap-2">
                <span className="font-disp text-5xl font-bold leading-none">
                  {activeInnings.total_runs}/{activeInnings.total_wickets}
                </span>
                <span className="font-mononum text-paper/50 mb-1">({ov(activeInnings.total_balls)} Ov)</span>
              </div>
            </div>
            <div className="flex gap-2 text-right shrink-0">
              <div className="bg-paper/10 rounded px-2.5 py-1.5">
                <p className="lab text-paper/40">CRR</p>
                <p className="font-mononum font-bold">{crr(activeInnings.total_runs, activeInnings.total_balls)}</p>
              </div>
              {maxOvers && (
                <div className="bg-paper/10 rounded px-2.5 py-1.5">
                  <p className="lab text-paper/40">REM</p>
                  <p className="font-mononum font-bold">{maxOvers - Math.floor(activeInnings.total_balls / 6)} ov</p>
                </div>
              )}
              {activeInnings.target && (
                <div className="bg-brand-500/30 rounded px-2.5 py-1.5">
                  <p className="lab text-paper/40">NEED</p>
                  <p className="font-mononum font-bold text-brand-400">{Math.max(0, activeInnings.target - activeInnings.total_runs)}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-paper/50 lab">No innings started yet</p>
        )}

        {/* Extras strip */}
        {activeInnings && (
          <div className="mt-3 pt-3 border-t border-paper/10 flex gap-4 lab text-paper/40 flex-wrap">
            <span>Extras <span className="text-paper/70">{activeInnings.extras ?? 0}</span></span>
            <span>W <span className="text-paper/70">{activeInnings.wides ?? 0}</span></span>
            <span>NB <span className="text-paper/70">{activeInnings.no_balls ?? 0}</span></span>
            <span>B <span className="text-paper/70">{activeInnings.byes ?? 0}</span></span>
            <span>LB <span className="text-paper/70">{activeInnings.leg_byes ?? 0}</span></span>
            <span className="ml-auto">
              <span className="text-paper/40">4s </span><span className="text-paper/70">{activeInnings.boundary_4s ?? 0}</span>
              <span className="text-paper/40 ml-2">6s </span><span className="text-brand-400">{activeInnings.boundary_6s ?? 0}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── MILESTONE BANNER ────────────────────────────────────────────────── */}
      {milestone && (
        <div className="flex items-center gap-3 bg-brand-500 text-white rounded p-3 animate-popin">
          <Trophy className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-disp text-2xl leading-none">{milestone.runs}!</p>
            <p className="lab text-white/70 mt-0.5">
              {(activeInnings?.batting_entries ?? []).find((e: any) => e.player_id === milestone.playerId)?.player?.name}
              {" "}reaches {milestone.runs}{milestone.runs >= 100 ? " — Century! 🏏" : " — Half-century! ★"}
            </p>
          </div>
        </div>
      )}

      {/* ── FEEDBACK ─────────────────────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded text-sm ${feedback.type === "success" ? "bg-fill border border-hair text-ink" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* ── ACTION BAR ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {activeInnings && (
          <Link to={`/scoring/innings/${activeInnings.id}/analytics`} className="btn-secondary text-xs gap-1 min-h-0 px-3 py-2">
            <BarChart3 className="w-3.5 h-3.5" /> Analytics
          </Link>
        )}
        <button onClick={() => undoMutation.mutate()} disabled={!activeInningsId || undoMutation.isPending}
          className="btn-secondary text-xs gap-1 min-h-0 px-3 py-2">
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button onClick={() => {
          const next = String((match.innings?.length ?? 0) + 1);
          setNewInningsForm(f => ({ ...f, innings_number: next, batting_team_id:"", bowling_team_id:"", target:"" }));
          setShowNewInnings(true);
        }} className="btn-secondary text-xs min-h-0 px-3 py-2">+ New Innings</button>
        <button onClick={() => setShowResult(true)} className="btn-secondary text-xs min-h-0 px-3 py-2 text-red-600 border-red-200 hover:bg-red-50">
          End Match
        </button>
        {(match.innings?.length ?? 0) > 1 && (
          <div className="flex gap-1 ml-auto">
            {match.innings.map((inn: any) => (
              <button key={inn.id} onClick={() => setActiveInningsId(inn.id)}
                className={`px-3 py-1.5 text-xs rounded font-mononum min-h-0 ${inn.id === activeInningsId ? "bg-ink text-paper" : "bg-fill text-ink-sub hover:bg-fill2"}`}>
                Inn {inn.innings_number}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CURRENT PLAYERS ──────────────────────────────────────────────────── */}
      {activeInningsId && (
        <div className="space-y-3">
          {/* Batsmen cards + swap */}
          <div className="flex gap-2 items-stretch">
            <BatsmanCard
              entry={strikerEntry}
              isStriker={true}
              onClick={() => {/* clicking card doesn't do anything — use dropdown below */}}
              milestone={strikerMilestone}
            />
            <button
              type="button"
              onClick={swapEnds}
              title="Swap striker / non-striker"
              className="flex flex-col items-center justify-center w-10 shrink-0 rounded border border-hair bg-fill hover:bg-fill2 hover:border-ink-70 transition gap-1"
            >
              <ArrowLeftRight className="w-4 h-4 text-ink-sub" />
              <span className="lab text-ink-faint text-[8px] leading-none">SWAP</span>
            </button>
            <BatsmanCard
              entry={nonStrikerEntry}
              isStriker={false}
              onClick={() => {}}
              milestone={null}
            />
          </div>

          {/* Bowler card + current over */}
          <BowlerCard entry={bowlerEntry} currentOverBalls={currentOverBalls} />
        </div>
      )}

      {/* ── BALL ENTRY FORM ───────────────────────────────────────────────────── */}
      {activeInningsId && !isInningsCompleted && (
        <form onSubmit={submitBall} className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="lab text-ink-sub">Over {currentOver + 1} → Ball {currentBallNum}</p>
            {activeInnings?.target && (
              <p className="lab text-brand-500">
                Need {Math.max(0, activeInnings.target - activeInnings.total_runs)} from {Math.max(0, (maxOvers ?? 20) * 6 - activeInnings.total_balls)} balls
              </p>
            )}
          </div>

          {/* Player selectors */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="lab block mb-1">Batsman (striker) *</label>
              <select className="input w-full text-sm" value={ball.batsman_id}
                onChange={e => set("batsman_id", e.target.value)} required>
                <option value="">Select striker</option>
                {battingPlayers.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lab block mb-1">Non-striker</label>
              <select className="input w-full text-sm" value={ball.non_striker_id}
                onChange={e => set("non_striker_id", e.target.value)}>
                <option value="">Select non-striker</option>
                {battingPlayers.filter((p: any) => p.id !== ball.batsman_id).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lab block mb-1">Bowler *</label>
              <select className="input w-full text-sm" value={ball.bowler_id}
                onChange={e => set("bowler_id", e.target.value)} required>
                <option value="">Select bowler</option>
                {bowlingPlayers.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Level 1: Ball metrics — every ball (PPTX § Ball Entry Level 1) ── */}
          <div className="panel p-3 space-y-3 bg-fill/50">
            <p className="lab text-ink-sub">Ball Details — Level 1</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="lab block mb-1">Ball Length</label>
                <select className="input w-full text-xs" value={ball.ball_length} onChange={e => set("ball_length", e.target.value)}>
                  <option value="">– Length –</option>
                  {BALL_LENGTHS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="lab block mb-1">Ball Line</label>
                <select className="input w-full text-xs" value={ball.ball_line} onChange={e => set("ball_line", e.target.value)}>
                  <option value="">– Line –</option>
                  {BALL_LINES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="lab block mb-1">Bowler Type</label>
                <select className="input w-full text-xs" value={ball.bowler_type_short} onChange={e => set("bowler_type_short", e.target.value)}>
                  <option value="">– Type –</option>
                  {BOWLER_TYPE_SHORT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="lab block mb-1">Shot Type</label>
                <select className="input w-full text-xs" value={ball.shot_type} onChange={e => set("shot_type", e.target.value)}>
                  <option value="">– Shot –</option>
                  {SHOT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Runs */}
          <div>
            <label className="lab block mb-2">Runs</label>
            <div className="flex gap-1.5">
              {[0,1,2,3,4,5,6].map(r => (
                <button type="button" key={r} onClick={() => set("runs", r)}
                  className={`w-10 h-10 rounded font-mononum font-bold text-sm flex-1 transition ${
                    ball.runs === r
                      ? r === 4 ? "bg-ink text-paper ring-2 ring-ink"
                        : r === 6 ? "bg-brand-500 text-white ring-2 ring-brand-500"
                        : "bg-ink text-paper ring-2 ring-ink"
                      : "bg-fill text-ink hover:bg-fill2"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Extras + events */}
          <div>
            <label className="lab block mb-2">Extras / Events</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["Wide","is_wide","amber"], ["No-ball","is_no_ball","amber"],
                ["Bye","is_bye",null], ["Leg-bye","is_leg_bye",null],
                ["Four","is_four","blue"], ["Six","is_six","brand"],
                ["Wicket","is_wicket","red"], ["Free-hit","is_free_hit","green"],
              ] as [string, keyof BallInput, string|null][]).map(([label, key, color]) => {
                const active = ball[key] as boolean;
                const activeCls = color === "red"    ? "bg-red-600 text-white border-red-600"
                  : color === "brand" ? "bg-brand-500 text-white border-brand-500"
                  : color === "blue"  ? "bg-ink text-paper border-ink"
                  : color === "amber" ? "bg-amber-500 text-white border-amber-500"
                  : color === "green" ? "bg-green-600 text-white border-green-600"
                  : "bg-ink text-paper border-ink";
                return (
                  <button type="button" key={key}
                    onClick={() => set(key, !ball[key])}
                    className={`px-3 py-1.5 rounded border text-sm font-medium transition ${
                      active ? activeCls : "bg-panel border-hair text-ink-sub hover:border-ink-70 hover:text-ink"
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Level 2: Wicket Panel — only on dismissal (PPTX § Wicket Panel Level 2) ── */}
          {ball.is_wicket && (
            <div className="panel p-4 space-y-4 border-red-200 bg-red-50/30">
              <p className="lab text-red-700">Wicket Details — Level 2</p>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="lab block mb-1">Dismissal Type *</label>
                  <select className="input w-full text-sm" value={ball.wicket_type}
                    onChange={e => set("wicket_type", e.target.value)} required={ball.is_wicket}>
                    <option value="">Select type</option>
                    {WICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-1">Dismissed Player</label>
                  <select className="input w-full text-sm" value={ball.dismissed_player_id}
                    onChange={e => set("dismissed_player_id", e.target.value)}>
                    <option value="">Striker (default)</option>
                    {battingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-1">Fielder</label>
                  <select className="input w-full text-sm" value={ball.fielder_id}
                    onChange={e => set("fielder_id", e.target.value)}>
                    <option value="">No fielder</option>
                    {bowlingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-1">Fielding Position</label>
                  <select className="input w-full text-sm" value={ball.fielding_position}
                    onChange={e => set("fielding_position", e.target.value)}>
                    <option value="">– Position –</option>
                    {FIELDING_POSITIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-1">Dismissal Zone</label>
                  <select className="input w-full text-sm" value={ball.dismissal_zone}
                    onChange={e => set("dismissal_zone", e.target.value)}>
                    <option value="">– Zone –</option>
                    {DISMISSAL_ZONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-1">Ball Trajectory</label>
                  <select className="input w-full text-sm" value={ball.ball_trajectory}
                    onChange={e => set("ball_trajectory", e.target.value)}>
                    <option value="">– Trajectory –</option>
                    {BALL_TRAJECTORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="lab block mb-1">Sub Fielder Name (override)</label>
                <input className="input w-full text-sm" value={ball.fielder_name}
                  onChange={e => set("fielder_name", e.target.value)}
                  placeholder="Substitute fielder name…" />
              </div>
            </div>
          )}

          <button type="submit" disabled={addBallMutation.isPending}
            className="btn-primary w-full justify-center text-base">
            {addBallMutation.isPending ? "Recording…" : "Record Ball"}
          </button>
        </form>
      )}

      {/* Innings completed notice */}
      {isInningsCompleted && (
        <div className="card p-6 text-center">
          <p className="font-disp text-xl text-ink mb-1">Innings Complete</p>
          <p className="lab text-ink-sub mb-4">Final score: {activeInnings?.total_runs}/{activeInnings?.total_wickets} ({ov(activeInnings?.total_balls ?? 0)})</p>
          <button onClick={() => {
            const next = String((match.innings?.length ?? 0) + 1);
            setNewInningsForm(f => ({ ...f, innings_number: next, batting_team_id:"", bowling_team_id:"", target:"" }));
            setShowNewInnings(true);
          }} className="btn-primary text-sm">Start Next Innings</button>
        </div>
      )}

      {/* ── NEW INNINGS MODAL ──────────────────────────────────────────────── */}
      {showNewInnings && (
        <div className="card p-5 space-y-4 border-2 border-brand-500">
          <p className="font-semibold text-ink">Start New Innings</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="lab block mb-1">Innings number</label>
              <select className="input w-full text-sm" value={newInningsForm.innings_number}
                onChange={e => setNewInningsForm(f => ({ ...f, innings_number: e.target.value }))}>
                {["1","2","3","4"].map(n => <option key={n} value={n}>Innings {n}</option>)}
              </select>
            </div>
            <div>
              <label className="lab block mb-1">Target (2nd innings+)</label>
              <input className="input w-full text-sm" type="number"
                value={newInningsForm.target}
                onChange={e => setNewInningsForm(f => ({ ...f, target: e.target.value }))}
                placeholder="Leave blank for 1st innings" />
            </div>
            <div>
              <label className="lab block mb-1">Batting team *</label>
              <select className="input w-full text-sm" value={newInningsForm.batting_team_id}
                onChange={e => {
                  const v = e.target.value;
                  const other = v === match.team1?.id ? match.team2?.id : match.team1?.id;
                  setNewInningsForm(f => ({ ...f, batting_team_id: v, bowling_team_id: other ?? "" }));
                }} required>
                <option value="">Select team</option>
                <option value={match.team1?.id}>{match.team1?.name}</option>
                <option value={match.team2?.id}>{match.team2?.name}</option>
              </select>
            </div>
            <div>
              <label className="lab block mb-1">Bowling team</label>
              <input className="input w-full text-sm bg-fill" readOnly
                value={newInningsForm.bowling_team_id === match.team1?.id ? match.team1?.name : newInningsForm.bowling_team_id === match.team2?.id ? match.team2?.name : "Auto-set"} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={!newInningsForm.batting_team_id || createInningsMutation.isPending}
              onClick={() => createInningsMutation.mutate({
                innings_number: Number(newInningsForm.innings_number),
                batting_team_id: newInningsForm.batting_team_id,
                bowling_team_id: newInningsForm.bowling_team_id,
                target: newInningsForm.target ? Number(newInningsForm.target) : undefined
              })} className="btn-primary text-sm">
              {createInningsMutation.isPending ? "Starting…" : "Start Innings"}
            </button>
            <button onClick={() => setShowNewInnings(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* ── END MATCH MODAL ────────────────────────────────────────────────── */}
      {showResult && (
        <div className="card p-5 space-y-4 border-2 border-red-400">
          <p className="font-semibold text-ink">End Match</p>
          <div className="space-y-3">
            <div>
              <label className="lab block mb-1">Winner</label>
              <select className="input w-full text-sm" value={matchResultForm.winner_team_id}
                onChange={e => setMatchResultForm(f => ({ ...f, winner_team_id: e.target.value }))}>
                <option value="">No result / Tied</option>
                <option value={match.team1?.id}>{match.team1?.name} won</option>
                <option value={match.team2?.id}>{match.team2?.name} won</option>
              </select>
            </div>
            <div>
              <label className="lab block mb-1">Result summary</label>
              <input className="input w-full text-sm" value={matchResultForm.result_summary}
                onChange={e => setMatchResultForm(f => ({ ...f, result_summary: e.target.value }))}
                placeholder="e.g. Mumbai Lions won by 5 wickets" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => completeMatchMutation.mutate({
                  winner_team_id: matchResultForm.winner_team_id || undefined,
                  result_summary: matchResultForm.result_summary || undefined
                })}
                disabled={completeMatchMutation.isPending}
                className="btn-danger text-sm">
                {completeMatchMutation.isPending ? "Ending…" : "Confirm — End Match"}
              </button>
              <button onClick={() => setShowResult(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoringLive() {
  return <ScoringLiveInner />;
}
