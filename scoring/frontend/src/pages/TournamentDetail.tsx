import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import {
  Trophy, Users, Calendar, MapPin, Edit2,
  Radio, Clock, CheckCircle, XCircle, ChevronRight, Filter,
  Trash2, Settings
} from "lucide-react";

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

type MatchStatus = "all" | "live" | "upcoming" | "completed" | "abandoned";

const STATUS_LABEL: Record<string, string> = {
  live: "LIVE", upcoming: "Upcoming", completed: "Result",
  abandoned: "Abandoned", no_result: "No Result"
};

function StatusBadge({ status }: { status: string }) {
  if (status === "live")
    return <span className="badge-live flex items-center gap-1 text-xs"><Radio className="w-3 h-3 animate-pulse" /> LIVE</span>;
  if (status === "upcoming")
    return <span className="badge-upcoming flex items-center gap-1 text-xs"><Clock className="w-3 h-3" /> Upcoming</span>;
  if (status === "completed")
    return <span className="badge-completed flex items-center gap-1 text-xs"><CheckCircle className="w-3 h-3" /> Result</span>;
  if (status === "abandoned" || status === "no_result")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500"><XCircle className="w-3 h-3" /> {STATUS_LABEL[status]}</span>;
  return null;
}

function TeamScore({ team, innings, isWinner }: { team: any; innings: any; isWinner: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${isWinner ? "font-bold" : ""}`}>
      {team?.logo_url && <img src={team.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
      <span className="text-sm">{team?.short_name || team?.name || "TBD"}</span>
      {innings && (
        <span className="text-sm font-mono text-gray-700">
          {innings.total_runs}/{innings.total_wickets}
          <span className="text-gray-400 text-xs ml-0.5">({oversFromBalls(innings.total_balls)})</span>
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match, canManage, onDelete, deleteLoading
}: {
  match: any;
  canManage: boolean;
  onDelete: (id: string) => void;
  deleteLoading: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const team1Inn = match.innings?.find((i: any) => i.batting_team_id === match.team1?.id);
  const team2Inn = match.innings?.find((i: any) => i.batting_team_id === match.team2?.id);
  const team1Wins = match.winner_team_id === match.team1?.id;
  const team2Wins = match.winner_team_id === match.team2?.id;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="p-4 flex items-start gap-3">
        {/* Match number */}
        {match.match_number && (
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 mt-0.5">
            {match.match_number}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {match.title ? (
              <span className="text-xs text-gray-500 font-medium">{match.title}</span>
            ) : (
              <span className="text-xs text-gray-400">Match</span>
            )}
            <StatusBadge status={match.status} />
          </div>

          {/* Teams + scores */}
          <Link to={`/matches/${match.id}`} className="block space-y-1.5 hover:opacity-80 transition-opacity">
            <TeamScore team={match.team1} innings={team1Inn} isWinner={team1Wins} />
            <TeamScore team={match.team2} innings={team2Inn} isWinner={team2Wins} />
          </Link>

          {/* Result */}
          {match.result_summary && (
            <p className="text-xs font-medium text-emerald-600 mt-2">{match.result_summary}</p>
          )}

          {/* Venue + date */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
            {match.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{match.venue}
              </span>
            )}
            {match.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(match.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {" · "}
                {new Date(match.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* Admin actions */}
          {canManage && (
            <div className="flex items-center gap-2 mt-3">
              <Link
                to={`/matches/${match.id}`}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition-colors"
              >
                <ChevronRight className="w-3 h-3" /> Scorecard
              </Link>
              <span className="text-gray-200">|</span>
              <Link
                to={`/matches/${match.id}/config`}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
              >
                <Settings className="w-3 h-3" /> Edit Match
              </Link>
              {match.status !== "live" && (
                <>
                  <span className="text-gray-200">|</span>
                  {confirmDelete ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600 font-medium">Delete?</span>
                      <button
                        onClick={() => { onDelete(match.id); setConfirmDelete(false); }}
                        disabled={deleteLoading}
                        className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600 transition-colors"
                      >
                        {deleteLoading ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StandingsTable({ tournamentId }: { tournamentId: string }) {
  const { data } = useQuery({
    queryKey: ["standings", tournamentId],
    queryFn: () => api.get(`/tournaments/${tournamentId}/standings`).then(r => r.data)
  });
  const standings = data?.standings;
  if (!standings?.length) return <p className="text-sm text-gray-400 py-2">No standings yet.</p>;

  const isCricket = data?.tournament?.sport === "cricket";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">#</th>
            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Team</th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">P</th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">W</th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">L</th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">NR</th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">Pts</th>
            {isCricket && <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">NRR</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((row: any, i: number) => (
            <tr key={row.team_id} className={`border-b border-gray-100 ${i < 2 ? "bg-emerald-50/50" : ""}`}>
              <td className="py-2 px-2 text-gray-400 text-xs">{i + 1}</td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  {row.logo_url && <img src={row.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
                  <span className="font-medium text-sm">{row.short_name || row.team_name}</span>
                </div>
              </td>
              <td className="py-2 px-2 text-center text-sm">{row.played}</td>
              <td className="py-2 px-2 text-center text-emerald-600 font-medium text-sm">{row.won}</td>
              <td className="py-2 px-2 text-center text-red-500 text-sm">{row.lost}</td>
              <td className="py-2 px-2 text-center text-sm">{row.no_result}</td>
              <td className="py-2 px-2 text-center font-bold text-sm">{row.points}</td>
              {isCricket && (
                <td className={`py-2 px-2 text-center text-xs ${row.nrr >= 0 ? "text-emerald-600" : "text-red-500"}`}>
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

const FILTER_TABS: { value: MatchStatus; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "live",      label: "Live" },
  { value: "upcoming",  label: "Upcoming" },
  { value: "completed", label: "Results" },
  { value: "abandoned", label: "Abandoned" },
];

const STATUS_ORDER = ["live", "upcoming", "completed", "abandoned", "no_result"];
const SECTION_LABELS: Record<string, string> = {
  live: "Live Now", upcoming: "Upcoming Fixtures",
  completed: "Match History", abandoned: "Abandoned / No Result", no_result: "Abandoned / No Result"
};

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore(s => s.user);
  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);
  const [matchFilter, setMatchFilter] = useState<MatchStatus>("all");

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => api.get(`/tournaments/${id}`).then(r => r.data.tournament),
    refetchInterval: 15_000
  });

  const deleteMatch = useMutation({
    mutationFn: (matchId: string) => api.delete(`/matches/${matchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament", id] })
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-40 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }
  if (!data) return <div className="text-center py-20 text-gray-400">Tournament not found.</div>;

  const allMatches: any[] = data.matches ?? [];

  const liveCount     = allMatches.filter(m => m.status === "live").length;
  const upcomingCount = allMatches.filter(m => m.status === "upcoming").length;
  const resultCount   = allMatches.filter(m => m.status === "completed").length;

  // Filter
  const filtered = matchFilter === "all"
    ? allMatches
    : matchFilter === "abandoned"
      ? allMatches.filter(m => m.status === "abandoned" || m.status === "no_result")
      : allMatches.filter(m => m.status === matchFilter);

  // Group when showing "all"
  const grouped: Record<string, any[]> = {};
  if (matchFilter === "all") {
    for (const m of allMatches) {
      const key = m.status === "no_result" ? "abandoned" : m.status;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="card overflow-hidden">
        {data.banner_url && <img src={data.banner_url} className="w-full h-40 object-cover" alt="" />}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {data.logo_url ? (
              <img src={data.logo_url} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0" alt="" />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">{data.name}</h1>
                {data.status === "ongoing" && <span className="badge-live">ONGOING</span>}
                {data.status === "upcoming" && <span className="badge-upcoming">Upcoming</span>}
                {data.status === "completed" && <span className="badge-completed">Completed</span>}
              </div>
              <p className="text-gray-500 capitalize mt-1 text-sm">{data.sport}{data.format ? ` · ${data.format}` : ""}{data.season ? ` · ${data.season}` : ""}</p>
              <div className="flex gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                {data.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{data.location}</span>}
                {data.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{data.start_date}{data.end_date ? ` – ${data.end_date}` : ""}
                  </span>
                )}
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{data.teams?.length ?? 0} teams</span>
              </div>
            </div>
            {canManage && (
              <Link to={`/tournaments/${id}/edit`} className="btn-secondary shrink-0 hidden sm:flex">
                <Edit2 className="w-4 h-4" /> Edit
              </Link>
            )}
          </div>
          {data.description && <p className="mt-4 text-sm text-gray-600">{data.description}</p>}

          {/* Quick stats */}
          <div className="mt-4 flex gap-4 flex-wrap">
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{liveCount}</div>
              <div className="text-xs text-gray-400">Live</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500">{upcomingCount}</div>
              <div className="text-xs text-gray-400">Upcoming</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-600">{resultCount}</div>
              <div className="text-xs text-gray-400">Played</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600">{allMatches.length}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — matches */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter tabs */}
          {allMatches.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1" />
              {FILTER_TABS.map(t => {
                const count = t.value === "all" ? allMatches.length
                  : t.value === "abandoned" ? allMatches.filter(m => m.status === "abandoned" || m.status === "no_result").length
                  : allMatches.filter(m => m.status === t.value).length;
                if (count === 0 && t.value !== "all") return null;
                return (
                  <button
                    key={t.value}
                    onClick={() => setMatchFilter(t.value)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                      matchFilter === t.value
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t.value === "live" && count > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    )}
                    {t.label}
                    <span className={`text-xs ${matchFilter === t.value ? "text-emerald-200" : "text-gray-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {allMatches.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No matches scheduled yet.</p>
            </div>
          ) : matchFilter === "all" ? (
            // Grouped view
            <div className="space-y-4">
              {STATUS_ORDER.filter(s => grouped[s]?.length).map(statusKey => (
                <div key={statusKey} className="card overflow-hidden">
                  <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                    statusKey === "live" ? "bg-red-50 border-red-100" :
                    statusKey === "upcoming" ? "bg-blue-50 border-blue-100" :
                    "bg-gray-50 border-gray-100"
                  }`}>
                    <div className="flex items-center gap-2">
                      {statusKey === "live" && <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
                      {statusKey === "upcoming" && <Clock className="w-3.5 h-3.5 text-blue-500" />}
                      {statusKey === "completed" && <CheckCircle className="w-3.5 h-3.5 text-gray-400" />}
                      {statusKey === "abandoned" && <XCircle className="w-3.5 h-3.5 text-gray-400" />}
                      <span className={`text-sm font-semibold ${
                        statusKey === "live" ? "text-red-700" :
                        statusKey === "upcoming" ? "text-blue-700" :
                        "text-gray-600"
                      }`}>
                        {SECTION_LABELS[statusKey]}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 bg-white rounded-full px-2 py-0.5 border">
                      {grouped[statusKey].length} match{grouped[statusKey].length !== 1 ? "es" : ""}
                    </span>
                  </div>
                  {grouped[statusKey].map(m => <MatchCard key={m.id} match={m} canManage={!!canManage} onDelete={deleteMatch.mutate} deleteLoading={deleteMatch.isPending} />)}
                </div>
              ))}
            </div>
          ) : (
            // Flat filtered view
            <div className="card overflow-hidden">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No matches in this category.</p>
              ) : (
                filtered.map(m => <MatchCard key={m.id} match={m} canManage={!!canManage} onDelete={deleteMatch.mutate} deleteLoading={deleteMatch.isPending} />)
              )}
            </div>
          )}
        </div>

        {/* Right — standings + teams */}
        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="font-semibold mb-3 text-sm">Points Table</h2>
            <StandingsTable tournamentId={id!} />
          </div>

          <div className="card p-4">
            <h2 className="font-semibold mb-3 text-sm">Teams ({data.teams?.length ?? 0})</h2>
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
              {(!data.teams || data.teams.length === 0) && (
                <p className="text-sm text-gray-400">No teams added yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
