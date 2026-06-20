import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { queryKeys } from "../../hooks/queryKeys";
import {
  ArrowLeft, User, Shield, Star, TrendingUp, Activity
} from "lucide-react";

function StatRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <tr className="border-b border-hairsoft last:border-0">
      <td className="py-2 px-3 lab text-ink-sub text-sm">{label}</td>
      <td className="py-2 px-3 font-mononum font-semibold text-ink text-sm text-right">
        {value ?? "–"}
      </td>
    </tr>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-fill rounded-lg px-3 py-3 text-center">
      <p className="lab text-ink-faint text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className="font-disp font-black text-lg text-ink">{value}</p>
      {sub && <p className="lab text-ink-faint text-xs">{sub}</p>}
    </div>
  );
}

function BattingSection({ bat }: { bat: any }) {
  if (!bat) return null;
  const avg = bat.dismissals > 0
    ? (bat.runs / bat.dismissals).toFixed(2)
    : bat.runs > 0 ? bat.runs.toFixed(0) : "–";
  const sr = bat.balls > 0
    ? ((bat.runs / bat.balls) * 100).toFixed(1)
    : "–";

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hair">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        <h2 className="font-semibold text-ink">Batting</h2>
      </div>

      {/* Key stat tiles */}
      <div className="grid grid-cols-3 gap-2 p-3">
        <StatCard label="Runs" value={bat.runs} />
        <StatCard label="Average" value={avg} />
        <StatCard label="S/R" value={sr} />
        <StatCard label="Innings" value={bat.innings} sub={`${bat.not_outs} not out`} />
        <StatCard label="Highest" value={bat.highest} />
        <StatCard label="Balls" value={bat.balls} />
      </div>

      {/* Detailed table */}
      <table className="w-full text-sm">
        <tbody>
          <StatRow label="50s" value={bat.fifties} />
          <StatRow label="100s" value={bat.hundreds} />
          <StatRow label="Fours" value={bat.fours} />
          <StatRow label="Sixes" value={bat.sixes} />
          <StatRow label="Dismissals" value={bat.dismissals} />
        </tbody>
      </table>
    </div>
  );
}

function BowlingSection({ bowl }: { bowl: any }) {
  if (!bowl || bowl.balls === 0) return null;
  const overs = `${Math.floor(bowl.balls / 6)}.${bowl.balls % 6}`;
  const avg = bowl.wickets > 0
    ? (bowl.runs / bowl.wickets).toFixed(2)
    : "–";
  const econ = bowl.balls > 0
    ? ((bowl.runs / bowl.balls) * 6).toFixed(2)
    : "–";
  const sr = bowl.wickets > 0
    ? (bowl.balls / bowl.wickets).toFixed(1)
    : "–";

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hair">
        <Activity className="w-4 h-4 text-purple-500" />
        <h2 className="font-semibold text-ink">Bowling</h2>
      </div>

      {/* Key stat tiles */}
      <div className="grid grid-cols-3 gap-2 p-3">
        <StatCard label="Wickets" value={bowl.wickets} />
        <StatCard label="Economy" value={econ} />
        <StatCard label="Average" value={avg} />
        <StatCard label="Overs" value={overs} />
        <StatCard label="Best" value={bowl.best ?? "–"} />
        <StatCard label="S/R" value={sr} />
      </div>

      <table className="w-full text-sm">
        <tbody>
          <StatRow label="Innings" value={bowl.innings} />
          <StatRow label="Runs conceded" value={bowl.runs} />
          <StatRow label="Maidens" value={bowl.maidens} />
          <StatRow label="5-wicket hauls" value={bowl.five_wickets} />
        </tbody>
      </table>
    </div>
  );
}

function CareerSection({ career }: { career: any }) {
  if (!career) return null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hair">
        <Star className="w-4 h-4 text-amber-500" />
        <h2 className="font-semibold text-ink">Career Stats</h2>
        <span className="lab text-ink-sub text-xs ml-auto">All tournaments</span>
      </div>

      <div className="p-3 space-y-4">
        {/* Batting career */}
        {career.total_runs > 0 && (
          <div>
            <p className="lab text-ink-faint text-xs uppercase tracking-widest mb-2">Batting</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Matches" value={career.matches_played} />
              <StatCard label="Runs" value={career.total_runs} />
              <StatCard label="Avg" value={career.batting_average ?? "–"} />
              <StatCard label="S/R" value={career.strike_rate ?? "–"} />
              <StatCard label="50s / 100s" value={`${career.fifties}/${career.hundreds}`} />
              <StatCard label="Highest" value={career.highest_score ?? "–"} />
            </div>
          </div>
        )}

        {/* Bowling career */}
        {career.wickets > 0 && (
          <div>
            <p className="lab text-ink-faint text-xs uppercase tracking-widest mb-2">Bowling</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Wickets" value={career.wickets} />
              <StatCard label="Economy" value={career.bowling_economy ?? "–"} />
              <StatCard label="Average" value={career.bowling_average ?? "–"} />
              <StatCard label="Overs" value={`${career.overs_bowled ?? "–"}`} />
              <StatCard label="Best" value={career.best_bowling ?? "–"} />
              <StatCard label="5W" value={career.five_wicket_hauls ?? 0} />
            </div>
          </div>
        )}

        {/* Fielding career */}
        {(career.catches > 0 || career.stumpings > 0 || career.run_outs > 0) && (
          <div>
            <p className="lab text-ink-faint text-xs uppercase tracking-widest mb-2">Fielding</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Catches" value={career.catches} />
              <StatCard label="Stumpings" value={career.stumpings} />
              <StatCard label="Run outs" value={career.run_outs} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoringPlayerStats() {
  const { playerId } = useParams<{ playerId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.scoringPlayerStats(playerId ?? ""),
    queryFn: () =>
      scoringApi.get(`/players/${playerId}/stats`).then(r => r.data),
    enabled: !!playerId,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="skel h-24 rounded-xl" />
        <div className="skel h-48 rounded-xl" />
        <div className="skel h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <User className="w-12 h-12 text-ink-faint mx-auto mb-3" />
        <p className="font-semibold text-ink">Player not found</p>
        <p className="lab text-ink-sub mt-1">This player does not exist or has been removed.</p>
        <Link to="/scoring/matches" className="btn-secondary mt-4 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to matches
        </Link>
      </div>
    );
  }

  const { player, battingStats, bowlingStats, careerStats } = data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

      {/* Back */}
      <Link
        to={`/scoring/tournaments/${player.team?.tournament_id}`}
        className="inline-flex items-center gap-1.5 lab text-ink-sub hover:text-ink transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to tournament
      </Link>

      {/* Player header */}
      <div className="card px-5 py-4">
        <div className="flex items-start gap-4">
          {player.photo_url ? (
            <img
              src={player.photo_url}
              alt={player.name}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-fill flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-ink-faint" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-disp font-bold text-xl text-ink">{player.name}</h1>
              {player.is_captain && (
                <span className="badge bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Captain
                </span>
              )}
              {player.is_keeper && (
                <span className="badge bg-blue-50 text-blue-700 border-blue-200">Keeper</span>
              )}
            </div>

            {player.team && (
              <p className="lab text-ink-sub mt-1">{player.team.name}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {player.role && (
                <span className="badge">{player.role.replace(/-/g, " ")}</span>
              )}
              {player.batting_style && (
                <span className="badge bg-blue-50 text-blue-700 border-blue-200">
                  {player.batting_style}
                </span>
              )}
              {player.bowling_style && (
                <span className="badge bg-purple-50 text-purple-700 border-purple-200">
                  {player.bowling_style}
                </span>
              )}
              {player.jersey_number != null && (
                <span className="badge bg-fill2">#{player.jersey_number}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats sections */}
      <BattingSection bat={battingStats} />
      <BowlingSection bowl={bowlingStats} />
      <CareerSection career={careerStats} />

      {/* No stats fallback */}
      {!battingStats?.innings && !bowlingStats?.innings && !careerStats && (
        <div className="card px-6 py-10 text-center">
          <p className="lab text-ink-sub">No match statistics recorded yet for this player.</p>
        </div>
      )}
    </div>
  );
}
