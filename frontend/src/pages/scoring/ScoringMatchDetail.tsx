import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import { hasRole } from "../../utils/roles";
import { queryKeys } from "../../hooks/queryKeys";
import { Radio, Trophy, TrendingUp, Activity, MapPin, Zap, Users, CheckCircle2, User, Settings } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
const ov  = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const sr  = (r: number, b: number) => b > 0 ? ((r / b) * 100).toFixed(1) : "–";
const eco = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2)  : "–";
const crr = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2)  : "0.00";
const rrr = (tgt: number, r: number, b: number, maxB: number) => {
  const left = maxB - b; const need = tgt - r;
  return left > 0 && need > 0 ? ((need / left) * 6).toFixed(2) : left <= 0 ? "–" : "0.00";
};
const proj = (r: number, b: number, maxB: number) =>
  b > 0 ? Math.round((r / b) * maxB) : 0;

function useLiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Tile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-fill rounded-lg px-3 py-2.5 text-center">
      <p className="lab text-ink-faint text-[10px] uppercase tracking-widest">{label}</p>
      <p className={`font-disp font-black text-xl ${accent ?? "text-ink"}`}>{value}</p>
      {sub && <p className="lab text-ink-faint">{sub}</p>}
    </div>
  );
}

// ── Team XI selector ──────────────────────────────────────────────────────────
const roleColor: Record<string, string> = {
  "batsman": "text-blue-600", "bowler": "text-purple-600",
  "all-rounder": "text-brand-500", "wicket-keeper": "text-amber-600"
};

function TeamXI({ team, sel, editing, teamNum, togglePlayer }: { team: any; sel: Set<string>; editing: boolean; teamNum: 1 | 2; togglePlayer: (t: 1 | 2, p: string) => void }) {
  const players = team?.players ?? [];
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 bg-fill border-b border-hair">
        <p className="font-semibold text-sm text-ink">{team?.name}</p>
        <p className={`lab ${sel.size === 11 ? "text-green-700" : "text-brand-500"}`}>
          {sel.size}/11 selected
        </p>
      </div>
      <div className="divide-y divide-hairsoft">
        {players.map((p: any) => {
          const checked = editing ? sel.has(p.id) : p.in_xi;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!editing}
              onClick={() => togglePlayer(teamNum, p.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                checked ? "bg-ink text-paper" : "hover:bg-fill"
              } ${!editing ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mononum font-bold ${
                checked ? "bg-paper/20 text-paper" : "bg-fill text-ink-sub"
              }`}>
                {p.jersey_number ?? <User className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${checked ? "text-paper" : "text-ink"}`}>
                  {p.name}
                  {p.is_captain && <span className="text-brand-400"> (c)</span>}
                  {p.is_keeper && <span className={checked ? "text-paper/60" : "text-ink-sub"}> †</span>}
                </p>
                <p className={`lab truncate ${checked ? "text-paper/50" : roleColor[p.role] ?? "text-ink-faint"}`}>
                  {p.role?.replace(/-/g," ")}
                </p>
              </div>
              {checked && <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Playing XI panel ─────────────────────────────────────────────────────────
function PlayingXIPanel({ matchId, canManage }: { matchId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: xi, isLoading } = useQuery({
    queryKey: queryKeys.scoringXi(matchId),
    queryFn: () => scoringApi.get(`/matches/${matchId}/xi`).then(r => r.data)
  });

  // Local selection state (player IDs)
  const [t1Sel, setT1Sel] = useState<Set<string>>(new Set());
  const [t2Sel, setT2Sel] = useState<Set<string>>(new Set());

  const saveMut = useMutation({
    mutationFn: () => scoringApi.post(`/matches/${matchId}/xi`, {
      team1_player_ids: [...t1Sel],
      team2_player_ids: [...t2Sel]
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scoringXi(matchId) });
      qc.invalidateQueries({ queryKey: queryKeys.scoringMatch(matchId) });
      setEditing(false);
    }
  });

  function startEditing() {
    if (xi) {
      setT1Sel(new Set((xi.team1?.players ?? []).filter((p: any) => p.in_xi).map((p: any) => p.id)));
      setT2Sel(new Set((xi.team2?.players ?? []).filter((p: any) => p.in_xi).map((p: any) => p.id)));
    }
    setEditing(true);
  }

  function togglePlayer(teamNum: 1 | 2, pid: string) {
    const sel  = teamNum === 1 ? t1Sel : t2Sel;
    const setSel = teamNum === 1 ? setT1Sel : setT2Sel;
    const next = new Set(sel);
    if (next.has(pid)) next.delete(pid); else next.add(pid);
    setSel(next);
  }

  if (isLoading) return <div className="skel h-24 rounded" />;

  const xiLocked = xi?.xi_locked;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hair">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-ink-sub" />
          <h2 className="font-semibold text-ink">Playing XI</h2>
          {xiLocked && !editing && (
            <span className="badge bg-green-50 text-green-700 border-green-200">Locked</span>
          )}
        </div>
        {canManage && !editing && (
          <button onClick={startEditing} className="btn-secondary text-xs min-h-0 px-3 py-1.5">
            {xiLocked ? "Edit XI" : "Select Playing XI"}
          </button>
        )}
        {canManage && editing && (
          <div className="flex gap-2">
            <button
              onClick={() => saveMut.mutate()}
              disabled={t1Sel.size !== 11 || t2Sel.size !== 11 || saveMut.isPending}
              className="btn-primary text-xs min-h-0 px-3 py-1.5"
            >
              {saveMut.isPending ? "Saving…" : "Confirm XI"}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary text-xs min-h-0 px-3 py-1.5">Cancel</button>
          </div>
        )}
      </div>

      {!xiLocked && !editing && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-sm text-amber-700">
            {canManage
              ? "Select Playing XI for both teams before starting the innings. Until selected, all squad members will be included."
              : "Playing XI not yet selected for this match."}
          </p>
        </div>
      )}

      {(xiLocked || editing) && (
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-hair">
          <TeamXI team={xi?.team1} sel={editing ? t1Sel : new Set((xi?.team1?.players ?? []).filter((p: any) => p.in_xi).map((p: any) => p.id))} editing={editing} teamNum={1} togglePlayer={togglePlayer} />
          <TeamXI team={xi?.team2} sel={editing ? t2Sel : new Set((xi?.team2?.players ?? []).filter((p: any) => p.in_xi).map((p: any) => p.id))} editing={editing} teamNum={2} togglePlayer={togglePlayer} />
        </div>
      )}

      {editing && (t1Sel.size !== 11 || t2Sel.size !== 11) && (
        <p className="lab text-brand-500 px-4 py-2 border-t border-hair text-center">
          Select exactly 11 players per team to confirm
        </p>
      )}
    </div>
  );
}

// ── Innings panel ─────────────────────────────────────────────────────────────
function InningsPanel({ inn, match }: { inn: any; match: any }) {
  const maxBalls   = (match.tournament?.overs_per_innings ?? 20) * 6;
  const battingTeam = inn.batting_team_id === match.team1?.id ? match.team1 : match.team2;
  const isLive     = !inn.is_completed;
  const liveTime   = useLiveClock();

  const batted = (inn.batting_entries ?? []).filter((e: any) => e.status !== "yet_to_bat");
  const dnb    = (inn.batting_entries ?? []).filter((e: any) => e.status === "yet_to_bat");
  const bowled = (inn.bowling_entries ?? [])
    .filter((e: any) => e.balls > 0)
    .sort((a: any, b: any) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      return a.runs_conceded - b.runs_conceded;
    });

  const fow = batted
    .filter((e: any) => e.status === "out")
    .sort((a: any, b: any) => a.batting_position - b.batting_position);

  const partnership = inn.partnerships?.[0];
  const activeCRR  = crr(inn.total_runs, inn.total_balls);
  const activeRRR  = inn.target ? rrr(inn.target, inn.total_runs, inn.total_balls, maxBalls) : null;
  const projected  = isLive && !inn.target ? proj(inn.total_runs, inn.total_balls, maxBalls) : null;
  const runsNeeded = inn.target ? Math.max(0, inn.target - inn.total_runs) : null;
  const ballsLeft  = Math.max(0, maxBalls - inn.total_balls);

  return (
    <div className="card overflow-hidden">

      {/* ── Score header ─────────────────────────────────────────────────── */}
      <div className={`px-5 py-5 ${isLive ? "bg-ink" : "bg-gray-700"} text-paper`}>
        <div className="flex items-center justify-between mb-2">
          <p className="lab text-paper/50 text-[10px] uppercase tracking-widest">
            {inn.innings_number === 1 ? "1st" : "2nd"} Innings · {battingTeam?.name}
          </p>
          {isLive && (
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 animate-pulse">
                <Radio className="w-3 h-3" /> LIVE
              </span>
              <span className="font-mononum text-[11px] text-paper/50 tabular-nums">{liveTime}</span>
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-disp text-5xl font-black tracking-tight">
              {inn.total_runs}
              <span className="text-paper/30 text-3xl">/{inn.total_wickets}</span>
            </div>
            <p className="text-paper/40 text-sm mt-1">
              ({ov(inn.total_balls)} Overs · {inn.total_balls} balls)
            </p>
          </div>
          {inn.target ? (
            <div className="text-right">
              <p className="text-paper/40 text-xs uppercase tracking-wide">Target</p>
              <p className="font-disp text-4xl font-black">{inn.target}</p>
              <p className="text-paper/50 text-xs">Need {runsNeeded} in {ov(ballsLeft)} ov</p>
            </div>
          ) : projected ? (
            <div className="text-right">
              <p className="text-paper/40 text-xs uppercase tracking-wide">Projected</p>
              <p className="font-disp text-4xl font-black">{projected}</p>
            </div>
          ) : null}
        </div>

        {/* Stat strip */}
        <div className="flex flex-wrap gap-5 mt-4 pt-3 border-t border-paper/10 text-xs">
          <span className="text-paper/40">CRR <span className="text-paper font-bold">{activeCRR}</span></span>
          {activeRRR && <span className="text-paper/40">RRR <span className="text-emerald-400 font-bold">{activeRRR}</span></span>}
          <span className="text-paper/40">
            <span className="text-blue-400 font-bold">{inn.boundary_4s ?? 0}×4</span>
            {" "}<span className="text-purple-400 font-bold">{inn.boundary_6s ?? 0}×6</span>
            {" "}<span className="text-paper/20">{inn.dot_balls ?? 0} dots</span>
          </span>
          <span className="ml-auto text-paper/40">
            Extras <span className="text-paper font-bold">{inn.extras ?? 0}</span>
            <span className="text-paper/20"> (W:{inn.wides ?? 0} NB:{inn.no_balls ?? 0} B:{inn.byes ?? 0} LB:{inn.leg_byes ?? 0})</span>
          </span>
        </div>
      </div>

      {/* ── Phase breakdown ───────────────────────────────────────────────── */}
      {(inn.pp_balls > 0 || inn.mid_balls > 0 || inn.death_balls > 0) && (
        <div className="grid grid-cols-3 divide-x divide-hair border-b border-hair bg-fill/50">
          {[
            { label: "PowerPlay", r: inn.pp_runs,    w: inn.pp_wickets,    b: inn.pp_balls,    cls: "text-blue-600" },
            { label: "Middle",    r: inn.mid_runs,   w: inn.mid_wickets,   b: inn.mid_balls,   cls: "text-amber-600" },
            { label: "Death",     r: inn.death_runs, w: inn.death_wickets, b: inn.death_balls, cls: "text-red-600" },
          ].map(({ label, r, w, b, cls }) => (
            <div key={label} className={`text-center px-3 py-3 ${!b ? "opacity-30" : ""}`}>
              <p className="lab text-ink-faint text-[9px] uppercase tracking-widest">{label}</p>
              <p className={`font-disp text-lg font-black ${cls}`}>{r}/{w}</p>
              <p className="lab text-ink-faint">{ov(b)} ov · eco {eco(r, b)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Active partnership ────────────────────────────────────────────── */}
      {isLive && partnership && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/50 border-b border-hair">
          <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-sm text-emerald-700">
            Partnership: <strong>{partnership.runs}</strong> ({partnership.balls}b)
            {partnership.fours > 0 && <> · <span className="text-blue-600">{partnership.fours}×4</span></>}
            {partnership.sixes > 0 && <> · <span className="text-purple-600">{partnership.sixes}×6</span></>}
          </span>
        </div>
      )}

      {/* ── Batting ───────────────────────────────────────────────────────── */}
      {batted.length > 0 && (
        <div className="border-b border-hair">
          <div className="flex items-center gap-2 px-4 py-2 bg-fill/60 border-b border-hair">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <p className="lab font-bold text-ink-sub text-[10px] uppercase tracking-widest">Batting</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="lab text-ink-faint border-b border-hair text-[11px]">
                <th className="text-left px-4 py-2">Batter</th>
                <th className="text-right px-3 py-2 w-10">R</th>
                <th className="text-right px-3 py-2 w-10">B</th>
                <th className="text-right px-3 py-2 w-10 text-blue-500">4s</th>
                <th className="text-right px-3 py-2 w-10 text-purple-500">6s</th>
                <th className="text-right px-3 py-2 w-14">SR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {batted.map((e: any) => {
                const notOut = e.status === "not_out" || e.status === "retired_hurt";
                return (
                  <tr key={e.id} className={notOut ? "bg-emerald-50/30" : ""}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        {notOut && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                        <div className={!notOut ? "pl-3.5" : ""}>
                          <p className={`font-semibold ${notOut ? "text-emerald-800" : "text-ink"}`}>
                            {e.player?.name}
                            {e.player?.is_captain && <span className="text-amber-500"> (c)</span>}
                            {e.player?.is_keeper && <span className="text-ink-sub"> †</span>}
                          </p>
                          <p className="lab text-ink-sub mt-0.5">
                            {notOut
                              ? <span className="text-green-700 font-semibold">not out</span>
                              : e.dismissal_type?.replace(/_/g, " ") || "out"}
                          </p>
                          {/* Dismissal analytics — shot · line · length · bowler type · fielder pos */}
                          {!notOut && (e.dismissal_shot || e.dismissal_line || e.dismissal_length || e.dismissal_bowler_type || e.dismissal_fielding_position) && (
                            <p className="lab text-ink-faint mt-0.5 leading-relaxed">
                              {[
                                e.dismissal_shot?.replace(/_/g," "),
                                e.dismissal_line?.replace(/_/g," "),
                                e.dismissal_length?.replace(/_/g," "),
                                e.dismissal_bowler_type?.replace(/_/g," "),
                                e.dismissal_fielding_position?.replace(/_/g," ")
                              ].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mononum font-black text-ink text-base">{e.runs}</td>
                    <td className="px-3 py-2.5 text-right font-mononum text-ink-sub">{e.balls_faced}</td>
                    <td className="px-3 py-2.5 text-right font-mononum text-blue-600 font-semibold">{e.fours}</td>
                    <td className="px-3 py-2.5 text-right font-mononum text-purple-600 font-semibold">{e.sixes}</td>
                    <td className="px-3 py-2.5 text-right font-mononum text-ink-sub text-xs">{sr(e.runs, e.balls_faced)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-between px-4 py-2 bg-fill border-t border-hair lab text-ink-sub text-xs">
            <span>Extras {inn.extras ?? 0} (W {inn.wides ?? 0}, NB {inn.no_balls ?? 0}, B {inn.byes ?? 0}, LB {inn.leg_byes ?? 0})</span>
            <span className="font-bold text-ink">Total: {inn.total_runs}/{inn.total_wickets} ({ov(inn.total_balls)} Ov)</span>
          </div>

          {dnb.length > 0 && (
            <p className="lab text-ink-faint px-4 py-1.5 border-t border-hair">
              DNB: {dnb.map((e: any) => e.player?.name).join(", ")}
            </p>
          )}

          {fow.length > 0 && (
            <div className="px-4 py-2.5 border-t border-hair">
              <p className="lab text-ink-faint text-[10px] uppercase tracking-widest mb-1">Fall of Wickets</p>
              <p className="text-xs text-ink-sub leading-relaxed">
                {fow.map((e: any, i: number) => (
                  <span key={e.id}>
                    {i > 0 && <span className="text-ink-faint"> · </span>}
                    <span className="text-ink font-semibold">{i + 1}-{e.runs}</span>
                    <span className="text-ink-sub"> ({e.player?.name})</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Bowling ───────────────────────────────────────────────────────── */}
      {bowled.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-fill/60 border-b border-hair">
            <Zap className="w-3.5 h-3.5 text-purple-600" />
            <p className="lab font-bold text-ink-sub text-[10px] uppercase tracking-widest">Bowling</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="lab text-ink-faint border-b border-hair text-[11px]">
                <th className="text-left px-4 py-2">Bowler</th>
                <th className="text-right px-3 py-2 w-10">O</th>
                <th className="text-right px-3 py-2 w-10">M</th>
                <th className="text-right px-3 py-2 w-10">R</th>
                <th className="text-right px-3 py-2 w-10 text-emerald-600">W</th>
                <th className="text-right px-3 py-2 w-14">Eco</th>
                <th className="text-right px-3 py-2 w-10 text-ink-faint hidden sm:table-cell">WD</th>
                <th className="text-right px-3 py-2 w-10 text-ink-faint hidden sm:table-cell">NB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {bowled.map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 font-semibold text-ink">{e.player?.name}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-sub">{Math.floor(e.balls / 6)}.{e.balls % 6}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint">{e.maidens ?? 0}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink">{e.runs_conceded}</td>
                  <td className="px-3 py-2.5 text-right font-mononum font-black text-emerald-600 text-base">{e.wickets}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-sub text-xs">{eco(e.runs_conceded, e.balls)}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint text-xs hidden sm:table-cell">{e.wides ?? 0}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint text-xs hidden sm:table-cell">{e.no_balls ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics link */}
      <div className="px-4 py-3 border-t border-hair">
        <Link to={`/scoring/innings/${inn.id}/analytics`} className="lab text-brand-500 hover:underline flex items-center gap-1 text-sm">
          <TrendingUp className="w-3.5 h-3.5" /> View full analytics
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function ScoringMatchDetailInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const user = useAuthStore(s => s.user);
  const canManage = hasRole(user?.role ?? "", "organizer", "scorer");
  const liveTime = useLiveClock();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.scoringMatch(matchId ?? ""),
    queryFn: () => scoringApi.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: (q) => q.state.data?.status === "live" ? 5_000 : false
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-fill rounded-xl" />
      <div className="h-64 bg-fill rounded-xl" />
      <div className="h-48 bg-fill rounded-xl" />
    </div>
  );
  if (!data) return <div className="text-center py-20 text-ink-sub">Match not found.</div>;

  const isCricket = data.sport === "cricket";
  const maxBalls  = (data.tournament?.overs_per_innings ?? 20) * 6;

  // Top-level match summary for 2nd innings chase
  const inn2 = data.innings?.find((i: any) => i.innings_number === 2);
  const inn1 = data.innings?.find((i: any) => i.innings_number === 1);
  const activeCRR = inn2 && !inn2.is_completed ? crr(inn2.total_runs, inn2.total_balls) : null;
  const activeRRR = inn2?.target && !inn2.is_completed
    ? rrr(inn2.target, inn2.total_runs, inn2.total_balls, maxBalls) : null;

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Breadcrumb + header */}
      <div className="flex items-start gap-2 flex-wrap">
        <Link to={`/scoring/tournaments/${data.tournament_id}`} className="lab text-brand-500 hover:underline flex items-center gap-1 shrink-0">
          <Trophy className="w-3 h-3" /> Tournament
        </Link>
        <span className="text-ink-faint">›</span>
        <div className="flex-1 min-w-0">
          <h1 className="font-disp font-bold text-ink">
            {data.title || `${data.team1?.name} vs ${data.team2?.name}`}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-0.5 lab text-ink-sub">
            {data.format && <span className="bg-fill rounded px-1.5 py-0.5 font-medium">{data.format}</span>}
            {data.venue && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{data.venue}</span>}
            {data.status === "live" && (
              <span className="flex items-center gap-2">
                <span className="font-mononum text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Radio className="w-2.5 h-2.5" /> LIVE
                </span>
                <span className="font-mononum text-[11px] text-ink-sub tabular-nums">{liveTime}</span>
              </span>
            )}
          </div>
          {data.toss_winner_id && (
            <p className="lab text-ink-faint mt-0.5">
              Toss: {data.toss_winner_id === data.team1?.id ? data.team1?.name : data.team2?.name} won · elected to {data.toss_decision}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <Link to={`/scoring/matches/${matchId}/config`} className="btn-secondary text-sm flex items-center gap-1" title="Configure match">
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configure</span>
            </Link>
            {(data.status === "live" || data.status === "upcoming") && (
              <Link to={`/scoring/matches/${matchId}/score`} className="btn-primary text-sm flex items-center gap-1">
                <Radio className="w-3.5 h-3.5" /> {data.status === "live" ? "Score Match" : "Start"}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Result banner */}
      {data.result_summary && (
        <div className="panel p-3 bg-emerald-50/40 border-emerald-200 lab text-emerald-700">
          {data.result_summary}
        </div>
      )}

      {/* Live match situation tiles */}
      {data.status === "live" && (activeCRR || inn1) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activeCRR && <Tile label="CRR"  value={activeCRR} accent="text-ink" />}
          {activeRRR && <Tile label="RRR"  value={activeRRR} accent="text-emerald-600" />}
          {inn2?.target && (
            <Tile label="Need" value={`${Math.max(0, inn2.target - inn2.total_runs)}`}
              sub={`in ${ov(Math.max(0, maxBalls - inn2.total_balls))} ov`} />
          )}
          {inn1 && !inn2 && (
            <Tile label="Projected" value={proj(inn1.total_runs, inn1.total_balls, maxBalls)}
              accent="text-brand-500" />
          )}
          {(inn2 ?? inn1) && (() => {
            const inn = inn2 ?? inn1;
            return <Tile label="Boundaries"
              value={`${inn.boundary_4s ?? 0}×4  ${inn.boundary_6s ?? 0}×6`} />;
          })()}
        </div>
      )}

      {/* Playing XI — shown for cricket matches before and during play */}
      {isCricket && matchId && (
        <PlayingXIPanel matchId={matchId} canManage={canManage} />
      )}

      {/* Cricket scorecards */}
      {isCricket && (data.innings?.length ?? 0) > 0 ? (
        <div className="space-y-4">
          {data.innings.map((inn: any) => (
            <InningsPanel key={inn.id} inn={inn} match={data} />
          ))}
        </div>
      ) : isCricket ? (
        <div className="panel p-8 text-center text-ink-sub">
          {canManage ? (
            <>
              <p className="mb-3">Match not started yet.</p>
              <Link to={`/scoring/matches/${matchId}/score`} className="btn-primary text-sm">Start scoring</Link>
            </>
          ) : "Match not started yet."}
        </div>
      ) : (
        /* Non-cricket */
        <div className="card p-6">
          <div className="grid grid-cols-3 items-center text-center gap-4">
            <div>
              <p className="font-bold text-ink">{data.team1?.name}</p>
              <p className="font-disp text-5xl font-bold mt-2">{(data.match_data as any)?.team1_score ?? 0}</p>
            </div>
            <p className="text-ink-faint font-semibold">vs</p>
            <div>
              <p className="font-bold text-ink">{data.team2?.name}</p>
              <p className="font-disp text-5xl font-bold mt-2">{(data.match_data as any)?.team2_score ?? 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoringMatchDetail() {
  return <ScoringMatchDetailInner />;
}
