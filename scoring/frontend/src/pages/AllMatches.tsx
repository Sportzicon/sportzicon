import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Radio, Clock, CheckCircle, XCircle, Calendar, MapPin, Trophy } from "lucide-react";

type MatchStatus = "all" | "live" | "upcoming" | "completed" | "abandoned";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi"];

const STATUS_ORDER = ["live", "upcoming", "completed", "abandoned", "no_result"];
const SECTION_META: Record<string, { label: string; headerCls: string; icon: React.ReactNode }> = {
  live:      { label: "Live Now",     headerCls: "bg-red-50 border-red-100 text-red-700",    icon: <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" /> },
  upcoming:  { label: "Upcoming",     headerCls: "bg-blue-50 border-blue-100 text-blue-700", icon: <Clock className="w-3.5 h-3.5 text-blue-500" /> },
  completed: { label: "Results",      headerCls: "bg-gray-50 border-gray-200 text-gray-600",  icon: <CheckCircle className="w-3.5 h-3.5 text-gray-400" /> },
  abandoned: { label: "Abandoned / No Result", headerCls: "bg-gray-50 border-gray-200 text-gray-500", icon: <XCircle className="w-3.5 h-3.5 text-gray-400" /> },
};

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live")      return <span className="badge-live flex items-center gap-1 text-xs"><Radio className="w-3 h-3 animate-pulse" /> LIVE</span>;
  if (status === "upcoming")  return <span className="badge-upcoming flex items-center gap-1 text-xs"><Clock className="w-3 h-3" /> Upcoming</span>;
  if (status === "completed") return <span className="badge-completed flex items-center gap-1 text-xs"><CheckCircle className="w-3 h-3" /> Result</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500"><XCircle className="w-3 h-3" /> Abandoned</span>;
}

function TeamScoreRow({ team, innings, isWinner }: { team: any; innings: any; isWinner: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${isWinner ? "font-bold" : ""}`}>
      {team?.logo_url && <img src={team.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
      <span className="text-sm flex-1 truncate">{team?.short_name || team?.name || "TBD"}</span>
      {innings && (
        <span className="text-sm font-mono text-gray-700 shrink-0">
          {innings.total_runs}/{innings.total_wickets}
          <span className="text-gray-400 text-xs ml-0.5">({oversFromBalls(innings.total_balls)})</span>
        </span>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: any }) {
  const team1Inn = match.innings?.find((i: any) => i.batting_team_id === match.team1?.id);
  const team2Inn = match.innings?.find((i: any) => i.batting_team_id === match.team2?.id);
  const team1Wins = match.winner_team_id === match.team1?.id;
  const team2Wins = match.winner_team_id === match.team2?.id;

  return (
    <Link to={`/matches/${match.id}`} className="card p-4 hover:shadow-md transition-shadow block">
      {/* Tournament & status */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
          <Trophy className="w-3 h-3 shrink-0" />
          <span className="truncate">{match.tournament?.name}</span>
          {match.format && <><span className="text-gray-300">·</span><span className="shrink-0">{match.format}</span></>}
        </div>
        <StatusBadge status={match.status} />
      </div>

      {/* Teams */}
      <div className="space-y-1.5 mb-3">
        {(team1Inn || team2Inn) ? (
          <>
            <TeamScoreRow team={match.team1} innings={team1Inn} isWinner={team1Wins} />
            <TeamScoreRow team={match.team2} innings={team2Inn} isWinner={team2Wins} />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {match.team1?.logo_url && <img src={match.team1.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
              <span className="font-semibold text-sm truncate">{match.team1?.short_name || match.team1?.name || "TBD"}</span>
            </div>
            <span className="text-gray-400 text-xs font-medium shrink-0">vs</span>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
              <span className="font-semibold text-sm truncate text-right">{match.team2?.short_name || match.team2?.name || "TBD"}</span>
              {match.team2?.logo_url && <img src={match.team2.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {match.result_summary && (
        <p className="text-xs font-medium text-emerald-600 mb-2">{match.result_summary}</p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        {match.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.venue}</span>}
        {match.scheduled_at && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(match.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {new Date(match.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {match.match_number && <span className="ml-auto text-gray-300">Match #{match.match_number}</span>}
      </div>
    </Link>
  );
}

export default function AllMatches() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read status + sport from URL — this is the fix for "View all" links from Home
  const statusParam = (searchParams.get("status") || "all") as MatchStatus;
  const sportParam  = searchParams.get("sport") || "";

  function setStatus(s: MatchStatus) {
    const next = new URLSearchParams(searchParams);
    if (s === "all") next.delete("status"); else next.set("status", s);
    setSearchParams(next, { replace: true });
  }

  function setSport(sp: string) {
    const next = new URLSearchParams(searchParams);
    if (!sp) next.delete("sport"); else next.set("sport", sp);
    setSearchParams(next, { replace: true });
  }

  // Count live matches separately for badge
  const { data: liveCountData } = useQuery({
    queryKey: ["live-match-count"],
    queryFn: () => api.get("/matches/live").then(r => (r.data.matches as any[]).length),
    refetchInterval: 15_000
  });

  const { data, isLoading } = useQuery({
    queryKey: ["all-matches", statusParam, sportParam],
    queryFn: () =>
      statusParam === "live"
        ? api.get("/matches/live").then(r => r.data.matches as any[])
        : api.get("/matches", {
            params: {
              status: statusParam === "all" ? undefined : statusParam,
              sport: sportParam || undefined,
              limit: 200
            }
          }).then(r => r.data.matches as any[]),
    refetchInterval: (statusParam === "live" || statusParam === "all") ? 15_000 : false
  });

  const matches: any[] = data ?? [];
  const liveCount = liveCountData ?? 0;

  // Apply sport filter client-side when showing "all" (server already filters when status set)
  const filtered = sportParam && statusParam !== "live"
    ? matches.filter(m => m.sport === sportParam || m.tournament?.sport === sportParam)
    : matches;

  // Groups for "all" view
  const grouped: Record<string, any[]> = {};
  if (statusParam === "all") {
    for (const m of filtered) {
      const key = (m.status === "no_result") ? "abandoned" : m.status;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
  }

  const STATUS_TABS: { value: MatchStatus; label: string }[] = [
    { value: "all",       label: "All" },
    { value: "live",      label: "Live" },
    { value: "upcoming",  label: "Upcoming" },
    { value: "completed", label: "Results" },
    { value: "abandoned", label: "Abandoned" },
  ];

  const tabCount = (v: MatchStatus) => {
    if (v === "live") return liveCount;
    if (v === "all")  return filtered.length;
    if (v === "abandoned") return filtered.filter(m => m.status === "abandoned" || m.status === "no_result").length;
    return filtered.filter(m => m.status === v).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Match History</h1>
        <p className="text-sm text-gray-500 mt-1">All matches — live, upcoming, and completed</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-gray-200">
        {STATUS_TABS.map(tab => {
          const count = tabCount(tab.value);
          if (count === 0 && tab.value !== "all" && tab.value !== "live" && statusParam !== tab.value) return null;
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                statusParam === tab.value
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.value === "live" && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${liveCount > 0 ? "bg-red-500 animate-pulse" : "bg-gray-300"}`} />
              )}
              {tab.label}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  statusParam === tab.value ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sport filter chips */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">Sport:</span>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {["", ...SPORTS].map(s => (
            <button
              key={s || "all"}
              onClick={() => setSport(s)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${
                sportParam === s
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Match list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No matches found</p>
          <p className="text-sm mt-1">Try a different filter or check back later.</p>
        </div>
      ) : statusParam === "all" ? (
        /* Grouped by status */
        <div className="space-y-6">
          {STATUS_ORDER.filter(s => grouped[s]?.length).map(statusKey => {
            const meta = SECTION_META[statusKey] ?? SECTION_META.abandoned;
            return (
              <div key={statusKey}>
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border border-b-0 ${meta.headerCls}`}>
                  {meta.icon}
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <span className="ml-auto text-xs bg-white/60 rounded-full px-2 py-0.5">
                    {grouped[statusKey].length} match{grouped[statusKey].length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {grouped[statusKey].map((m: any) => <MatchCard key={m.id} match={m} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat filtered list */
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((m: any) => <MatchCard key={m.id} match={m} />)}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-center text-gray-400">
          {filtered.length} match{filtered.length !== 1 ? "es" : ""}
          {sportParam ? ` · ${sportParam}` : ""}
        </p>
      )}
    </div>
  );
}
