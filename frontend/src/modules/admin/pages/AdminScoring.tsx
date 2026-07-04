import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../../../api/scoringClient";
import { queryKeys } from "../../../hooks/queryKeys";
import { PageHeader } from "../../../components/UI";
import {
  Activity, Clock, CheckCircle, Trophy, MapPin, ChevronRight,
  ExternalLink, RefreshCw, XCircle, Calendar
} from "lucide-react";

const ov = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  live:      { label: "LIVE",      cls: "text-red-600 bg-red-50 border-red-200",    icon: <Activity className="w-3 h-3 animate-pulse" /> },
  upcoming:  { label: "Upcoming",  cls: "text-blue-600 bg-blue-50 border-blue-200", icon: <Clock className="w-3 h-3" /> },
  completed: { label: "Result",    cls: "text-slate-600 bg-slate-50 border-slate-200", icon: <CheckCircle className="w-3 h-3" /> },
  abandoned: { label: "Abandoned", cls: "text-orange-600 bg-orange-50 border-orange-200", icon: <XCircle className="w-3 h-3" /> },
  no_result: { label: "No Result", cls: "text-slate-400 bg-slate-50 border-slate-200", icon: <XCircle className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.no_result;
  return (
    <span className={`inline-flex items-center gap-1 lab border rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function MatchRow({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const teamOf = (inn: any) => inn?.batting_team_id === match.team1?.id ? match.team1 : match.team2;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 px-4 border-b border-hairsoft last:border-0 hover:bg-fill/50 transition-colors">
      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={match.status} />
      </div>

      {/* Tournament / title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="lab text-ink-faint truncate">{match.tournament?.name}</span>
          {match.format && <span className="lab text-ink-faint">· {match.format}</span>}
          {match.title && <span className="lab text-ink-sub">· {match.title}</span>}
        </div>

        {/* Teams + scores */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {[inn1, inn2].filter(Boolean).length > 0 ? (
            [inn1, inn2].filter(Boolean).map((inn: any, idx: number) => {
              const team = teamOf(inn);
              const isWinner = match.winner_team_id && team?.id === match.winner_team_id;
              return (
                <span key={idx} className={`text-sm ${isWinner ? "font-bold text-ink" : "text-ink-sub"}`}>
                  {team?.short_name || team?.name}
                  {" "}
                  <span className="font-mononum">{inn.total_runs}/{inn.total_wickets} ({ov(inn.total_balls)})</span>
                  {idx === 0 && inn2 && <span className="text-ink-faint mx-1">vs</span>}
                </span>
              );
            })
          ) : (
            <span className="text-sm text-ink-sub">
              {match.team1?.short_name || match.team1?.name} vs {match.team2?.short_name || match.team2?.name}
            </span>
          )}
        </div>

        {match.result_summary && (
          <p className="lab text-brand-600 mt-0.5 font-medium">{match.result_summary}</p>
        )}

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {match.venue && (
            <span className="lab text-ink-faint flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {match.venue}
            </span>
          )}
          {match.scheduled_at && (
            <span className="lab text-ink-faint flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(match.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {new Date(match.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/live-scores/${match.id}`}
          className="btn-secondary text-xs px-2.5 py-1.5 min-h-0 gap-1"
        >
          Scorecard <ChevronRight className="w-3 h-3" />
        </Link>
        <a
          href={`http://localhost:5174/matches/${match.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-xs px-2.5 py-1.5 min-h-0 gap-1 text-brand-600 border-brand-300"
        >
          Manage <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

type Filter = "all" | "live" | "upcoming" | "completed" | "abandoned";

export default function AdminScoring() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: liveData, isFetching, refetch } = useQuery({
    queryKey: queryKeys.liveMatches(),
    queryFn: () => scoringApi.get("/matches/live").then(r => r.data.matches as any[]),
    refetchInterval: 10_000
  });

  const { data: allData, isLoading } = useQuery({
    queryKey: queryKeys.allMatchesByStatus(filter),
    queryFn: () =>
      filter === "live"
        ? scoringApi.get("/matches/live").then(r => r.data.matches as any[])
        : scoringApi.get("/matches", { params: { status: filter === "all" ? undefined : filter, limit: 100 } }).then(r => r.data.matches as any[]),
    refetchInterval: filter === "live" ? 10_000 : false
  });

  const liveCount = liveData?.length ?? 0;
  const matches   = allData ?? [];

  // When showing "all", group by status
  const liveGroup     = matches.filter(m => m.status === "live");
  const upcomingGroup = matches.filter(m => m.status === "upcoming");
  const completedGroup = matches.filter(m => m.status === "completed");
  const otherGroup    = matches.filter(m => m.status === "abandoned" || m.status === "no_result");

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all",       label: "All Matches" },
    { value: "live",      label: `Live${liveCount > 0 ? ` (${liveCount})` : ""}` },
    { value: "upcoming",  label: "Upcoming" },
    { value: "completed", label: "Results" },
    { value: "abandoned", label: "Abandoned" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Scoring"
        subtitle="All matches across all tournaments — live, upcoming, and completed."
        sticky
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-secondary gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              Open Scoring Console
            </a>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Live Now", value: liveCount, urgent: liveCount > 0, icon: <Activity className="w-4 h-4 text-red-500" /> },
          { label: "Upcoming", value: null, urgent: false, icon: <Clock className="w-4 h-4 text-blue-500" /> },
          { label: "Completed", value: null, urgent: false, icon: <CheckCircle className="w-4 h-4 text-slate-400" /> },
          { label: "Tournaments", value: null, urgent: false, icon: <Trophy className="w-4 h-4 text-brand-500" /> },
        ].map(s => (
          <div key={s.label} className={`card card-body flex items-center gap-3 ${s.urgent ? "border-red-200 bg-red-50" : ""}`}>
            {s.icon}
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`text-2xl font-semibold mt-0.5 ${s.urgent ? "text-red-700" : ""}`}>
                {s.value ?? "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-hair overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 px-4 py-2.5 lab capitalize transition-colors border-b-2 -mb-px ${
              filter === f.value
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-ink-sub hover:text-ink"
            }`}
          >
            {f.value === "live" && liveCount > 0 && (
              <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse align-middle" />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* Match list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skel h-20 rounded" />)}
        </div>
      ) : matches.length === 0 ? (
        <div className="card p-12 text-center">
          <Activity className="w-10 h-10 text-ink-faint mx-auto mb-3" />
          <p className="font-semibold text-ink">No matches found</p>
          <p className="lab text-ink-faint mt-2">
            <a href="http://localhost:5174" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              Open the Scoring Console
            </a>
            {" "}to create tournaments and matches.
          </p>
        </div>
      ) : filter === "all" ? (
        <div className="space-y-6">
          {liveGroup.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                <span className="font-semibold text-red-700 text-sm">Live Now · {liveGroup.length} match{liveGroup.length !== 1 ? "es" : ""}</span>
              </div>
              {liveGroup.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          )}
          {upcomingGroup.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-blue-700 text-sm">Upcoming · {upcomingGroup.length} match{upcomingGroup.length !== 1 ? "es" : ""}</span>
              </div>
              {upcomingGroup.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          )}
          {completedGroup.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-fill border-b border-hair flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-600 text-sm">Recent Results · {completedGroup.length}</span>
              </div>
              {completedGroup.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          )}
          {otherGroup.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-fill border-b border-hair flex items-center gap-2">
                <XCircle className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-500 text-sm">Abandoned / No Result · {otherGroup.length}</span>
              </div>
              {otherGroup.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {matches.map(m => <MatchRow key={m.id} match={m} />)}
        </div>
      )}
    </div>
  );
}
