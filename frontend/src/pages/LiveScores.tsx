import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../api/scoringClient";
import { queryKeys } from "../hooks/queryKeys";
import {
  Activity, MapPin, RefreshCw, ChevronRight, Trophy,
  Clock, CheckCircle, Calendar, ChevronDown, ChevronUp
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
const ov  = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const crr = (r: number, b: number) => b > 0 ? ((r / b) * 6).toFixed(2) : "0.00";
const rrr = (tgt: number, r: number, b: number, maxB: number) => {
  const left = maxB - b; const need = tgt - r;
  return left > 0 && need > 0 ? ((need / left) * 6).toFixed(2) : "–";
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dt       = new Date(d); dt.setHours(0,0,0,0);
  if (dt.getTime() === today.getTime())    return "Today";
  if (dt.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Live match card ───────────────────────────────────────────────────────────
function LiveMatchCard({ match }: { match: any }) {
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
        {[inn1, inn2].filter(Boolean).map((inn: any) => {
          const team   = teamOf(inn);
          const isLive = !inn.is_completed;
          return (
            <div key={inn.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {team.logo_url && <img src={team.logo_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />}
                <span className={`text-sm font-semibold truncate ${isLive ? "text-ink" : "text-ink-sub"}`}>
                  {team.name}
                </span>
                {inn.target && <span className="lab text-ink-faint shrink-0">Target {inn.target}</span>}
              </div>
              <span className={`font-mononum font-bold text-lg whitespace-nowrap shrink-0 ${isLive ? "text-ink" : "text-ink-sub"}`}>
                {inn.total_runs}/{inn.total_wickets}
                <span className="text-xs font-normal text-ink-faint ml-1">({ov(inn.total_balls)})</span>
              </span>
            </div>
          );
        })}

        {inn1?.is_completed && !inn2 && (
          <div className="flex items-center justify-between text-ink-faint">
            <span className="text-sm">
              {inn1.batting_team_id === match.team1.id ? match.team2.name : match.team1.name}
            </span>
            <span className="lab">Yet to bat</span>
          </div>
        )}

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

// ── Upcoming match card ───────────────────────────────────────────────────────
function UpcomingMatchCard({ match }: { match: any }) {
  return (
    <Link to={`/live-scores/${match.id}`} className="card block hover:shadow-pop/10 transition-shadow group">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-hairsoft">
        <Trophy className="w-3 h-3 text-brand-500 shrink-0" />
        <span className="lab text-ink-sub truncate">{match.tournament?.name}</span>
        {match.format && <span className="lab text-ink-faint shrink-0">· {match.format}</span>}
        {match.scheduled_at && (
          <span className="ml-auto flex items-center gap-1 lab text-blue-600 shrink-0">
            <Clock className="w-3 h-3" />
            {fmtDate(match.scheduled_at)} · {fmtTime(match.scheduled_at)}
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {match.team1?.logo_url && <img src={match.team1.logo_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />}
            <span className="text-sm font-semibold text-ink truncate">{match.team1?.name ?? "TBD"}</span>
          </div>
          <span className="lab text-ink-faint shrink-0 text-base font-bold">vs</span>
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm font-semibold text-ink truncate text-right">{match.team2?.name ?? "TBD"}</span>
            {match.team2?.logo_url && <img src={match.team2.logo_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />}
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-hairsoft flex items-center justify-between">
          <div className="flex items-center gap-2">
            {match.venue && (
              <span className="lab text-ink-faint flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {match.venue}
              </span>
            )}
          </div>
          <span className="lab text-brand-500 group-hover:underline flex items-center gap-0.5 shrink-0">
            Details <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Completed match card ──────────────────────────────────────────────────────
function ResultCard({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const teamOf = (inn: any) => inn?.batting_team_id === match.team1?.id ? match.team1 : match.team2;

  return (
    <Link to={`/live-scores/${match.id}`} className="card block hover:shadow-pop/10 transition-shadow group">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-hairsoft">
        <Trophy className="w-3 h-3 text-brand-500 shrink-0" />
        <span className="lab text-ink-sub truncate">{match.tournament?.name}</span>
        {match.format && <span className="lab text-ink-faint shrink-0">· {match.format}</span>}
        <span className="ml-auto flex items-center gap-1 lab text-ink-faint shrink-0">
          <CheckCircle className="w-3 h-3" /> Result
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        {[inn1, inn2].filter(Boolean).map((inn: any) => {
          const team = teamOf(inn);
          const isWinner = match.winner_team_id && team?.id === match.winner_team_id;
          return (
            <div key={inn.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {team?.logo_url && <img src={team.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
                <span className={`text-sm font-semibold truncate ${isWinner ? "text-ink" : "text-ink-sub"}`}>
                  {team?.name ?? "TBD"}
                </span>
                {isWinner && <span className="lab text-brand-500 shrink-0 text-xs">WON</span>}
              </div>
              <span className={`font-mononum font-bold whitespace-nowrap shrink-0 ${isWinner ? "text-ink text-base" : "text-ink-sub text-sm"}`}>
                {inn.total_runs}/{inn.total_wickets}
                <span className="text-xs font-normal text-ink-faint ml-1">({ov(inn.total_balls)})</span>
              </span>
            </div>
          );
        })}

        {match.result_summary && (
          <p className="lab text-brand-500 pt-1 border-t border-hairsoft font-medium">{match.result_summary}</p>
        )}

        <div className="pt-1 flex items-center justify-between">
          {match.venue && (
            <span className="lab text-ink-faint flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {match.venue}
            </span>
          )}
          <span className="lab text-brand-500 group-hover:underline flex items-center gap-0.5 ml-auto">
            Scorecard <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Section wrapper with collapse ─────────────────────────────────────────────
function Section({ title, icon, count, defaultOpen = true, children }: {
  title: string; icon: React.ReactNode; count: number;
  defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 py-2 group"
      >
        <span className="flex items-center gap-1.5 lab font-semibold text-ink-sub uppercase tracking-wider">
          {icon} {title}
        </span>
        <span className="lab text-ink-faint bg-fill border border-hair rounded-full px-1.5 py-0.5 text-xs">{count}</span>
        <span className="ml-auto lab text-ink-faint">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
type Filter = "all" | "live" | "upcoming" | "results";

export default function LiveScores() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: liveData, isLoading: loadingLive, isFetching, refetch } = useQuery({
    queryKey: queryKeys.liveMatches(),
    queryFn: () => scoringApi.get("/matches/live").then(r => r.data.matches as any[]),
    refetchInterval: 5_000
  });

  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: queryKeys.upcomingMatches(),
    queryFn: () => scoringApi.get("/matches", { params: { status: "upcoming", limit: 20 } }).then(r => r.data.matches as any[])
  });

  const { data: recentData, isLoading: loadingRecent } = useQuery({
    queryKey: queryKeys.recentMatches(),
    queryFn: () => scoringApi.get("/matches", { params: { status: "completed", limit: 20 } }).then(r => r.data.matches as any[])
  });

  const liveMatches    = liveData     ?? [];
  const upcomingMatches = upcomingData ?? [];
  const recentMatches  = recentData   ?? [];

  const isLoading = loadingLive && loadingUpcoming && loadingRecent;

  const showLive     = filter === "all" || filter === "live";
  const showUpcoming = filter === "all" || filter === "upcoming";
  const showResults  = filter === "all" || filter === "results";

  const totalCount = liveMatches.length + upcomingMatches.length + recentMatches.length;

  return (
    <div className="py-6 px-3 sm:px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="kicker mb-1">Cricket</div>
            <h1 className="font-disp text-4xl text-ink">Scores</h1>
          </div>
          <div className="flex items-center gap-3">
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

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-hair">
          {(["all", "live", "upcoming", "results"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 lab capitalize transition-colors border-b-2 -mb-px ${
                filter === f
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-ink-sub hover:text-ink"
              }`}
            >
              {f === "all" ? "All" : f === "live" ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live {liveMatches.length > 0 && `(${liveMatches.length})`}
                </span>
              ) : f === "upcoming" ? (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Upcoming
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" />
                  Results
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skel h-40 rounded" />)}
          </div>
        )}

        {/* No matches at all */}
        {!isLoading && totalCount === 0 && (
          <div className="card p-12 text-center">
            <Activity className="w-10 h-10 text-ink-faint mx-auto mb-3" />
            <p className="font-semibold text-ink">No matches found</p>
            <p className="lab text-ink-faint mt-2">Matches will appear here automatically.</p>
          </div>
        )}

        {/* ── LIVE ── */}
        {!isLoading && showLive && liveMatches.length > 0 && (
          <Section
            title="Live"
            icon={<Activity className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
            count={liveMatches.length}
            defaultOpen
          >
            {liveMatches.map((m: any) => <LiveMatchCard key={m.id} match={m} />)}
          </Section>
        )}

        {/* No live — empty state only when on live filter */}
        {!isLoading && filter === "live" && liveMatches.length === 0 && (
          <div className="card p-10 text-center">
            <Activity className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <p className="font-semibold text-ink">No matches live right now</p>
            <p className="lab text-ink-faint mt-1">Scorecards appear automatically when a match goes live.</p>
          </div>
        )}

        {/* ── UPCOMING ── */}
        {!isLoading && showUpcoming && upcomingMatches.length > 0 && (
          <Section
            title="Upcoming"
            icon={<Clock className="w-3.5 h-3.5 text-blue-500" />}
            count={upcomingMatches.length}
            defaultOpen
          >
            {upcomingMatches.map((m: any) => <UpcomingMatchCard key={m.id} match={m} />)}
          </Section>
        )}

        {!isLoading && filter === "upcoming" && upcomingMatches.length === 0 && (
          <div className="card p-10 text-center">
            <Calendar className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <p className="font-semibold text-ink">No upcoming matches scheduled</p>
          </div>
        )}

        {/* ── RECENT RESULTS ── */}
        {!isLoading && showResults && recentMatches.length > 0 && (
          <Section
            title="Recent Results"
            icon={<CheckCircle className="w-3.5 h-3.5 text-ink-sub" />}
            count={recentMatches.length}
            defaultOpen
          >
            {recentMatches.map((m: any) => <ResultCard key={m.id} match={m} />)}
          </Section>
        )}

        {!isLoading && filter === "results" && recentMatches.length === 0 && (
          <div className="card p-10 text-center">
            <CheckCircle className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <p className="font-semibold text-ink">No completed matches yet</p>
          </div>
        )}

      </div>
    </div>
  );
}
