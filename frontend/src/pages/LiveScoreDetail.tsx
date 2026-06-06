import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { scoringApi } from "../api/scoringClient";
import { Activity, MapPin, RefreshCw, ChevronRight, TrendingUp, Zap, Radio } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
const ov  = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const sr  = (r: number, b: number) => b > 0 ? ((r / b) * 100).toFixed(2) : "0.00";
const eco = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2)   : "–";
const crr = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2)   : "0.00";
const rrr = (tgt: number, r: number, b: number, maxB: number) => {
  const left = maxB - b; const need = tgt - r;
  return left > 0 && need > 0 ? ((need / left) * 6).toFixed(2) : left <= 0 ? "–" : "0.00";
};
const proj = (r: number, b: number, maxB: number) =>
  b > 0 ? Math.round((r / b) * maxB) : 0;

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

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex border-b border-hair bg-panel">
      {["Live", "Scorecard"].map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-5 py-3 lab transition-colors ${
            active === t
              ? "border-b-2 border-brand-500 text-brand-500"
              : "text-ink-sub hover:text-ink"
          }`}
        >
          {t === "Live" && (
            <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse align-middle" />
          )}
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Innings selector ──────────────────────────────────────────────────────────
function InningsTabs({ innings, selected, onSelect, match }: any) {
  return (
    <div className="flex gap-1.5 flex-wrap px-4 py-3 bg-fill border-b border-hair">
      {innings.map((inn: any) => {
        const team   = inn.batting_team_id === match.team1.id ? match.team1 : match.team2;
        const isLive = !inn.is_completed;
        const ordinal = ["1st","2nd","3rd","4th"][inn.innings_number - 1] ?? `${inn.innings_number}th`;
        return (
          <button
            key={inn.id}
            onClick={() => onSelect(inn.id)}
            className={`px-3 py-1 rounded lab transition-colors ${
              selected === inn.id
                ? "bg-ink text-paper"
                : isLive
                ? "bg-panel border border-brand-500 text-brand-500"
                : "bg-panel border border-hair text-ink-sub hover:border-ink"
            }`}
          >
            {team.short_name || team.name} ({ordinal} Inn)
            {isLive && <span className="ml-1 w-1 h-1 rounded-full bg-red-500 inline-block align-middle" />}
          </button>
        );
      })}
    </div>
  );
}

// ── LIVE TAB ──────────────────────────────────────────────────────────────────
function LiveTab({ match, balls }: { match: any; balls: any[] }) {
  const maxBalls   = (match.tournament?.overs_per_innings ?? 20) * 6;
  const activeInn  = match.innings?.slice().reverse().find((i: any) => !i.is_completed)
    ?? match.innings?.[match.innings.length - 1];

  if (!activeInn) return (
    <div className="p-12 text-center text-ink-sub">Match not started yet</div>
  );

  const battingTeam = activeInn.batting_team_id === match.team1.id ? match.team1 : match.team2;
  const bowlingTeam = activeInn.batting_team_id === match.team1.id ? match.team2 : match.team1;

  const notOutBatsmen   = (activeInn.batting_entries ?? []).filter((e: any) => e.status === "not_out" || e.status === "retired_hurt");
  const lastBall        = balls[balls.length - 1];
  const strikerId       = lastBall?.batsman_id;
  const currentBowlerId = lastBall?.bowler_id;
  const activeBowlers   = (activeInn.bowling_entries ?? []).filter((e: any) => e.balls > 0).sort((a: any, b: any) => b.balls - a.balls).slice(0, 2);

  const currentOver     = activeInn.total_balls > 0 ? Math.floor((activeInn.total_balls - 1) / 6) : 0;
  const currentOverBalls= balls.filter((b: any) => b.over_number === currentOver);
  const recentBalls     = balls.slice(-20).reverse();
  const lastWicketBall  = balls.filter((b: any) => b.is_wicket).slice(-1)[0];

  const activeCRR = crr(activeInn.total_runs, activeInn.total_balls);
  const activeRRR = activeInn.target ? rrr(activeInn.target, activeInn.total_runs, activeInn.total_balls, maxBalls) : null;
  const ballsLeft = Math.max(0, maxBalls - activeInn.total_balls);

  // All innings for the headline
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const t1   = inn1?.batting_team_id === match.team1.id ? match.team1 : match.team2;
  const t2   = inn2?.batting_team_id === match.team1.id ? match.team1 : match.team2;

  return (
    <div>
      {/* ── Score headline ──────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-panel border-b border-hair">
        <p className="text-sm text-ink leading-relaxed">
          {inn1 && (
            <>
              <span className="font-semibold">{t1.short_name || t1.name}</span>
              {" "}<span className="font-mononum font-bold">{inn1.total_runs}/{inn1.total_wickets}</span>
              {" "}<span className="text-ink-faint">({ov(inn1.total_balls)})</span>
            </>
          )}
          {inn2 && (
            <>
              <span className="text-ink-faint mx-2">·</span>
              <span className="font-semibold">{t2.short_name || t2.name}</span>
              {" "}<span className="font-mononum font-bold">{inn2.total_runs}/{inn2.total_wickets}</span>
              {" "}<span className="text-ink-faint">({ov(inn2.total_balls)})</span>
              {" "}<span className="text-ink-sub">CRR: {crr(inn2.total_runs, inn2.total_balls)}</span>
            </>
          )}
          {!inn2 && inn1 && !inn1.is_completed && (
            <span className="text-ink-sub ml-2">CRR: {activeCRR}</span>
          )}
        </p>
        {activeInn.target ? (
          <p className="lab text-red-600 mt-1">
            {battingTeam.name} need {Math.max(0, activeInn.target - activeInn.total_runs)} runs in {ov(ballsLeft)} overs
          </p>
        ) : (
          <p className="lab text-ink-sub mt-1">{battingTeam.name} batting · {bowlingTeam.name} bowling</p>
        )}
      </div>

      {/* ── Current batsmen + key stats ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-5 border-b border-hair">

        {/* Left — batsmen + bowlers */}
        <div className="sm:col-span-3 bg-panel border-r border-hair">
          {/* Batsmen */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-fill border-b border-hair">
                <th className="text-left px-4 py-2 lab text-ink-sub">Batter</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">R</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">B</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">4s</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">6s</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-16">SR</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairsoft">
              {notOutBatsmen.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-3 lab text-ink-faint">Innings not started</td></tr>
              ) : notOutBatsmen.map((e: any) => {
                const isStriker = e.player_id === strikerId;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-ink">
                        {e.player?.name}
                        {e.player?.is_captain && <span className="text-brand-500"> (c)</span>}
                        {e.player?.is_keeper && <span className="text-ink-sub"> †</span>}
                        {isStriker && <span className="text-brand-500 font-bold"> *</span>}
                      </p>
                      <p className="lab text-green-600">batting</p>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mononum font-bold text-ink text-base">{e.runs}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink-sub">{e.balls_faced}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink">{e.fours}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-brand-500 font-semibold">{e.sixes}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink-sub text-xs">{sr(e.runs, e.balls_faced)}</td>
                    <td className="pr-2"><ChevronRight className="w-3.5 h-3.5 text-ink-faint" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Bowlers */}
          <table className="w-full text-sm border-t border-hair">
            <thead>
              <tr className="bg-fill border-b border-hair border-t border-hair">
                <th className="text-left px-4 py-2 lab text-ink-sub">Bowler</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">O</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">M</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">R</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-10">W</th>
                <th className="px-2 py-2 lab text-ink-sub text-right w-16">ECO</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairsoft">
              {activeBowlers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-3 lab text-ink-faint">No overs bowled yet</td></tr>
              ) : activeBowlers.map((e: any) => {
                const isBowling = e.player_id === currentBowlerId;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-ink">
                        {e.player?.name}
                        {isBowling && <span className="text-brand-500 font-bold"> *</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink-sub">{Math.floor(e.balls / 6)}.{e.balls % 6}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink-faint">{e.maidens ?? 0}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink">{e.runs_conceded}</td>
                    <td className="px-2 py-2.5 text-right font-mononum font-black text-green-700">{e.wickets}</td>
                    <td className="px-2 py-2.5 text-right font-mononum text-ink-sub text-xs">{eco(e.runs_conceded, e.balls)}</td>
                    <td className="pr-2"><ChevronRight className="w-3.5 h-3.5 text-ink-faint" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right — Key Stats */}
        <div className="sm:col-span-2 bg-fill px-4 py-4 space-y-3">
          <p className="lab text-ink-sub">Key Stats</p>

          {activeInn.partnerships?.[0] && (
            <div>
              <p className="lab text-ink-faint">Partnership</p>
              <p className="font-mononum font-semibold text-ink">
                {activeInn.partnerships[0].runs}({activeInn.partnerships[0].balls})
              </p>
            </div>
          )}

          {lastWicketBall && (
            <div>
              <p className="lab text-ink-faint">Last Wkt</p>
              <p className="text-xs text-ink-sub leading-snug">
                {lastWicketBall.batsman?.name}
                {" "}{lastWicketBall.runs}
                {" — "}{activeInn.total_wickets}/{activeInn.total_runs} in {ov((lastWicketBall.over_number) * 6 + lastWicketBall.ball_number)} ov.
              </p>
            </div>
          )}

          {activeRRR && (
            <div>
              <p className="lab text-ink-faint">RRR</p>
              <p className="font-mononum font-bold text-brand-500">{activeRRR}</p>
            </div>
          )}

          <div>
            <p className="lab text-ink-faint">CRR</p>
            <p className="font-mononum font-semibold text-ink">{activeCRR}</p>
          </div>

          <div>
            <p className="lab text-ink-faint">Ovs Left</p>
            <p className="font-mononum font-semibold text-ink">{ov(ballsLeft)}</p>
          </div>

          {balls.length >= 60 && (() => {
            const last10 = balls.slice(-60);
            const r = last10.reduce((s: number, b: any) => s + (b.runs ?? 0), 0);
            const w = last10.filter((b: any) => b.is_wicket).length;
            return (
              <div>
                <p className="lab text-ink-faint">Last 10 overs</p>
                <p className="font-mononum text-sm text-ink">{r} runs, {w} wkt{w !== 1 ? "s" : ""}</p>
              </div>
            );
          })()}

          {match.toss_winner_id && (
            <div>
              <p className="lab text-ink-faint">Toss</p>
              <p className="text-xs text-ink-sub">
                {match.toss_winner_id === match.team1.id ? match.team1.name : match.team2.name}
                {" "}({match.toss_decision === "bat" ? "Batting" : "Bowling"})
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Current over ─────────────────────────────────────────────────── */}
      {currentOverBalls.length > 0 && (
        <div className="px-4 py-3 bg-panel border-b border-hair flex items-center gap-3">
          <span className="lab text-ink-faint whitespace-nowrap">Over {currentOver + 1}</span>
          <div className="flex gap-1.5 flex-wrap">
            {currentOverBalls.map((b: any, i: number) => (
              <span key={i} className={`inline-flex items-center justify-center w-7 h-7 rounded text-[11px] font-mononum font-bold ${ballCls(b)}`}>
                {ballLabel(b)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Ball-by-ball commentary ───────────────────────────────────────── */}
      <div className="bg-panel">
        <div className="px-4 py-2 bg-fill border-b border-hair">
          <p className="lab text-ink-sub">Ball by Ball</p>
        </div>
        {recentBalls.length === 0 ? (
          <p className="px-4 py-8 lab text-ink-faint text-center">
            No balls bowled yet — commentary will appear here.
          </p>
        ) : (
          <div className="divide-y divide-hairsoft">
            {recentBalls.map((b: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="font-mononum text-xs text-ink-faint w-10 shrink-0 pt-0.5">
                  {b.over_number + 1}.{b.ball_number}
                </span>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-mononum font-bold shrink-0 ${ballCls(b)}`}>
                  {ballLabel(b)}
                </span>
                <p className="text-sm text-ink flex-1">
                  <span className="font-semibold">{b.bowler?.name}</span>
                  {" to "}
                  <span className="font-semibold">{b.batsman?.name}</span>
                  {b.is_wicket && <span className="text-red-600 font-bold"> WICKET!</span>}
                  {b.commentary
                    ? <span className="text-ink-sub">, {b.commentary}</span>
                    : (
                      <span className="text-ink-faint">
                        {b.is_wide && ", wide"}
                        {b.is_no_ball && ", no ball"}
                        {b.is_four && ", FOUR!"}
                        {b.is_six && ", SIX!"}
                        {!b.is_wide && !b.is_no_ball && !b.is_four && !b.is_six && !b.is_wicket && (
                          b.runs === 0 ? ", dot ball" : `, ${b.runs} run${b.runs !== 1 ? "s" : ""}`
                        )}
                      </span>
                    )
                  }
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SCORECARD TAB ─────────────────────────────────────────────────────────────
function ScorecardTab({ match, balls }: { match: any; balls: any[] }) {
  const innings = match.innings ?? [];
  const [selectedId, setSelectedId] = useState<string>(
    innings.find((i: any) => !i.is_completed)?.id ?? innings[innings.length - 1]?.id ?? ""
  );

  const inn = innings.find((i: any) => i.id === selectedId);
  const battingTeam = inn ? (inn.batting_team_id === match.team1.id ? match.team1 : match.team2) : null;

  const batted = (inn?.batting_entries ?? []).filter((e: any) => e.status !== "yet_to_bat");
  const dnb    = (inn?.batting_entries ?? []).filter((e: any) => e.status === "yet_to_bat");
  const bowled = (inn?.bowling_entries ?? []).filter((e: any) => e.balls > 0)
    .sort((a: any, b: any) => b.wickets !== a.wickets ? b.wickets - a.wickets : a.runs_conceded - b.runs_conceded);

  // Fall of wickets from ball events
  const fow = useMemo(() => {
    if (!inn) return [];
    let runTotal = 0; const result: any[] = [];
    const sorted = balls.slice().sort((a: any, b: any) =>
      a.over_number !== b.over_number ? a.over_number - b.over_number : a.ball_number - b.ball_number
    );
    for (const b of sorted) {
      runTotal += b.runs ?? 0;
      if (b.is_wicket) result.push({ player: b.batsman?.name ?? "–", score: `${runTotal}-${result.length + 1}`, over: `${b.over_number}.${b.ball_number}` });
    }
    return result;
  }, [balls, inn]);

  if (!inn) return <div className="p-8 text-center text-ink-sub">No innings data</div>;

  const ordinal = ["1st","2nd","3rd","4th"][inn.innings_number - 1] ?? `${inn.innings_number}th`;

  return (
    <div>
      {innings.length > 1 && (
        <InningsTabs innings={innings} selected={selectedId} onSelect={setSelectedId} match={match} />
      )}

      {/* Innings header */}
      <div className="px-4 py-3 bg-ink text-paper flex items-center justify-between">
        <span className="font-semibold text-sm">{battingTeam?.name} {ordinal} Innings</span>
        <span className="font-mononum font-bold">{inn.total_runs}/{inn.total_wickets} ({ov(inn.total_balls)} Ov)</span>
      </div>

      {/* Batting */}
      <div className="bg-panel">
        <div className="flex items-center gap-2 px-4 py-2 bg-fill border-b border-hair">
          <TrendingUp className="w-3.5 h-3.5 text-ink-sub" />
          <p className="lab text-ink-sub">Batting</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hair">
              <th className="text-left px-4 py-2 lab text-ink-faint">Batter</th>
              <th className="text-left px-3 py-2 lab text-ink-faint hidden sm:table-cell">Dismissal</th>
              <th className="text-right px-3 py-2 lab text-ink-faint w-10">R</th>
              <th className="text-right px-3 py-2 lab text-ink-faint w-10">B</th>
              <th className="text-right px-3 py-2 lab text-ink-faint w-10">4s</th>
              <th className="text-right px-3 py-2 lab text-ink-faint w-10">6s</th>
              <th className="text-right px-3 py-2 lab text-ink-faint w-16">SR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairsoft">
            {batted.map((e: any) => {
              const notOut = e.status === "not_out" || e.status === "retired_hurt";
              return (
                <tr key={e.id} className={notOut ? "bg-fill/30" : ""}>
                  <td className="px-4 py-2.5">
                    <p className={`font-semibold ${notOut ? "text-ink" : "text-ink"}`}>
                      {e.player?.name}
                      {e.player?.is_captain && <span className="text-brand-500"> (c)</span>}
                      {e.player?.is_keeper && <span className="text-ink-sub"> (wk)</span>}
                    </p>
                    <p className="lab sm:hidden mt-0.5">
                      {notOut ? <span className="text-green-700">batting</span> : e.dismissal_type?.replace(/_/g, " ") || "out"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-sub hidden sm:table-cell">
                    {notOut ? <span className="text-green-700 font-medium">batting</span> : e.dismissal_type?.replace(/_/g, " ") || "out"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mononum font-black text-ink text-base">{e.runs}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-sub">{e.balls_faced}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink">{e.fours}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-brand-500 font-semibold">{e.sixes}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint text-xs">{sr(e.runs, e.balls_faced)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Extras + Total */}
        <div className="px-4 py-2 border-t border-hair bg-fill text-sm flex justify-between">
          <span className="text-ink-sub">
            Extras <span className="font-mononum font-semibold text-ink">{inn.extras ?? 0}</span>
            <span className="text-ink-faint text-xs"> (b {inn.byes ?? 0}, lb {inn.leg_byes ?? 0}, w {inn.wides ?? 0}, nb {inn.no_balls ?? 0}, p 0)</span>
          </span>
        </div>
        <div className="px-4 py-2 border-t border-hairsoft bg-fill text-sm font-bold flex justify-between">
          <span className="text-ink">Total</span>
          <span className="font-mononum text-ink">{inn.total_runs}-{inn.total_wickets} ({ov(inn.total_balls)} Overs, RR: {crr(inn.total_runs, inn.total_balls)})</span>
        </div>

        {dnb.length > 0 && (
          <div className="px-4 py-2.5 border-t border-hairsoft text-sm">
            <span className="lab text-ink-sub">Yet to Bat: </span>
            <span className="text-ink-sub">{dnb.map((e: any) => e.player?.name).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Bowling */}
      {bowled.length > 0 && (
        <div className="bg-panel mt-px">
          <div className="flex items-center gap-2 px-4 py-2 bg-fill border-y border-hair">
            <Zap className="w-3.5 h-3.5 text-ink-sub" />
            <p className="lab text-ink-sub">Bowling</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair">
                <th className="text-left px-4 py-2 lab text-ink-faint">Bowler</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-10">O</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-10">M</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-10">R</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-10">W</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-10 hidden sm:table-cell">NB</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-10 hidden sm:table-cell">WD</th>
                <th className="text-right px-3 py-2 lab text-ink-faint w-16">ECO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairsoft">
              {bowled.map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 font-semibold text-ink">{e.player?.name}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-sub">{Math.floor(e.balls / 6)}.{e.balls % 6}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint">{e.maidens ?? 0}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink">{e.runs_conceded}</td>
                  <td className="px-3 py-2.5 text-right font-mononum font-black text-green-700 text-base">{e.wickets}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint text-xs hidden sm:table-cell">{e.no_balls ?? 0}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-faint text-xs hidden sm:table-cell">{e.wides ?? 0}</td>
                  <td className="px-3 py-2.5 text-right font-mononum text-ink-sub text-xs">{eco(e.runs_conceded, e.balls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fall of Wickets */}
      {fow.length > 0 && (
        <div className="bg-panel mt-px border-t border-hair">
          <div className="px-4 py-2 bg-fill border-b border-hair">
            <p className="lab text-ink-sub">Fall of Wickets</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairsoft">
                <th className="text-left px-4 py-2 lab text-ink-faint">Batter</th>
                <th className="text-center px-4 py-2 lab text-ink-faint">Score</th>
                <th className="text-center px-4 py-2 lab text-ink-faint">Over</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairsoft">
              {fow.map((w: any, i: number) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-ink font-medium">{w.player}</td>
                  <td className="px-4 py-2 text-center font-mononum text-ink">{w.score}</td>
                  <td className="px-4 py-2 text-center font-mononum text-ink-sub">{w.over}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Partnerships */}
      {(inn.partnerships ?? []).length > 0 && (
        <div className="bg-panel mt-px border-t border-hair">
          <div className="px-4 py-2 bg-fill border-b border-hair">
            <p className="lab text-ink-sub">Partnerships</p>
          </div>
          {inn.partnerships.map((p: any) => {
            const p1 = (inn.batting_entries ?? []).find((e: any) => e.player_id === p.player1_id);
            const p2 = (inn.batting_entries ?? []).find((e: any) => e.player_id === p.player2_id);
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-hairsoft text-sm">
                <span className="text-ink font-medium">{p1?.player?.name ?? "–"} <span className="font-mononum text-ink-sub">{p1 ? `${p1.runs}(${p1.balls_faced})` : ""}</span></span>
                <span className="font-mononum font-bold text-ink text-center">
                  {p.runs}({p.balls})
                </span>
                <span className="text-ink font-medium text-right">{p2?.player?.name ?? "–"} <span className="font-mononum text-ink-sub">{p2 ? `${p2.runs}(${p2.balls_faced})` : ""}</span></span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LiveScoreDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const [activeTab, setActiveTab] = useState("Live");

  const { data: match, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["live-match-detail", matchId],
    queryFn: () => scoringApi.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: 5_000
  });

  const activeInnId = match?.innings?.slice().reverse().find((i: any) => !i.is_completed)?.id
    ?? match?.innings?.[match.innings.length - 1]?.id;

  // Fetch balls for active innings (live updates)
  const { data: activeBallsData } = useQuery({
    queryKey: ["live-balls", activeInnId],
    queryFn: () => scoringApi.get(`/innings/${activeInnId}/balls`).then(r => r.data.balls ?? []),
    enabled: !!activeInnId,
    refetchInterval: 5_000
  });

  // For scorecard tab: fetch all balls for all innings when viewing non-active innings
  const allBalls = useMemo(() => {
    const result: any[] = [];
    match?.innings?.forEach((inn: any) => {
      if (inn.id === activeInnId) {
        // Use live data for active innings
        result.push(...(activeBallsData ?? []));
      } else {
        // For completed innings, include their ball events from match data
        const innBalls = (inn as any).ball_events ?? [];
        result.push(...innBalls);
      }
    });
    return result;
  }, [match?.innings, activeInnId, activeBallsData]);

  const balls = activeBallsData ?? [];

  if (isLoading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="animate-pulse space-y-4 w-full max-w-2xl px-4">
        <div className="skel h-20 rounded" />
        <div className="skel h-64 rounded" />
      </div>
    </div>
  );

  if (!match) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center">
        <p className="font-disp text-2xl text-ink">Match not found</p>
        <Link to="/live-scores" className="lab text-brand-500 mt-2 block">← Back to Live Scores</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto">

        {/* Match header */}
        <div className="bg-panel border-b border-hair px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Link to="/live-scores" className="lab text-brand-500 hover:underline">← Live Scores</Link>
              <h1 className="font-disp text-2xl text-ink mt-1 leading-tight">
                {match.team1?.name} <span className="text-ink-faint font-normal text-xl">vs</span> {match.team2?.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {match.tournament?.name && <span className="lab text-ink-sub">{match.tournament.name}</span>}
                {match.venue && (
                  <span className="lab text-ink-faint flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" /> {match.venue}
                  </span>
                )}
                {match.format && <span className="lab text-ink-faint">· {match.format}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {match.status === "live" && (
                <span className="flex items-center gap-1 lab text-red-600 animate-pulse">
                  <Radio className="w-3 h-3" /> LIVE
                </span>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="btn-secondary text-xs px-3 py-1.5 min-h-0 gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <TabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === "Live"
          ? <LiveTab match={match} balls={balls} />
          : <ScorecardTab match={match} balls={allBalls} />
        }
      </div>
    </div>
  );
}
