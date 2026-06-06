import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Trophy, Users, Calendar, MapPin, Radio, Edit2 } from "lucide-react";

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function MatchRow({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.batting_team_id === match.team1?.id);
  const inn2 = match.innings?.find((i: any) => i.batting_team_id === match.team2?.id);

  return (
    <Link to={`/matches/${match.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
        {match.match_number || "—"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{match.title || `${match.team1?.name ?? "TBD"} vs ${match.team2?.name ?? "TBD"}`}</p>
        <div className="flex items-center gap-4">
          <TeamScore team={match.team1} innings={inn1} />
          <span className="text-gray-300 text-xs">vs</span>
          <TeamScore team={match.team2} innings={inn2} />
        </div>
        {match.result_summary && <p className="text-xs text-emerald-600 mt-0.5">{match.result_summary}</p>}
      </div>
      {match.status === "live" && <span className="badge-live shrink-0">LIVE</span>}
      {match.status === "upcoming" && match.scheduled_at && (
        <span className="text-xs text-gray-400 shrink-0">{new Date(match.scheduled_at).toLocaleDateString()}</span>
      )}
    </Link>
  );
}

function TeamScore({ team, innings }: { team: any; innings: any }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-medium">{team?.short_name || team?.name || "TBD"}</span>
      {innings && (
        <span className="text-sm font-mono text-gray-700">
          {innings.total_runs}/{innings.total_wickets}
          <span className="text-gray-400 text-xs ml-0.5">({oversFromBalls(innings.total_balls)})</span>
        </span>
      )}
    </div>
  );
}

function StandingsTable({ tournamentId }: { tournamentId: string }) {
  const { data } = useQuery({
    queryKey: ["standings", tournamentId],
    queryFn: () => api.get(`/tournaments/${tournamentId}/standings`).then(r => r.data)
  });
  const standings = data?.standings;
  if (!standings?.length) return null;

  const isCricket = data?.tournament?.sport === "cricket";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">#</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Team</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">P</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">W</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">L</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">NR</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Pts</th>
            {isCricket && <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">NRR</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((row: any, i: number) => (
            <tr key={row.team_id} className={`border-b border-gray-100 ${i < 2 ? "bg-emerald-50/50" : ""}`}>
              <td className="py-2 px-3 text-gray-400 text-xs">{i + 1}</td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  {row.logo_url && <img src={row.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
                  <span className="font-medium">{row.short_name || row.team_name}</span>
                </div>
              </td>
              <td className="py-2 px-3 text-center">{row.played}</td>
              <td className="py-2 px-3 text-center text-emerald-600 font-medium">{row.won}</td>
              <td className="py-2 px-3 text-center text-red-500">{row.lost}</td>
              <td className="py-2 px-3 text-center">{row.no_result}</td>
              <td className="py-2 px-3 text-center font-bold">{row.points}</td>
              {isCricket && (
                <td className={`py-2 px-3 text-center text-xs ${row.nrr >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {row.nrr >= 0 ? "+" : ""}{row.nrr}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore(s => s.user);
  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => api.get(`/tournaments/${id}`).then(r => r.data.tournament)
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-40 bg-gray-100 rounded-xl" /><div className="h-64 bg-gray-100 rounded-xl" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-400">Tournament not found.</div>;

  const allMatches = data.matches ?? [];
  const liveMatches = allMatches.filter((m: any) => m.status === "live");
  const upcomingMatches = allMatches.filter((m: any) => m.status === "upcoming");
  const completedMatches = allMatches.filter((m: any) => m.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card overflow-hidden">
        {data.banner_url && <img src={data.banner_url} className="w-full h-40 object-cover" alt="" />}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {data.logo_url ? (
              <img src={data.logo_url} className="w-16 h-16 rounded-xl object-cover shrink-0" alt="" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Trophy className="w-8 h-8 text-emerald-600" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{data.name}</h1>
                {data.status === "ongoing" && <span className="badge-live">ONGOING</span>}
                {data.status === "upcoming" && <span className="badge-upcoming">Upcoming</span>}
                {data.status === "completed" && <span className="badge-completed">Completed</span>}
              </div>
              <p className="text-gray-500 capitalize mt-1">{data.sport}{data.format ? ` · ${data.format}` : ""}</p>
              <div className="flex gap-4 mt-2 text-sm text-gray-400 flex-wrap">
                {data.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.location}</span>}
                {data.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{data.start_date}{data.end_date ? ` – ${data.end_date}` : ""}</span>}
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{data.teams?.length ?? 0} teams</span>
              </div>
            </div>
            {canManage && (
              <Link to={`/tournaments/${id}/edit`} className="btn-secondary shrink-0">
                <Edit2 className="w-4 h-4" /> Edit
              </Link>
            )}
          </div>
          {data.description && <p className="mt-4 text-sm text-gray-600">{data.description}</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — matches */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live */}
          {liveMatches.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                <h2 className="font-semibold">Live Matches</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {liveMatches.map((m: any) => <MatchRow key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcomingMatches.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold mb-3">Upcoming Fixtures</h2>
              <div className="divide-y divide-gray-100">
                {upcomingMatches.map((m: any) => <MatchRow key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedMatches.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold mb-3">Results</h2>
              <div className="divide-y divide-gray-100">
                {completedMatches.map((m: any) => <MatchRow key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {allMatches.length === 0 && (
            <div className="card p-8 text-center text-gray-400">No matches scheduled yet.</div>
          )}
        </div>

        {/* Right column — standings + teams */}
        <div className="space-y-6">
          {/* Standings */}
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Points Table</h2>
            <StandingsTable tournamentId={id!} />
          </div>

          {/* Teams */}
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Teams</h2>
            <div className="space-y-2">
              {(data.teams ?? []).map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 py-1">
                  {t.logo_url ? (
                    <img src={t.logo_url} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gray-500">{(t.short_name || t.name).charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.players?.length ?? 0} players</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
