import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import { CheckCircle, AlertCircle, Undo2, BarChart3, Radio, ArrowLeftRight, Trophy, Plus, X, HeartPulse, RotateCcw } from "lucide-react";
import {
  SHOT_TYPES, BALL_LINES, BALL_LENGTHS, BOWLER_TYPE_SHORT,
  FIELDING_POSITIONS, DISMISSAL_ZONES, BALL_TRAJECTORIES, WICKET_TYPES,
  bowlerVariantFromShort
} from "../../data/cricket";

const ov  = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const sr  = (r: number, b: number) => b > 0 ? ((r / b) * 100).toFixed(0) : "–";
const eco = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2) : "–";
const crr = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2) : "0.00";

function ballLabel(b: any) {
  if (b.is_wicket)  return "W";
  if (b.is_six)     return "6";
  if (b.is_four)    return "4";
  if (b.is_wide)    return "Wd";
  if (b.is_no_ball) return "Nb";
  if (b.runs === 0) return "·";
  return String(b.runs);
}
function ballCls(b: any) {
  if (b.is_wicket)  return "bg-red-600 text-white";
  if (b.is_six)     return "bg-brand-500 text-white";
  if (b.is_four)    return "bg-ink text-paper";
  if (b.is_wide || b.is_no_ball) return "bg-amber-400 text-white";
  if (b.runs === 0) return "bg-fill border border-hair text-ink-faint";
  return "bg-fill2 text-ink border border-hair";
}

// ── Pill toggle button ────────────────────────────────────────────────────────
function Pill({
  label, active, onClick, color = "default"
}: {
  label: string; active: boolean; onClick: () => void;
  color?: "default" | "red" | "amber" | "brand" | "green" | "blue";
}) {
  const activeCls =
    color === "red"   ? "bg-red-600 text-white border-red-600" :
    color === "amber" ? "bg-amber-500 text-white border-amber-500" :
    color === "brand" ? "bg-brand-500 text-white border-brand-500" :
    color === "green" ? "bg-green-600 text-white border-green-600" :
    color === "blue"  ? "bg-ink text-paper border-ink" :
                        "bg-ink text-paper border-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded border text-xs font-medium transition select-none ${
        active ? activeCls : "bg-panel border-hair text-ink-sub hover:border-ink-sub hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

// ── Pill group (single-select) ────────────────────────────────────────────────
function PillGroup({
  label, options, value, onChange
}: {
  label: string;
  options: readonly { readonly value: string; readonly label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="lab text-[9px] text-ink-faint mb-0.5">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? "" : o.value)}
            className={`px-2 py-0.5 rounded border text-[11px] font-medium transition select-none ${
              value === o.value
                ? "bg-ink text-paper border-ink"
                : "bg-panel border-hair text-ink-sub hover:border-ink-sub hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface BallInput {
  batsman_id: string; bowler_id: string; non_striker_id: string;
  runs: number; is_wide: boolean; is_no_ball: boolean; is_bye: boolean;
  is_leg_bye: boolean; is_wicket: boolean; is_four: boolean; is_six: boolean; is_free_hit: boolean;
  is_ret_hurt: boolean; ret_hurt_player_id: string;
  ball_length: string; ball_line: string; bowler_type_short: string; shot_type: string;
  wicket_type: string; dismissed_player_id: string;
  fielder_id: string; fielder_name: string;
  fielding_position: string; dismissal_zone: string; ball_trajectory: string;
}

const DEFAULT_BALL: BallInput = {
  batsman_id:"", bowler_id:"", non_striker_id:"", runs:0,
  is_wide:false, is_no_ball:false, is_bye:false, is_leg_bye:false,
  is_wicket:false, is_four:false, is_six:false, is_free_hit:false,
  is_ret_hurt:false, ret_hurt_player_id:"",
  ball_length:"", ball_line:"", bowler_type_short:"", shot_type:"",
  wicket_type:"", dismissed_player_id:"", fielder_id:"", fielder_name:"",
  fielding_position:"", dismissal_zone:"", ball_trajectory:""
};

// ── Batter stat card ──────────────────────────────────────────────────────────
function BatterStat({ entry, isStriker, milestone, selectedName }: { entry: any; isStriker: boolean; milestone: number | null; selectedName?: string }) {
  const name  = entry?.player?.name ?? selectedName ?? (isStriker ? "Select striker" : "Select non-striker");
  const runs  = entry?.runs   ?? 0;
  const balls = entry?.balls_faced ?? 0;
  const fours = entry?.fours ?? 0;
  const sixes = entry?.sixes ?? 0;

  return (
    <div className={`rounded-lg px-3 py-2.5 ${isStriker ? "bg-ink text-paper" : "bg-fill"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isStriker ? "bg-brand-400" : "bg-transparent border border-hair"}`} />
        <p className={`text-sm font-semibold flex-1 truncate ${isStriker ? "text-paper" : "text-ink"}`}>
          {name}
          {entry?.player?.is_captain && <span className="text-brand-400"> (c)</span>}
          {entry?.player?.is_keeper  && <span className={isStriker ? "text-paper/50" : "text-ink-sub"}> †</span>}
        </p>
        {milestone && (
          <span className="inline-flex items-center gap-0.5 bg-brand-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shrink-0">
            <Trophy className="w-2.5 h-2.5" /> {milestone}
          </span>
        )}
      </div>
      {entry ? (
        <div className="flex items-baseline gap-3">
          <span className={`font-mononum font-black text-2xl leading-none ${isStriker ? "text-brand-300" : "text-ink"}`}>{runs}</span>
          <span className={`font-mononum text-xs ${isStriker ? "text-paper/50" : "text-ink-faint"}`}>({balls})</span>
          <span className={`font-mononum text-xs ${isStriker ? "text-paper/40" : "text-ink-faint"}`}>SR {sr(runs, balls)}</span>
          <span className={`font-mononum text-xs ml-auto ${isStriker ? "text-paper/40" : "text-ink-faint"}`}>
            4s <span className={isStriker ? "text-paper/70" : "text-ink"}>{fours}</span>
            {"  "}6s <span className={isStriker ? "text-brand-300" : "text-brand-500"}>{sixes}</span>
          </span>
        </div>
      ) : (
        <p className={`text-xs ${isStriker ? "text-paper/30" : "text-ink-faint"}`}>
          {isStriker ? "ON STRIKE" : "NON STRIKER"}
        </p>
      )}
    </div>
  );
}

// ── Main scoring component ────────────────────────────────────────────────────
function ScoringLiveInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const user        = useAuthStore(s => s.user);

  const [activeInningsId, setActiveInningsId] = useState<string | null>(null);
  const [ball, setBall] = useState<BallInput>({ ...DEFAULT_BALL });
  const [feedback, setFeedback] = useState<{ type:"success"|"error"; msg:string } | null>(null);
  const [milestone, setMilestone] = useState<{ playerId:string; runs:number } | null>(null);
  const [showNewInnings, setShowNewInnings] = useState(false);
  const [niForm, setNiForm] = useState({ innings_number:"1", batting_team_id:"", bowling_team_id:"", target:"" });
  const [showResult, setShowResult] = useState(false);
  const [resultForm, setResultForm] = useState({ winner_team_id:"", result_summary:"" });

  const { data: match, isLoading } = useQuery({
    queryKey: ["scoring-match-live", matchId],
    queryFn: () => scoringApi.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: 5_000
  });

  const { data: xiData } = useQuery({
    queryKey: ["scoring-xi-live", matchId],
    queryFn: () => scoringApi.get(`/matches/${matchId}/xi`).then(r => r.data),
    enabled: !!matchId
  });

  const { data: ballsData } = useQuery({
    queryKey: ["scoring-balls-live", activeInningsId],
    queryFn: () => scoringApi.get(`/innings/${activeInningsId}/balls`).then(r => r.data.balls ?? []),
    enabled: !!activeInningsId,
    refetchInterval: 5_000
  });
  const allBalls = ballsData ?? [];

  useEffect(() => {
    if (activeInningsId) return;
    const inns = match?.innings;
    if (inns?.length) setActiveInningsId(inns[inns.length - 1].id);
  }, [match, activeInningsId]);

  const activeInnings  = match?.innings?.find((i: any) => i.id === activeInningsId) ?? match?.innings?.[match.innings.length - 1];
  const battingTeam    = activeInnings ? (activeInnings.batting_team_id === match?.team1?.id ? match.team1 : match.team2) : null;
  const bowlingTeam    = activeInnings ? (activeInnings.batting_team_id === match?.team1?.id ? match.team2 : match.team1) : null;

  const xiLocked = xiData?.xi_locked;
  const filteredXI = (teamId: string, all: any[]) => {
    if (!xiLocked || !xiData?.team1 || !xiData?.team2) return all;
    const xiTeam = xiData.team1.id === teamId ? xiData.team1 : xiData.team2.id === teamId ? xiData.team2 : null;
    if (!xiTeam) return all;
    const ids = new Set((xiTeam.players ?? []).filter((p: any) => p.in_xi).map((p: any) => p.id));
    return all.filter((p: any) => ids.has(p.id));
  };

  // Build a status map from batting entries so we can exclude "out" players from dropdowns
  const battingStatusMap = new Map<string, string>(
    (activeInnings?.batting_entries ?? []).map((e: any) => [e.player_id, e.status])
  );

  // Batting dropdowns: exclude players already dismissed (status "out")
  // "yet_to_bat", "not_out", "retired_hurt" are all still selectable
  const battingPlayers = filteredXI(battingTeam?.id ?? "", battingTeam?.players ?? [])
    .filter((p: any) => battingStatusMap.get(p.id) !== "out");

  const bowlingPlayers = filteredXI(bowlingTeam?.id ?? "", bowlingTeam?.players ?? []);

  const currentOver    = activeInnings ? Math.floor(activeInnings.total_balls / 6) : 0;
  const currentBallNum = activeInnings ? (activeInnings.total_balls % 6) + 1 : 1;
  const maxOvers       = match?.format === "T20" ? 20 : match?.format === "ODI" ? 50 : match?.format === "T10" ? 10 : (match?.tournament?.overs_per_innings ?? null);

  const getBatEntry = (pid: string) => (activeInnings?.batting_entries ?? []).find((e: any) => e.player_id === pid);
  const strikerEntry    = ball.batsman_id    ? getBatEntry(ball.batsman_id)    : null;
  const nonStrikerEntry = ball.non_striker_id ? getBatEntry(ball.non_striker_id) : null;
  const bowlerEntry     = ball.bowler_id ? (activeInnings?.bowling_entries ?? []).find((e: any) => e.player_id === ball.bowler_id) : null;
  const currentOverBalls = allBalls.filter((b: any) => b.over_number === currentOver);
  const strikerMilestone = milestone?.playerId === ball.batsman_id
    ? [50, 100, 150, 200].find(n => n === milestone?.runs) ?? null : null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scoring-match-live", matchId] });
    qc.invalidateQueries({ queryKey: ["scoring-match", matchId] });
    qc.invalidateQueries({ queryKey: ["scoring-balls-live", activeInningsId] });
    qc.invalidateQueries({ queryKey: ["scoring-retired-hurt", activeInningsId] });
  };

  const fb = (type: "success"|"error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2200);
  };

  const addBallMutation = useMutation({
    mutationFn: (input: any) => scoringApi.post(`/innings/${activeInningsId}/balls`, input),
    onSuccess: (_, input) => {
      invalidate();
      // Milestones: wides are all byes (no bat runs), so don't count toward personal milestones
      if (!input.is_wide) {
        const entry = getBatEntry(input.batsman_id);
        if (entry) {
          const hit = [50, 100, 150, 200].find(n => entry.runs < n && (entry.runs + Number(input.runs)) >= n);
          if (hit) { setMilestone({ playerId: input.batsman_id, runs: hit }); setTimeout(() => setMilestone(null), 4000); }
        }
      }
      // Swap logic (cricket rules):
      //   Wide          → batsmen CAN run; swap if odd bye runs (1, 3…). No end-of-over swap (not a legal delivery).
      //   No-ball       → batsmen CAN run bat runs; swap if odd runs. No end-of-over swap (not a legal delivery).
      //   Legal delivery → swap on odd runs OR end of legal over (ball 6, not a wicket).
      const runs = Number(input.runs);
      let swap = false;
      if (input.is_wide || input.is_no_ball) {
        // Both wide and no-ball: swap on odd runs (batsmen crossed), but not end-of-over
        swap = runs % 2 === 1;
      } else {
        swap = runs % 2 === 1 || (!input.is_wicket && currentBallNum === 6);
      }
      setBall(prev => {
        const next: BallInput = {
          ...DEFAULT_BALL,
          bowler_id:       prev.bowler_id,
          batsman_id:      prev.batsman_id,
          non_striker_id:  prev.non_striker_id,
          bowler_type_short: prev.bowler_type_short,
          // Auto-enable free hit on the very next delivery after a no-ball
          is_free_hit: input.is_no_ball === true
        };
        if (swap) { next.batsman_id = prev.non_striker_id; next.non_striker_id = prev.batsman_id; }
        if (input.is_wicket) next.batsman_id = "";
        return next;
      });
      const desc = [
        input.is_wicket  ? "⚡ Wicket"   : null,
        input.is_wide    ? "Wide"        : null,
        input.is_no_ball ? "No-ball"     : null,
        input.is_leg_bye ? "Leg-bye"     : input.is_bye ? "Bye" : null,
        input.is_six     ? "💥 Six"      : null,
        input.is_four    ? "🏏 Four"     : null,
        !input.is_wicket && !input.is_six && !input.is_four && runs > 0 ? `${runs} run${runs !== 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(" + ") || "Dot ball";
      fb("success", desc);
    },
    onError: (err: any) => fb("error", err.response?.data?.error?.message || "Failed to record ball")
  });

  const undoMutation = useMutation({
    mutationFn: () => scoringApi.post(`/innings/${activeInningsId}/balls/undo`),
    onSuccess: () => { invalidate(); fb("success", "Last ball undone"); },
    onError: (err: any) => fb("error", err.response?.data?.error?.message || "Undo failed")
  });

  const createInningsMutation = useMutation({
    mutationFn: (input: any) => scoringApi.post(`/matches/${matchId}/innings`, input),
    onSuccess: (r) => { invalidate(); setActiveInningsId(r.data.innings.id); setBall({ ...DEFAULT_BALL }); setShowNewInnings(false); },
    onError: (err: any) => fb("error", err.response?.data?.error?.message || "Failed")
  });

  const completeMatchMutation = useMutation({
    mutationFn: (input: any) => scoringApi.put(`/matches/${matchId}`, { status:"completed", ...input }),
    onSuccess: () => { invalidate(); navigate(`/scoring/matches/${matchId}`); }
  });

  const retireHurtMutation = useMutation({
    mutationFn: (playerId: string) => scoringApi.post(`/innings/${activeInningsId}/retire-hurt`, { player_id: playerId }),
    onSuccess: (_, playerId) => {
      invalidate();
      // Clear the retired player from crease so scorer must select incoming batsman
      setBall(prev => ({
        ...prev,
        batsman_id:     prev.batsman_id    === playerId ? "" : prev.batsman_id,
        non_striker_id: prev.non_striker_id === playerId ? "" : prev.non_striker_id
      }));
      fb("success", "Retired hurt — player can return later. No wicket recorded.");
    },
    onError: (err: any) => fb("error", err.response?.data?.error?.message || "Failed to retire hurt")
  });

  const returnFromRetiredHurtMutation = useMutation({
    mutationFn: (playerId: string) => scoringApi.post(`/innings/${activeInningsId}/return-from-retired-hurt`, { player_id: playerId }),
    onSuccess: () => { invalidate(); fb("success", "Player returned from retired hurt."); },
    onError: (err: any) => fb("error", err.response?.data?.error?.message || "Failed to return player")
  });

  // Retired hurt players for this innings
  const { data: retiredHurtData } = useQuery({
    queryKey: ["scoring-retired-hurt", activeInningsId],
    queryFn: () => scoringApi.get(`/innings/${activeInningsId}/retired-hurt`).then(r => r.data.players ?? []),
    enabled: !!activeInningsId
  });

  function set(k: keyof BallInput, v: any) {
    setBall(prev => {
      const next = { ...prev, [k]: v };
      if (k === "runs") { next.is_four = Number(v) === 4; next.is_six = Number(v) === 6; }
      return next;
    });
  }

  function toggleFlag(k: keyof BallInput) { setBall(prev => ({ ...prev, [k]: !prev[k] })); }

  function submitBall(e: React.FormEvent) {
    e.preventDefault();
    if (!activeInningsId) return;

    // Retired Hurt — not a ball delivery, handled separately
    if (ball.is_ret_hurt) {
      const pid = ball.ret_hurt_player_id || ball.batsman_id;
      if (!pid) { fb("error", "Select which batsman is retiring hurt"); return; }
      retireHurtMutation.mutate(pid);
      return;
    }

    if (!ball.batsman_id || !ball.bowler_id) {
      fb("error", "Select batsman and bowler first");
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
      ball_length: ball.ball_length || undefined,
      ball_line: ball.ball_line || undefined,
      shot_type: ball.shot_type || undefined,
      bowler_variant: ball.bowler_type_short ? bowlerVariantFromShort(ball.bowler_type_short) : undefined,
      wicket_type: ball.is_wicket ? ball.wicket_type || undefined : undefined,
      dismissed_player_id: ball.is_wicket ? ball.dismissed_player_id || ball.batsman_id : undefined,
      fielder_id: ball.is_wicket ? ball.fielder_id || undefined : undefined,
      fielder_name: ball.is_wicket ? ball.fielder_name || undefined : undefined,
      fielding_position: ball.is_wicket ? ball.fielding_position || undefined : undefined,
      dismissal_zone: ball.is_wicket ? ball.dismissal_zone || undefined : undefined,
      ball_trajectory: ball.is_wicket ? ball.ball_trajectory || undefined : undefined,
    });
  }

  if (isLoading) return (
    <div className="animate-pulse p-4 space-y-2">
      <div className="skel h-14 rounded" /><div className="skel h-full rounded" />
    </div>
  );
  if (!match) return <div className="text-center py-20 text-ink-sub">Match not found.</div>;
  if (!["admin","scorer","organizer"].includes(user?.role ?? ""))
    return <div className="text-center py-20 text-ink-sub">Only scorers and admins can access this.</div>;

  const isCompleted = activeInnings?.is_completed;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-paper">

      {/* ── SCORE STRIP ────────────────────────────────────────────────────── */}
      <div className="bg-ink text-paper shrink-0 flex items-center gap-3 px-4 py-2 border-b border-paper/10">
        {/* Score block */}
        <div className="flex-1 min-w-0">
          <p className="lab text-paper/40 text-[10px] truncate">
            {match.team1?.short_name || match.team1?.name} vs {match.team2?.short_name || match.team2?.name}
            {match.format && <> · {match.format}</>}
          </p>
          <div className="flex items-baseline gap-2 leading-none">
            <span className="font-disp text-3xl font-black">
              {activeInnings ? `${activeInnings.total_runs}/${activeInnings.total_wickets}` : "—"}
            </span>
            {activeInnings && <>
              <span className="font-mononum text-paper/50 text-sm">
                ({ov(activeInnings.total_balls)}{maxOvers ? `/${maxOvers}` : ""} ov)
              </span>
              <span className="font-mononum text-paper/40 text-xs">CRR {crr(activeInnings.total_runs, activeInnings.total_balls)}</span>
              {activeInnings.extras > 0 && <span className="font-mononum text-paper/30 text-xs hidden md:inline">Extras {activeInnings.extras}</span>}
              {activeInnings.target && (
                <span className="font-mononum text-brand-400 text-xs font-bold">
                  Need {Math.max(0, activeInnings.target - activeInnings.total_runs)}
                </span>
              )}
            </>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="lab text-[10px] text-white bg-red-500 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse mr-2">
            <Radio className="w-2.5 h-2.5" /> LIVE
          </span>
          {activeInnings && (
            <Link to={`/scoring/innings/${activeInnings.id}/analytics`}
              className="p-2 rounded hover:bg-paper/10 text-paper/50 hover:text-paper transition" title="Analytics">
              <BarChart3 className="w-4 h-4" />
            </Link>
          )}
          <button onClick={() => undoMutation.mutate()} disabled={!activeInningsId || undoMutation.isPending}
            className="p-2 rounded hover:bg-paper/10 text-paper/50 hover:text-paper transition disabled:opacity-30" title="Undo last ball">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={() => {
            const prevInnings = match.innings;
            let defaultBattingId = "";
            let defaultBowlingId = "";
            if (prevInnings?.length >= 1) {
              const prev = prevInnings[prevInnings.length - 1];
              defaultBattingId = prev.batting_team_id === match.team1?.id ? match.team2?.id : match.team1?.id;
              defaultBowlingId = prev.batting_team_id === match.team1?.id ? match.team1?.id : match.team2?.id;
            } else if (match.toss_winner_id && match.toss_decision) {
              if (match.toss_decision === "bat") {
                defaultBattingId = match.toss_winner_id;
                defaultBowlingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
              } else {
                defaultBowlingId = match.toss_winner_id;
                defaultBattingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
              }
            }
            setNiForm(f => ({ ...f, innings_number: String((match.innings?.length ?? 0) + 1), batting_team_id: defaultBattingId, bowling_team_id: defaultBowlingId, target:"" }));
            setShowNewInnings(true);
          }} className="p-2 rounded hover:bg-paper/10 text-paper/50 hover:text-paper transition" title="New innings">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setShowResult(true)}
            className="ml-1 lab text-[10px] px-3 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white transition font-semibold">
            END
          </button>
        </div>
      </div>

      {/* Feedback bar */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-1.5 text-xs shrink-0 font-medium ${
          feedback.type === "success" ? "bg-green-50 text-green-700 border-b border-green-200" : "bg-red-50 text-red-700 border-b border-red-200"
        }`}>
          {feedback.type === "success" ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* Milestone flash */}
      {milestone && (
        <div className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 shrink-0 animate-popin">
          <Trophy className="w-4 h-4 shrink-0" />
          <p className="text-sm font-semibold">
            {(activeInnings?.batting_entries ?? []).find((e: any) => e.player_id === milestone.playerId)?.player?.name}
            {" "}{milestone.runs >= 100 ? "Century! 🏏" : "Half-century! ★"}
          </p>
        </div>
      )}

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANEL: ~40% */}
        <div className="w-[40%] shrink-0 border-r border-hair bg-paper flex flex-col overflow-y-auto">

          {/* Innings tabs */}
          {(match.innings?.length ?? 0) > 1 && (
            <div className="flex border-b border-hair shrink-0">
              {match.innings.map((inn: any) => (
                <button key={inn.id} onClick={() => setActiveInningsId(inn.id)}
                  className={`flex-1 py-1.5 text-xs font-semibold transition ${inn.id === activeInningsId ? "bg-ink text-paper" : "text-ink-sub hover:bg-fill"}`}>
                  Inn {inn.innings_number}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 space-y-4 flex-1 overflow-y-auto">

            {/* Batsmen */}
            {activeInningsId && (
              <div>
                <p className="lab text-[10px] text-ink-faint mb-2 uppercase tracking-wider">
                  Batting · {battingTeam?.short_name || battingTeam?.name}
                </p>
                <div className="space-y-1 relative">
                  <BatterStat entry={strikerEntry} isStriker={true} milestone={strikerMilestone ?? null}
                    selectedName={battingPlayers.find((p: any) => p.id === ball.batsman_id)?.name} />
                  {/* Swap ends button between the two batter cards */}
                  <div className="flex items-center gap-2 py-0.5">
                    <div className="flex-1 border-t border-dashed border-hairsoft" />
                    <button
                      type="button"
                      onClick={() => setBall(prev => ({ ...prev, batsman_id: prev.non_striker_id, non_striker_id: prev.batsman_id }))}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-hair bg-panel hover:bg-fill2 hover:border-ink-sub transition text-ink-sub hover:text-ink"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span className="lab text-[10px]">SWAP ENDS</span>
                    </button>
                    <div className="flex-1 border-t border-dashed border-hairsoft" />
                  </div>
                  <BatterStat entry={nonStrikerEntry} isStriker={false} milestone={null}
                    selectedName={battingPlayers.find((p: any) => p.id === ball.non_striker_id)?.name} />
                </div>
              </div>
            )}

            {/* Bowler */}
            {bowlerEntry && (
              <div>
                <p className="lab text-[10px] text-ink-faint mb-2 uppercase tracking-wider">
                  Bowling · {bowlingTeam?.short_name || bowlingTeam?.name}
                </p>
                <div className="bg-fill rounded-lg px-3 py-2.5">
                  <p className="text-sm font-semibold text-ink truncate mb-2">{bowlerEntry.player?.name}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ["OVERS", ov(bowlerEntry.balls)],
                      ["RUNS",  bowlerEntry.runs_conceded],
                      ["WKTS",  bowlerEntry.wickets],
                      ["ECO",   eco(bowlerEntry.runs_conceded, bowlerEntry.balls)]
                    ].map(([l, v]) => (
                      <div key={l as string} className="text-center">
                        <p className="lab text-[9px] text-ink-faint mb-0.5">{l}</p>
                        <p className={`font-mononum font-bold text-sm ${l === "WKTS" && bowlerEntry.wickets > 0 ? "text-brand-500" : "text-ink"}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Current over balls */}
            {currentOverBalls.length > 0 && (
              <div>
                <p className="lab text-[10px] text-ink-faint mb-2 uppercase tracking-wider">Over {currentOver + 1}</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentOverBalls.map((b: any, i: number) => (
                    <span key={i} className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mononum font-bold ${ballCls(b)}`}>
                      {ballLabel(b)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Extras */}
            {activeInnings && (
              <div className="border-t border-hairsoft pt-3">
                <p className="lab text-[10px] text-ink-faint mb-2 uppercase tracking-wider">
                  Extras <span className="text-ink font-semibold">{activeInnings.extras}</span>
                </p>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                  {[
                    ["Wides",    activeInnings.wides,       false],
                    ["No-balls", activeInnings.no_balls,    false],
                    ["Byes",     activeInnings.byes,        false],
                    ["Leg-byes", activeInnings.leg_byes,    false],
                    ["Fours",    activeInnings.boundary_4s, false],
                    ["Sixes",    activeInnings.boundary_6s, true],
                  ].map(([l, v, accent]) => (
                    <div key={l as string}>
                      <p className="lab text-[9px] text-ink-faint">{l as string}</p>
                      <p className={`font-mononum font-bold text-sm ${accent ? "text-brand-500" : "text-ink"}`}>{v as number}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retired Hurt players — can return to bat */}
            {retiredHurtData && retiredHurtData.length > 0 && (
              <div className="border-t border-hairsoft pt-3">
                <p className="lab text-[10px] text-amber-600 mb-2 uppercase tracking-wider flex items-center gap-1">
                  <HeartPulse className="w-3 h-3" /> Retired Hurt
                </p>
                <div className="space-y-1.5">
                  {retiredHurtData.map((entry: any) => (
                    <div key={entry.player_id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2.5 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink truncate">{entry.player?.name}</p>
                        <p className="lab text-[9px] text-amber-600">Can return to bat</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => returnFromRetiredHurtMutation.mutate(entry.player_id)}
                        disabled={returnFromRetiredHurtMutation.isPending}
                        className="flex items-center gap-1 lab text-[10px] px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white transition shrink-0"
                        title="Return to batting"
                      >
                        <RotateCcw className="w-3 h-3" /> Return
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Innings complete */}
            {isCompleted && (
              <div className="border-t border-hairsoft pt-3">
                <p className="text-sm font-semibold text-ink mb-0.5">Innings Complete</p>
                <p className="lab text-ink-faint mb-3">
                  {activeInnings?.total_runs}/{activeInnings?.total_wickets} ({ov(activeInnings?.total_balls ?? 0)})
                </p>
                <button
                  onClick={() => {
                    const prevInnings = match.innings;
                    let defaultBattingId = "";
                    let defaultBowlingId = "";
                    if (prevInnings?.length >= 1) {
                      const prev = prevInnings[prevInnings.length - 1];
                      defaultBattingId = prev.batting_team_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                      defaultBowlingId = prev.batting_team_id === match.team1?.id ? match.team1?.id : match.team2?.id;
                    } else if (match.toss_winner_id && match.toss_decision) {
                      if (match.toss_decision === "bat") {
                        defaultBattingId = match.toss_winner_id;
                        defaultBowlingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                      } else {
                        defaultBowlingId = match.toss_winner_id;
                        defaultBattingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                      }
                    }
                    setNiForm(f => ({ ...f, innings_number: String((match.innings?.length ?? 0) + 1), batting_team_id: defaultBattingId, bowling_team_id: defaultBowlingId, target:"" }));
                    setShowNewInnings(true);
                  }}
                  className="btn-primary text-xs min-h-0 px-3 py-2 w-full"
                >
                  Start Next Innings
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: ~60% */}
        <div className="w-[60%] flex flex-col overflow-hidden">
          {activeInningsId && !isCompleted ? (
            <form onSubmit={submitBall} className="flex-1 flex flex-col overflow-hidden p-3 gap-2">

              {/* ── Player selectors ── */}
              <div className="grid grid-cols-3 gap-2 items-end shrink-0">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="lab text-[10px]">STRIKER *</label>
                    <span className="lab text-[9px] text-ink-faint">
                      {battingPlayers.length} available
                    </span>
                  </div>
                  <select className="input w-full text-sm" value={ball.batsman_id} onChange={e => set("batsman_id", e.target.value)} required>
                    <option value="">Select…</option>
                    {battingPlayers.map((p: any) => {
                      const status = battingStatusMap.get(p.id);
                      const suffix = status === "retired_hurt" ? " (ret. hurt)" : status === "yet_to_bat" ? "" : "";
                      return <option key={p.id} value={p.id}>{p.name}{suffix}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-0.5 text-[10px]">NON-STRIKER</label>
                  <select className="input w-full text-sm" value={ball.non_striker_id} onChange={e => set("non_striker_id", e.target.value)}>
                    <option value="">Select…</option>
                    {battingPlayers.filter((p: any) => p.id !== ball.batsman_id).map((p: any) => {
                      const status = battingStatusMap.get(p.id);
                      const suffix = status === "retired_hurt" ? " (ret. hurt)" : "";
                      return <option key={p.id} value={p.id}>{p.name}{suffix}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="lab block mb-0.5 text-[10px]">BOWLER *</label>
                  <select className="input w-full text-sm" value={ball.bowler_id} onChange={e => set("bowler_id", e.target.value)} required>
                    <option value="">Select…</option>
                    {bowlingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Runs ── */}
              <div className="shrink-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <label className="lab text-[10px]">
                    {ball.is_wide && !ball.is_no_ball ? "RUNS (batsmen can run — byes off wide)" :
                     ball.is_no_ball && !ball.is_wide ? "RUNS (bat runs off no-ball)" :
                     ball.is_wide && ball.is_no_ball  ? "RUNS (byes — wide + no-ball)" :
                     ball.is_leg_bye                  ? "RUNS (leg-byes — off body, no bat contact)" :
                     ball.is_bye                      ? "RUNS (byes — missed bat, batsmen ran)" :
                     "RUNS"}
                  </label>
                  {(ball.is_wide || ball.is_no_ball) && ball.runs > 0 && (
                    <span className="lab text-[9px] text-brand-500">
                      {ball.runs + (ball.is_wide ? 1 : 0) + (ball.is_no_ball ? 1 : 0)} total extras
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {[0,1,2,3,4,5,6].map(r => (
                    <button type="button" key={r} onClick={() => set("runs", r)}
                      className={`h-10 rounded font-mononum font-black text-lg transition ${
                        ball.runs === r
                          ? r === 6 ? "bg-brand-500 text-white ring-2 ring-brand-300"
                            : r === 4 ? "bg-ink text-paper ring-2 ring-ink/40"
                            : "bg-ink text-paper ring-2 ring-ink/30"
                          : "bg-fill text-ink hover:bg-fill2 border border-hair"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Extras / Events ── */}
              <div className="shrink-0">
                <label className="lab block mb-1 text-[10px]">EXTRAS / EVENTS</label>
                <div className="flex flex-wrap gap-1.5">
                  {/* Penalty extras */}
                  <Pill label="Wide"      active={ball.is_wide}      onClick={() => toggleFlag("is_wide")}    color="amber" />
                  <Pill label="No-Ball"   active={ball.is_no_ball}   onClick={() => toggleFlag("is_no_ball")} color="amber" />
                  <span className="w-px bg-hair self-stretch" />
                  {/* Running extras */}
                  <Pill label="Bye"       active={ball.is_bye}       onClick={() => toggleFlag("is_bye")}      />
                  <Pill label="Leg-Bye"   active={ball.is_leg_bye}   onClick={() => toggleFlag("is_leg_bye")}  color="blue" />
                  <span className="w-px bg-hair self-stretch" />
                  {/* Scoring events */}
                  <Pill label="Four"      active={ball.is_four}      onClick={() => { set("runs", ball.is_four ? 0 : 4); }}  color="blue" />
                  <Pill label="Six"       active={ball.is_six}       onClick={() => { set("runs", ball.is_six  ? 0 : 6); }} color="brand" />
                  <Pill label="Wicket"    active={ball.is_wicket}    onClick={() => toggleFlag("is_wicket")}                 color="red" />
                  <Pill label="Free Hit"  active={ball.is_free_hit}  onClick={() => toggleFlag("is_free_hit")}               color="green" />
                  <span className="w-px bg-hair self-stretch" />
                  {/* Retired Hurt — not a wicket */}
                  <Pill label="Ret. Hurt" active={ball.is_ret_hurt}  onClick={() => setBall(prev => ({ ...prev, is_ret_hurt: !prev.is_ret_hurt, ret_hurt_player_id: "" }))} color="amber" />
                </div>

                {/* Inline player selector when Ret. Hurt is toggled */}
                {ball.is_ret_hurt && (
                  <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    <HeartPulse className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="lab text-[10px] text-amber-700 shrink-0">Who is retiring hurt?</p>
                    <div className="flex gap-1.5 flex-1">
                      {[
                        ball.batsman_id     ? { id: ball.batsman_id,     label: `${strikerEntry?.player?.name    ?? "Striker"} (on strike)` }    : null,
                        ball.non_striker_id ? { id: ball.non_striker_id, label: `${nonStrikerEntry?.player?.name ?? "Non-striker"} (non-strike)` } : null,
                      ].filter(Boolean).map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => set("ret_hurt_player_id", ball.ret_hurt_player_id === p.id ? "" : p.id)}
                          className={`flex-1 px-2 py-1 rounded text-xs font-medium border transition ${
                            ball.ret_hurt_player_id === p.id
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-panel border-hair text-ink-sub hover:border-amber-400"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="lab text-[9px] text-amber-600 shrink-0">Not a wicket</p>
                  </div>
                )}
              </div>

              {/* ── Ball analytics ── */}
              <div className="bg-fill/60 rounded p-2 border border-hairsoft space-y-1.5 shrink-0">
                <p className="lab text-[9px] text-ink-faint">BALL ANALYTICS</p>
                <PillGroup label="LENGTH"      options={BALL_LENGTHS}      value={ball.ball_length}      onChange={v => set("ball_length", v)} />
                <PillGroup label="LINE"        options={BALL_LINES}        value={ball.ball_line}        onChange={v => set("ball_line", v)} />
                <PillGroup label="BOWLER TYPE" options={BOWLER_TYPE_SHORT} value={ball.bowler_type_short} onChange={v => set("bowler_type_short", v)} />
                <PillGroup label="SHOT"        options={SHOT_TYPES}        value={ball.shot_type}        onChange={v => set("shot_type", v)} />
              </div>

              {/* ── Wicket details (expands when Wicket toggled) ── */}
              {ball.is_wicket && (
                <div className="border border-red-200 bg-red-50/50 rounded p-2.5 space-y-2.5">
                  <p className="lab text-[9px] text-red-600">WICKET DETAILS</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="lab block mb-1 text-[9px]">DISMISSAL TYPE *</label>
                      <select className="input w-full text-xs py-1" value={ball.wicket_type} onChange={e => set("wicket_type", e.target.value)} required={ball.is_wicket}>
                        <option value="">Select</option>
                        {WICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="lab block mb-1 text-[9px]">DISMISSED</label>
                      <select className="input w-full text-xs py-1" value={ball.dismissed_player_id} onChange={e => set("dismissed_player_id", e.target.value)}>
                        <option value="">Striker (default)</option>
                        {/* Only the two batsmen at the crease can be dismissed */}
                        {[
                          ball.batsman_id     ? { id: ball.batsman_id,     label: `${strikerEntry?.player?.name     ?? "Striker"}  · on strike` }     : null,
                          ball.non_striker_id ? { id: ball.non_striker_id, label: `${nonStrikerEntry?.player?.name ?? "Non-striker"}  · non-striker` } : null,
                        ].filter(Boolean).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="lab block mb-1 text-[9px]">FIELDER</label>
                      <select className="input w-full text-xs py-1" value={ball.fielder_id} onChange={e => set("fielder_id", e.target.value)}>
                        <option value="">None</option>
                        {bowlingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="lab block mb-1 text-[9px]">FIELDING POS</label>
                      <select className="input w-full text-xs py-1" value={ball.fielding_position} onChange={e => set("fielding_position", e.target.value)}>
                        <option value="">–</option>
                        {FIELDING_POSITIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="lab block mb-1 text-[9px]">ZONE</label>
                      <select className="input w-full text-xs py-1" value={ball.dismissal_zone} onChange={e => set("dismissal_zone", e.target.value)}>
                        <option value="">–</option>
                        {DISMISSAL_ZONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="lab block mb-1 text-[9px]">TRAJECTORY</label>
                      <select className="input w-full text-xs py-1" value={ball.ball_trajectory} onChange={e => set("ball_trajectory", e.target.value)}>
                        <option value="">–</option>
                        {BALL_TRAJECTORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <input className="input w-full text-xs py-1" value={ball.fielder_name}
                    onChange={e => set("fielder_name", e.target.value)} placeholder="Sub fielder name (optional)" />
                </div>
              )}

              {/* ── Submit ── */}
              {(() => {
                const parts: string[] = [];
                if (ball.is_ret_hurt) parts.push("RETIRED HURT");
                if (ball.is_wicket)  parts.push("WICKET");
                if (ball.is_wide)    parts.push("WIDE");
                if (ball.is_no_ball) parts.push("NO-BALL");
                if (ball.is_leg_bye) parts.push("LEG-BYE");
                else if (ball.is_bye) parts.push("BYE");
                if (ball.is_six)     parts.push("SIX");
                else if (ball.is_four) parts.push("FOUR");
                else if (ball.runs > 0 && !ball.is_wicket) parts.push(`${ball.runs} RUN${ball.runs !== 1 ? "S" : ""}`);
                const label = parts.length ? parts.join(" + ") : "BALL";

                const btnCls = addBallMutation.isPending ? "bg-fill text-ink-sub cursor-wait" :
                  ball.is_wicket                              ? "bg-red-600 hover:bg-red-700 text-white" :
                  ball.is_wide && ball.is_no_ball             ? "bg-amber-600 hover:bg-amber-700 text-white" :
                  ball.is_wide || ball.is_no_ball             ? "bg-amber-500 hover:bg-amber-600 text-white" :
                  ball.is_six                                 ? "bg-brand-500 hover:bg-brand-600 text-white" :
                  ball.is_four                                ? "bg-ink hover:bg-ink/80 text-paper" :
                                                                "bg-ink hover:bg-ink/80 text-paper";
                return (
                  <button type="submit" disabled={addBallMutation.isPending}
                    className={`w-full py-3 rounded font-black text-sm tracking-widest transition mt-auto ${btnCls}`}>
                    {addBallMutation.isPending ? "Recording…" : `RECORD ${label}`}
                  </button>
                );
              })()}
            </form>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                {isCompleted ? (
                  <>
                    <p className="font-semibold text-ink mb-1">Innings Complete</p>
                    <p className="lab text-ink-sub mb-4">{activeInnings?.total_runs}/{activeInnings?.total_wickets} ({ov(activeInnings?.total_balls ?? 0)})</p>
                    <button onClick={() => {
                      const prevInnings = match.innings;
                      let defaultBattingId = "";
                      let defaultBowlingId = "";
                      if (prevInnings?.length >= 1) {
                        const prev = prevInnings[prevInnings.length - 1];
                        defaultBattingId = prev.batting_team_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                        defaultBowlingId = prev.batting_team_id === match.team1?.id ? match.team1?.id : match.team2?.id;
                      } else if (match.toss_winner_id && match.toss_decision) {
                        if (match.toss_decision === "bat") {
                          defaultBattingId = match.toss_winner_id;
                          defaultBowlingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                        } else {
                          defaultBowlingId = match.toss_winner_id;
                          defaultBattingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                        }
                      }
                      setNiForm(f => ({ ...f, innings_number: String((match.innings?.length ?? 0) + 1), batting_team_id: defaultBattingId, bowling_team_id: defaultBowlingId, target:"" }));
                      setShowNewInnings(true);
                    }} className="btn-primary">Start Next Innings</button>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-ink mb-4">No innings started</p>
                    <button onClick={() => {
                      let defaultBattingId = "";
                      let defaultBowlingId = "";
                      if (match.toss_winner_id && match.toss_decision) {
                        if (match.toss_decision === "bat") {
                          defaultBattingId = match.toss_winner_id;
                          defaultBowlingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                        } else {
                          defaultBowlingId = match.toss_winner_id;
                          defaultBattingId = match.toss_winner_id === match.team1?.id ? match.team2?.id : match.team1?.id;
                        }
                      }
                      setNiForm(f => ({ ...f, innings_number:"1", batting_team_id: defaultBattingId, bowling_team_id: defaultBowlingId }));
                      setShowNewInnings(true);
                    }} className="btn-primary">Start Innings</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── NEW INNINGS MODAL ──────────────────────────────────────────────── */}
      {showNewInnings && (
        <div className="absolute inset-0 bg-ink/60 flex items-center justify-center z-40 p-4">
          <div className="bg-paper rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">Start New Innings</p>
              <button onClick={() => setShowNewInnings(false)} className="text-ink-faint hover:text-ink p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lab block mb-1">Innings #</label>
                <select className="input w-full text-sm" value={niForm.innings_number}
                  onChange={e => setNiForm(f => ({ ...f, innings_number: e.target.value }))}>
                  {["1","2","3","4"].map(n => <option key={n} value={n}>Innings {n}</option>)}
                </select>
              </div>
              <div>
                <label className="lab block mb-1">Target (2nd inn+)</label>
                <input className="input w-full text-sm" type="number" value={niForm.target}
                  onChange={e => setNiForm(f => ({ ...f, target: e.target.value }))} placeholder="–" />
              </div>
              <div className="col-span-2">
                <label className="lab block mb-1">Batting team *</label>
                <select className="input w-full text-sm" value={niForm.batting_team_id}
                  onChange={e => {
                    const v = e.target.value;
                    setNiForm(f => ({ ...f, batting_team_id: v, bowling_team_id: v === match.team1?.id ? match.team2?.id : match.team1?.id }));
                  }} required>
                  <option value="">Select team</option>
                  <option value={match.team1?.id}>{match.team1?.name}</option>
                  <option value={match.team2?.id}>{match.team2?.name}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button disabled={!niForm.batting_team_id || createInningsMutation.isPending}
                onClick={() => createInningsMutation.mutate({ innings_number: Number(niForm.innings_number), batting_team_id: niForm.batting_team_id, bowling_team_id: niForm.bowling_team_id, target: niForm.target ? Number(niForm.target) : undefined })}
                className="btn-primary flex-1">
                {createInningsMutation.isPending ? "Starting…" : "Start Innings"}
              </button>
              <button onClick={() => setShowNewInnings(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── END MATCH MODAL ────────────────────────────────────────────────── */}
      {showResult && (
        <div className="absolute inset-0 bg-ink/60 flex items-center justify-center z-40 p-4">
          <div className="bg-paper rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink">End Match</p>
              <button onClick={() => setShowResult(false)} className="text-ink-faint hover:text-ink p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="lab block mb-1">Winner</label>
                <select className="input w-full text-sm" value={resultForm.winner_team_id}
                  onChange={e => setResultForm(f => ({ ...f, winner_team_id: e.target.value }))}>
                  <option value="">No result / Tied</option>
                  <option value={match.team1?.id}>{match.team1?.name} won</option>
                  <option value={match.team2?.id}>{match.team2?.name} won</option>
                </select>
              </div>
              <div>
                <label className="lab block mb-1">Result summary</label>
                <input className="input w-full text-sm" value={resultForm.result_summary}
                  onChange={e => setResultForm(f => ({ ...f, result_summary: e.target.value }))}
                  placeholder="e.g. Mumbai Lions won by 5 wickets" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => completeMatchMutation.mutate({ winner_team_id: resultForm.winner_team_id || undefined, result_summary: resultForm.result_summary || undefined })}
                disabled={completeMatchMutation.isPending}
                className="flex-1 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition">
                {completeMatchMutation.isPending ? "Ending…" : "Confirm — End Match"}
              </button>
              <button onClick={() => setShowResult(false)} className="btn-secondary">Cancel</button>
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
