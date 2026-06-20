import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import {
  Radio, Trophy, Clock, CheckCircle, ArrowRight,
  MapPin, Calendar, PlusCircle, Users
} from "lucide-react";

function ov(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

// ── Live match card ────────────────────────────────────────────────────────────
function LiveMatchCard({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const teamOf = (inn: any) => inn?.batting_team_id === match.team1?.id ? match.team1 : match.team2;

  return (
    <Link to={`/matches/${match.id}`} className="card hover:shadow-md transition-shadow block overflow-hidden">
      {/* Tournament strip */}
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
        <Trophy className="w-3 h-3 text-red-400 shrink-0" />
        <span className="text-xs text-red-600 truncate font-medium">{match.tournament?.name}</span>
        {match.format && <span className="text-xs text-red-400 shrink-0">· {match.format}</span>}
        <span className="ml-auto badge-live flex items-center gap-1 shrink-0 text-xs">
          <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
        </span>
      </div>

      <div className="p-4 space-y-2.5">
        {/* Innings rows */}
        {(inn1 || inn2) ? (
          [inn1, inn2].filter(Boolean).map((inn: any) => {
            const team = teamOf(inn);
            const isBatting = !inn.is_completed;
            return (
              <div key={inn.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {team?.logo_url && <img src={team.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
                  <span className={`text-sm font-semibold truncate ${isBatting ? "text-gray-900" : "text-gray-400"}`}>
                    {team?.short_name || team?.name || "TBD"}
                  </span>
                  {isBatting && <span className="text-xs text-red-500 font-medium shrink-0">batting</span>}
                </div>
                <span className={`font-mono font-bold whitespace-nowrap shrink-0 ${isBatting ? "text-gray-900 text-base" : "text-gray-400 text-sm"}`}>
                  {inn.total_runs}/{inn.total_wickets}
                  <span className="text-xs font-normal text-gray-400 ml-0.5">({ov(inn.total_balls)})</span>
                </span>
              </div>
            );
          })
        ) : (
          <>
            <div className="flex items-center gap-2">
              {match.team1?.logo_url && <img src={match.team1.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
              <span className="font-semibold text-sm">{match.team1?.name || "TBD"}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.team2?.logo_url && <img src={match.team2.logo_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
              <span className="font-semibold text-sm">{match.team2?.name || "TBD"}</span>
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
          {match.venue && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{match.venue}</span>}
          <span className="ml-auto text-emerald-600 font-medium flex items-center gap-0.5 shrink-0">
            Scorecard <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Upcoming match card ────────────────────────────────────────────────────────
function UpcomingMatchCard({ match }: { match: any }) {
  const scheduled = match.scheduled_at ? new Date(match.scheduled_at) : null;
  const now = new Date(); now.setHours(0,0,0,0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const matchDay = scheduled ? new Date(scheduled) : null;
  if (matchDay) matchDay.setHours(0,0,0,0);

  const dayLabel = matchDay?.getTime() === now.getTime() ? "Today"
    : matchDay?.getTime() === tomorrow.getTime() ? "Tomorrow"
    : scheduled?.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) ?? "";

  return (
    <Link to={`/matches/${match.id}`} className="card p-4 hover:shadow-md transition-shadow block">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs text-gray-400 truncate">{match.tournament?.name}</span>
        <span className="badge-upcoming flex items-center gap-1 shrink-0 text-xs">
          <Clock className="w-3 h-3" /> Upcoming
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        {match.team1?.logo_url && <img src={match.team1.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
        <span className="font-semibold text-sm">{match.team1?.short_name || match.team1?.name || "TBD"}</span>
        <span className="text-gray-300 text-xs mx-1">vs</span>
        {match.team2?.logo_url && <img src={match.team2.logo_url} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />}
        <span className="font-semibold text-sm">{match.team2?.short_name || match.team2?.name || "TBD"}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        {scheduled && (
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            <Calendar className="w-3 h-3" />
            {dayLabel} · {scheduled.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {match.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.venue}</span>}
      </div>
    </Link>
  );
}

// ── Recent result card ─────────────────────────────────────────────────────────
function RecentResultCard({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.batting_team_id === match.team1?.id);
  const inn2 = match.innings?.find((i: any) => i.batting_team_id === match.team2?.id);
  const team1Wins = match.winner_team_id === match.team1?.id;
  const team2Wins = match.winner_team_id === match.team2?.id;

  return (
    <Link to={`/matches/${match.id}`} className="card p-4 hover:shadow-md transition-shadow block">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs text-gray-400 truncate">{match.tournament?.name}</span>
        <span className="badge-completed flex items-center gap-1 shrink-0 text-xs">
          <CheckCircle className="w-3 h-3" /> Final
        </span>
      </div>

      <div className="space-y-1.5">
        {[
          { team: match.team1, inn: inn1, wins: team1Wins },
          { team: match.team2, inn: inn2, wins: team2Wins }
        ].map(({ team, inn, wins }) => (
          <div key={team?.id} className={`flex items-center gap-2 ${wins ? "font-bold" : "opacity-70"}`}>
            {team?.logo_url && <img src={team.logo_url} className="w-4 h-4 rounded-full object-cover shrink-0" alt="" />}
            <span className="text-sm flex-1 truncate">{team?.short_name || team?.name || "TBD"}</span>
            {wins && <span className="text-xs text-emerald-600 font-semibold shrink-0">WON</span>}
            {inn && (
              <span className="text-sm font-mono text-gray-700 shrink-0">
                {inn.total_runs}/{inn.total_wickets}
                <span className="text-gray-400 text-xs ml-0.5">({ov(inn.total_balls)})</span>
              </span>
            )}
          </div>
        ))}
      </div>

      {match.result_summary && (
        <p className="text-xs text-emerald-600 font-medium mt-2 pt-2 border-t border-gray-100">
          {match.result_summary}
        </p>
      )}
    </Link>
  );
}

// ── Tournament card ────────────────────────────────────────────────────────────
function TournamentCard({ t }: { t: any }) {
  return (
    <Link to={`/tournaments/${t.id}`} className="card p-4 hover:shadow-md transition-shadow flex items-start gap-3">
      {t.logo_url ? (
        <img src={t.logo_url} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-emerald-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight line-clamp-2">{t.name}</p>
        <p className="text-xs text-gray-400 capitalize mt-0.5">{t.sport}{t.format ? ` · ${t.format}` : ""}</p>
        <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t._count?.teams ?? 0}</span>
          <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{t._count?.matches ?? 0} matches</span>
        </div>
      </div>
      <span className="badge-live text-xs shrink-0 mt-0.5">LIVE</span>
    </Link>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon, title, count, viewAllHref
}: { icon: React.ReactNode; title: string; count?: number; viewAllHref: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-lg">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="bg-gray-100 text-gray-500 text-xs rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      <Link
        to={viewAllHref}
        className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"
      >
        View all <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const user = useAuthStore(s => s.user);
  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);

  const { data: liveData, isLoading: loadingLive } = useQuery({
    queryKey: ["live-matches"],
    queryFn: () => api.get("/matches/live").then(r => r.data),
    refetchInterval: 10_000
  });

  const { data: upcomingData } = useQuery({
    queryKey: ["matches-upcoming"],
    queryFn: () => api.get("/matches", { params: { status: "upcoming", limit: 6 } }).then(r => r.data)
  });

  const { data: completedData } = useQuery({
    queryKey: ["matches-completed"],
    queryFn: () => api.get("/matches", { params: { status: "completed", limit: 6 } }).then(r => r.data)
  });

  const { data: tournamentsData } = useQuery({
    queryKey: ["tournaments-home"],
    queryFn: () => api.get("/tournaments", { params: { status: "ongoing", limit: 6 } }).then(r => r.data),
    refetchInterval: 30_000
  });

  const liveMatches     = liveData?.matches      ?? [];
  const upcomingMatches = upcomingData?.matches   ?? [];
  const completedMatches = completedData?.matches ?? [];
  const ongoingTournaments = tournamentsData?.items ?? [];

  const isEmpty = !loadingLive && liveMatches.length === 0 && upcomingMatches.length === 0 && completedMatches.length === 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-emerald-200 text-sm font-medium uppercase tracking-wider mb-1">ScoreBoard</p>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Live Scores</h1>
            <p className="text-emerald-100 text-sm">Real-time scoring for local tournaments — cricket, football & more.</p>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <Link
                to="/matches"
                className="inline-flex items-center gap-2 bg-white text-emerald-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-50 transition"
              >
                All Matches <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/tournaments"
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                Tournaments
              </Link>
            </div>
          </div>
          {canManage && (
            <Link
              to="/tournaments/new"
              className="shrink-0 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Tournament</span>
            </Link>
          )}
        </div>

        {/* Live pulse strip */}
        {liveMatches.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm text-emerald-100 font-medium">
              {liveMatches.length} match{liveMatches.length > 1 ? "es" : ""} live right now
            </span>
            <Link to="/matches?status=live" className="ml-auto text-xs text-emerald-200 hover:text-white flex items-center gap-1">
              Watch <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="card p-12 text-center text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No matches yet</p>
          {canManage ? (
            <Link to="/tournaments/new" className="btn-primary mt-4 mx-auto">
              <PlusCircle className="w-4 h-4" /> Create a Tournament
            </Link>
          ) : (
            <p className="text-sm mt-1">Check back later for live scores.</p>
          )}
        </div>
      )}

      {/* Live matches */}
      {(loadingLive || liveMatches.length > 0) && (
        <section>
          <SectionHeader
            icon={<Radio className="w-4 h-4 text-red-500 animate-pulse" />}
            title="Live Now"
            count={liveMatches.length}
            viewAllHref="/matches?status=live"
          />
          {loadingLive ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2].map(i => <div key={i} className="card p-4 h-32 animate-pulse bg-gray-100" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveMatches.map((m: any) => <LiveMatchCard key={m.id} match={m} />)}
            </div>
          )}
        </section>
      )}

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <SectionHeader
            icon={<Clock className="w-4 h-4 text-blue-500" />}
            title="Upcoming Matches"
            count={upcomingMatches.length}
            viewAllHref="/matches?status=upcoming"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingMatches.map((m: any) => <UpcomingMatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {/* Recent results */}
      {completedMatches.length > 0 && (
        <section>
          <SectionHeader
            icon={<CheckCircle className="w-4 h-4 text-gray-400" />}
            title="Recent Results"
            count={completedMatches.length}
            viewAllHref="/matches?status=completed"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedMatches.map((m: any) => <RecentResultCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {/* Ongoing tournaments */}
      {ongoingTournaments.length > 0 && (
        <section>
          <SectionHeader
            icon={<Trophy className="w-4 h-4 text-emerald-600" />}
            title="Ongoing Tournaments"
            count={ongoingTournaments.length}
            viewAllHref="/tournaments?status=ongoing"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ongoingTournaments.map((t: any) => <TournamentCard key={t.id} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
