import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Radio, Trophy, Clock } from "lucide-react";

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function ScoreChip({ innings }: { innings: any[] }) {
  if (!innings?.length) return <span className="text-gray-400 text-sm">Not started</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {innings.map((inn: any) => (
        <span key={inn.innings_number} className="text-sm font-mono">
          Inn {inn.innings_number}: <strong>{inn.total_runs}/{inn.total_wickets}</strong>
          <span className="text-gray-400 ml-1">({oversFromBalls(inn.total_balls)} ov)</span>
        </span>
      ))}
    </div>
  );
}

function LiveMatchCard({ match }: { match: any }) {
  return (
    <Link to={`/matches/${match.id}`} className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400">{match.tournament?.name} · {match.format || match.sport}</p>
          <p className="text-xs text-gray-400">{match.title || `Match ${match.match_number || ""}`}</p>
        </div>
        <span className="badge-live">LIVE</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2">
            {match.team1?.logo_url && <img src={match.team1.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
            <span className="font-semibold text-sm">{match.team1?.short_name || match.team1?.name || "TBD"}</span>
          </div>
          <div className="flex items-center gap-2">
            {match.team2?.logo_url && <img src={match.team2.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
            <span className="font-semibold text-sm">{match.team2?.short_name || match.team2?.name || "TBD"}</span>
          </div>
        </div>
        <div className="text-right">
          <ScoreChip innings={match.innings} />
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { data: liveData, isLoading } = useQuery({
    queryKey: ["live-matches"],
    queryFn: () => api.get("/matches/live").then(r => r.data),
    refetchInterval: 15_000
  });

  const { data: tournamentsData } = useQuery({
    queryKey: ["tournaments", "ongoing"],
    queryFn: () => api.get("/tournaments?status=ongoing&limit=6").then(r => r.data)
  });

  const liveMatches = liveData?.matches ?? [];
  const tournaments = tournamentsData?.items ?? [];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8">
        <h1 className="text-3xl font-bold mb-2">Live Scores</h1>
        <p className="text-emerald-100">Real-time scoring for local tournaments — cricket, football & more.</p>
      </div>

      {/* Live Matches */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
          <h2 className="font-bold text-lg">Live Now</h2>
          <span className="badge-live">{liveMatches.length}</span>
        </div>
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="card p-4 h-28 animate-pulse bg-gray-100" />)}
          </div>
        ) : liveMatches.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No live matches right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveMatches.map((m: any) => <LiveMatchCard key={m.id} match={m} />)}
          </div>
        )}
      </section>

      {/* Ongoing Tournaments */}
      {tournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-lg">Ongoing Tournaments</h2>
            </div>
            <Link to="/tournaments" className="text-sm text-emerald-600 hover:underline">View all</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tournaments.map((t: any) => (
              <Link to={`/tournaments/${t.id}`} key={t.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  {t.logo_url ? (
                    <img src={t.logo_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-emerald-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm leading-tight">{t.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{t.sport} · {t.format || "Tournament"}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{t._count?.teams ?? 0} teams</span>
                  <span>{t._count?.matches ?? 0} matches</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
