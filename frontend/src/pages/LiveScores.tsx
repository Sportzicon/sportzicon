import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../api/scoringClient";
import { queryKeys } from "../hooks/queryKeys";
import { Activity, MapPin, RefreshCw, ChevronRight, Trophy } from "lucide-react";

const ov  = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const crr = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2) : "0.00";
const rrr = (tgt: number, r: number, b: number, maxB: number) => {
  const left = maxB - b; const need = tgt - r;
  return left > 0 && need > 0 ? ((need / left) * 6).toFixed(2) : "–";
};

function MatchCard({ match }: { match: any }) {
  const maxBalls  = (match.tournament?.overs_per_innings ?? 20) * 6;
  const inn1      = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2      = match.innings?.find((i: any) => i.innings_number === 2);
  const activeInn = (inn2 && !inn2.is_completed) ? inn2 : (!inn1?.is_completed ? inn1 : inn2 ?? inn1);
  const teamOf    = (inn: any) => inn?.batting_team_id === match.team1.id ? match.team1 : match.team2;

  return (
    <Link to={`/live-scores/${match.id}`} className="card block hover:shadow-pop/10 transition-shadow group">
      {/* Tournament strip */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-hairsoft">
        <Trophy className="w-3 h-3 text-brand-500 shrink-0" />
        <span className="lab text-ink-sub truncate">{match.tournament?.name}</span>
        {match.format && <span className="lab text-ink-faint shrink-0">· {match.format}</span>}
        <span className="ml-auto flex items-center gap-1 lab text-red-600 animate-pulse shrink-0">
          <Activity className="w-3 h-3" /> LIVE
        </span>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {/* Innings rows */}
        {[inn1, inn2].filter(Boolean).map((inn: any) => {
          const team   = teamOf(inn);
          const isLive = !inn.is_completed;
          return (
            <div key={inn.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {team.logo_url && (
                  <img src={team.logo_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                )}
                <span className={`text-sm font-semibold truncate ${isLive ? "text-ink" : "text-ink-sub"}`}>
                  {team.name}
                </span>
                {inn.target && (
                  <span className="lab text-ink-faint shrink-0">Target {inn.target}</span>
                )}
              </div>
              <span className={`font-mononum font-bold text-lg whitespace-nowrap shrink-0 ${isLive ? "text-ink" : "text-ink-sub"}`}>
                {inn.total_runs}/{inn.total_wickets}
                <span className="text-xs font-normal text-ink-faint ml-1">({ov(inn.total_balls)})</span>
              </span>
            </div>
          );
        })}

        {/* Yet to bat (if no inn2) */}
        {inn1?.is_completed && !inn2 && (
          <div className="flex items-center justify-between text-ink-faint">
            <span className="text-sm">
              {inn1.batting_team_id === match.team1.id ? match.team2.name : match.team1.name}
            </span>
            <span className="lab">Yet to bat</span>
          </div>
        )}

        {/* Stat strip */}
        <div className="pt-2 border-t border-hairsoft flex items-center justify-between">
          <div className="flex gap-4">
            <span className="lab text-ink-faint">
              CRR <span className="text-ink font-semibold">{activeInn ? crr(activeInn.total_runs, activeInn.total_balls) : "–"}</span>
            </span>
            {activeInn?.target && (
              <>
                <span className="lab text-ink-faint">
                  RRR <span className="text-brand-500 font-semibold">{rrr(activeInn.target, activeInn.total_runs, activeInn.total_balls, maxBalls)}</span>
                </span>
                <span className="lab text-red-600 font-semibold">
                  Need {Math.max(0, activeInn.target - activeInn.total_runs)}
                </span>
              </>
            )}
          </div>
          <span className="lab text-brand-500 group-hover:underline flex items-center gap-0.5 shrink-0">
            Scorecard <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {match.venue && (
        <div className="px-4 py-1.5 border-t border-hairsoft lab text-ink-faint flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {match.venue}
        </div>
      )}
    </Link>
  );
}

export default function LiveScores() {
  const { data, isLoading, dataUpdatedAt, isFetching, refetch } = useQuery({
    queryKey: queryKeys.liveMatches(),
    queryFn: () => scoringApi.get("/matches/live").then(r => r.data.matches as any[]),
    refetchInterval: 5_000
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="py-6 px-3 sm:px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="kicker mb-1">Cricket</div>
            <h1 className="font-disp text-4xl text-ink">Live Scores</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="lab text-ink-faint hidden sm:block">
                Updated <span className="font-mononum">{lastUpdated}</span>
              </p>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-secondary text-xs px-3 py-2 min-h-0 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <p className="lab text-ink-faint">
          Click any match for the full scorecard · Auto-updates every 5s
          {isFetching && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-ping ml-2 align-middle" />}
        </p>

        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="skel h-40 rounded" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && (!data || data.length === 0) && (
          <div className="card p-12 text-center">
            <Activity className="w-10 h-10 text-ink-faint mx-auto mb-3" />
            <p className="font-semibold text-ink">No matches live right now</p>
            <p className="lab text-ink-faint mt-2">Scorecards appear here automatically when a match goes live.</p>
          </div>
        )}

        {/* Cards */}
        {data?.map((match: any) => <MatchCard key={match.id} match={match} />)}
      </div>
    </div>
  );
}
