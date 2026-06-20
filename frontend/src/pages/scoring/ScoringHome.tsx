import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import { hasRole } from "../../utils/roles";
import { queryKeys } from "../../hooks/queryKeys";
import {
  Radio, Trophy, Clock, CheckCircle, ArrowRight, MapPin, Calendar,
  Plus, Activity, ExternalLink, RefreshCw
} from "lucide-react";

const ov = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

// ── Live match card ────────────────────────────────────────────────────────────
function LiveCard({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const teamOf = (inn: any) => inn?.batting_team_id === match.team1?.id ? match.team1 : match.team2;

  return (
    <Link to={`/scoring/matches/${match.id}`} className="card block hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
        <Trophy className="w-3 h-3 text-red-400 shrink-0" />
        <span className="lab text-red-600 truncate">{match.tournament?.name}</span>
        {match.format && <span className="lab text-red-400 shrink-0">· {match.format}</span>}
        <span className="ml-auto inline-flex items-center gap-1 lab font-semibold text-red-600 shrink-0">
          <Activity className="w-3 h-3 animate-pulse" /> LIVE
        </span>
      </div>
      <div className="p-4 space-y-2">
        {(inn1 || inn2) ? (
          [inn1, inn2].filter(Boolean).map((inn: any) => {
            const team = teamOf(inn);
            const active = !inn.is_completed;
            return (
              <div key={inn.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {team?.logo_url && <img src={team.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
                  <span className={`text-sm font-semibold truncate ${active ? "text-ink" : "text-ink-sub"}`}>
                    {team?.short_name || team?.name || "TBD"}
                  </span>
                  {active && <span className="lab text-red-500 shrink-0 text-[10px] font-bold">batting</span>}
                </div>
                <span className={`font-mononum font-bold whitespace-nowrap shrink-0 ${active ? "text-ink text-base" : "text-ink-sub text-sm"}`}>
                  {inn.total_runs}/{inn.total_wickets}
                  <span className="text-xs font-normal text-ink-faint ml-0.5">({ov(inn.total_balls)})</span>
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{match.team1?.name || "TBD"}</span>
            <span className="text-ink-faint">vs</span>
            <span className="font-semibold">{match.team2?.name || "TBD"}</span>
          </div>
        )}
        <div className="pt-2 border-t border-hairsoft flex items-center justify-between">
          {match.venue && <span className="lab text-ink-faint flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{match.venue}</span>}
          <span className="lab text-brand-500 ml-auto shrink-0 flex items-center gap-0.5">Score <ArrowRight className="w-3 h-3" /></span>
        </div>
      </div>
    </Link>
  );
}

// ── Upcoming card ──────────────────────────────────────────────────────────────
function UpcomingCard({ match }: { match: any }) {
  const scheduled = match.scheduled_at ? new Date(match.scheduled_at) : null;
  const now = new Date(); now.setHours(0,0,0,0);
  const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
  const md  = scheduled ? new Date(scheduled) : null; if (md) md.setHours(0,0,0,0);
  const day = md?.getTime() === now.getTime() ? "Today" : md?.getTime() === tmr.getTime() ? "Tomorrow"
    : scheduled?.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) ?? "";

  return (
    <Link to={`/scoring/matches/${match.id}`} className="card block hover:shadow-md transition-shadow p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="lab text-ink-sub truncate">{match.tournament?.name}</span>
        <span className="inline-flex items-center gap-1 lab text-blue-600 shrink-0 bg-blue-50 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Upcoming
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        {match.team1?.logo_url && <img src={match.team1.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
        <span className="font-semibold text-sm">{match.team1?.short_name || match.team1?.name || "TBD"}</span>
        <span className="text-ink-faint lab mx-1">vs</span>
        {match.team2?.logo_url && <img src={match.team2.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
        <span className="font-semibold text-sm">{match.team2?.short_name || match.team2?.name || "TBD"}</span>
      </div>
      <div className="flex items-center gap-3 lab text-ink-faint flex-wrap">
        {scheduled && (
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            <Calendar className="w-3 h-3" />{day} · {scheduled.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {match.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.venue}</span>}
      </div>
    </Link>
  );
}

// ── Result card ────────────────────────────────────────────────────────────────
function ResultCard({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.batting_team_id === match.team1?.id);
  const inn2 = match.innings?.find((i: any) => i.batting_team_id === match.team2?.id);
  const t1w  = match.winner_team_id === match.team1?.id;
  const t2w  = match.winner_team_id === match.team2?.id;

  return (
    <Link to={`/scoring/matches/${match.id}`} className="card block hover:shadow-md transition-shadow p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="lab text-ink-sub truncate">{match.tournament?.name}</span>
        <span className="inline-flex items-center gap-1 lab text-ink-sub bg-fill px-2 py-0.5 rounded-full shrink-0">
          <CheckCircle className="w-3 h-3 text-green-600" /> Result
        </span>
      </div>
      <div className="space-y-1.5">
        {[{ team: match.team1, inn: inn1, wins: t1w }, { team: match.team2, inn: inn2, wins: t2w }].map(({ team, inn, wins }) => (
          <div key={team?.id} className={`flex items-center gap-2 ${wins ? "font-bold" : "opacity-60"}`}>
            {team?.logo_url && <img src={team.logo_url} className="w-4 h-4 rounded-full object-cover shrink-0" alt="" />}
            <span className="text-sm flex-1 truncate">{team?.short_name || team?.name || "TBD"}</span>
            {wins && <span className="lab text-brand-500 shrink-0 text-[10px] font-bold">WON</span>}
            {inn && <span className="font-mononum text-sm shrink-0">{inn.total_runs}/{inn.total_wickets} <span className="text-ink-faint text-xs">({ov(inn.total_balls)})</span></span>}
          </div>
        ))}
      </div>
      {match.result_summary && (
        <p className="lab text-brand-500 mt-2 pt-2 border-t border-hairsoft font-medium">{match.result_summary}</p>
      )}
    </Link>
  );
}

// ── Tournament card ────────────────────────────────────────────────────────────
function TournamentCard({ t }: { t: any }) {
  return (
    <Link to={`/scoring/tournaments/${t.id}`} className="card p-4 hover:shadow-md transition-shadow flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        {t.logo_url
          ? <img src={t.logo_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
          : <Trophy className="w-5 h-5 text-emerald-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{t.name}</p>
        <p className="lab text-ink-sub capitalize">{t.sport}{t.format ? ` · ${t.format}` : ""}</p>
        <div className="flex gap-3 mt-0.5">
          <span className="lab text-ink-faint">{t._count?.teams ?? 0} teams</span>
          <span className="lab text-ink-faint">{t._count?.matches ?? 0} matches</span>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 lab text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0 text-[10px] font-bold">
        <Activity className="w-2.5 h-2.5 animate-pulse" /> LIVE
      </span>
    </Link>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function Section({ icon, title, count, href, hrefLabel = "View all", children, refetchInterval: _ }: {
  icon: React.ReactNode; title: string; count?: number;
  href?: string; hrefLabel?: string; children: React.ReactNode; refetchInterval?: number
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-disp font-semibold text-base text-ink">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="lab text-ink-faint bg-fill border border-hair rounded-full px-1.5 py-0.5 text-xs">{count}</span>
        )}
        {href && (
          <Link to={href} className="ml-auto lab text-brand-500 hover:underline flex items-center gap-0.5">
            {hrefLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ScoringHomeInner() {
  const user = useAuthStore(s => s.user);
  const canManage = hasRole(user?.role ?? "", "organizer", "scorer");

  const { data: liveData, isLoading: loadingLive, isFetching, refetch } = useQuery({
    queryKey: queryKeys.scoringLive(),
    queryFn: () => scoringApi.get("/matches/live").then(r => r.data),
    refetchInterval: 10_000
  });

  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: queryKeys.scoringAllMatches({ status: "upcoming", limit: 6 }),
    queryFn: () => scoringApi.get("/matches", { params: { status: "upcoming", limit: 6 } }).then(r => r.data)
  });

  const { data: completedData, isLoading: loadingCompleted } = useQuery({
    queryKey: queryKeys.scoringAllMatches({ status: "completed", limit: 6 }),
    queryFn: () => scoringApi.get("/matches", { params: { status: "completed", limit: 6 } }).then(r => r.data)
  });

  const { data: tourData } = useQuery({
    queryKey: queryKeys.scoringTournaments({ status: "ongoing" }),
    queryFn: () => scoringApi.get("/tournaments", { params: { status: "ongoing", limit: 6 } }).then(r => r.data),
    refetchInterval: 30_000
  });

  const liveMatches      = liveData?.matches      ?? [];
  const upcomingMatches  = upcomingData?.matches   ?? [];
  const completedMatches = completedData?.matches  ?? [];
  const ongoingTourneys  = tourData?.items         ?? [];

  const allEmpty = !loadingLive && !loadingUpcoming && !loadingCompleted
    && liveMatches.length === 0 && upcomingMatches.length === 0 && completedMatches.length === 0;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-disp text-3xl text-ink">Scoring Console</h1>
          <p className="lab text-ink-sub mt-0.5">
            {user?.full_name} · {liveMatches.length > 0 ? (
              <span className="text-red-600 font-semibold">{liveMatches.length} match{liveMatches.length > 1 ? "es" : ""} live</span>
            ) : "No live matches"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary text-xs px-3 py-2 min-h-0 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <Link to="/scoring/tournaments" className="btn-secondary text-sm">All tournaments</Link>
          {canManage && (
            <Link to="/scoring/tournaments/new" className="btn-accent text-sm flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> New tournament
            </Link>
          )}
        </div>
      </div>

      {/* All empty */}
      {allEmpty && (
        <div className="card p-12 text-center">
          <Trophy className="w-12 h-12 text-ink-faint mx-auto mb-3" />
          <p className="font-disp text-xl text-ink">No matches yet</p>
          <p className="lab text-ink-faint mt-1">Create a tournament and schedule matches to get started.</p>
          {canManage && (
            <Link to="/scoring/tournaments/new" className="btn-accent mt-4 inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Create Tournament
            </Link>
          )}
        </div>
      )}

      {/* ── Live ── */}
      {(loadingLive || liveMatches.length > 0) && (
        <Section
          icon={<Radio className="w-4 h-4 text-red-500 animate-pulse" />}
          title="Live Now"
          count={liveMatches.length}
          href="/scoring/matches"
          hrefLabel="All matches"
        >
          {loadingLive ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2].map(i => <div key={i} className="skel h-32 rounded" />)}
            </div>
          ) : liveMatches.length === 0 ? (
            <div className="panel p-8 text-center text-ink-sub">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No live matches right now</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveMatches.map((m: any) => <LiveCard key={m.id} match={m} />)}
            </div>
          )}
        </Section>
      )}

      {/* ── Upcoming ── */}
      {(loadingUpcoming || upcomingMatches.length > 0) && (
        <Section
          icon={<Clock className="w-4 h-4 text-blue-500" />}
          title="Upcoming Matches"
          count={upcomingMatches.length}
          href="/scoring/matches"
          hrefLabel="View all"
        >
          {loadingUpcoming ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2,3].map(i => <div key={i} className="skel h-24 rounded" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingMatches.map((m: any) => <UpcomingCard key={m.id} match={m} />)}
            </div>
          )}
        </Section>
      )}

      {/* ── Recent Results ── */}
      {(loadingCompleted || completedMatches.length > 0) && (
        <Section
          icon={<CheckCircle className="w-4 h-4 text-ink-sub" />}
          title="Recent Results"
          count={completedMatches.length}
          href="/scoring/matches"
          hrefLabel="View all"
        >
          {loadingCompleted ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2,3].map(i => <div key={i} className="skel h-24 rounded" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {completedMatches.map((m: any) => <ResultCard key={m.id} match={m} />)}
            </div>
          )}
        </Section>
      )}

      {/* ── Ongoing Tournaments ── */}
      {ongoingTourneys.length > 0 && (
        <Section
          icon={<Trophy className="w-4 h-4 text-brand-500" />}
          title="Ongoing Tournaments"
          count={ongoingTourneys.length}
          href="/scoring/tournaments"
          hrefLabel="View all"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ongoingTourneys.map((t: any) => <TournamentCard key={t.id} t={t} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

export default function ScoringHome() {
  return <ScoringHomeInner />;
}
