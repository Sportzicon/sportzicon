import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import { Radio, Trophy, Plus } from "lucide-react";
import { PageHeader } from "../../components/UI";

function oversFromBalls(b: number) {
  return `${Math.floor(b / 6)}.${b % 6}`;
}

function LiveMatchCard({ match }: { match: any }) {
  const inn = match.innings ?? [];
  return (
    <Link to={`/scoring/matches/${match.id}`} className="card p-4 hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="lab text-ink-sub">{match.tournament?.name} · {match.format || match.sport}</p>
          <p className="lab text-ink-sub">{match.title || `Match ${match.match_number || ""}`}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-mononum font-medium bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
          <Radio className="w-2.5 h-2.5" /> LIVE
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{match.team1?.short_name || match.team1?.name || "TBD"}</span>
            {inn[0] && <span className="font-mononum text-sm">{inn[0].total_runs}/{inn[0].total_wickets} <span className="text-ink-sub text-xs">({oversFromBalls(inn[0].total_balls)})</span></span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{match.team2?.short_name || match.team2?.name || "TBD"}</span>
            {inn[1] && <span className="font-mononum text-sm">{inn[1].total_runs}/{inn[1].total_wickets} <span className="text-ink-sub text-xs">({oversFromBalls(inn[1].total_balls)})</span></span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function TournamentCard({ t }: { t: any }) {
  return (
    <Link to={`/scoring/tournaments/${t.id}`} className="card p-4 hover:shadow-md transition-shadow flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        {t.logo_url
          ? <img src={t.logo_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
          : <Trophy className="w-5 h-5 text-emerald-600" />
        }
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{t.name}</p>
        <p className="lab text-ink-sub capitalize">{t.sport}{t.format ? ` · ${t.format}` : ""}</p>
        <div className="flex gap-3 mt-0.5">
          <span className="lab text-ink-faint">{t._count?.teams ?? 0} teams</span>
          <span className="lab text-ink-faint">{t._count?.matches ?? 0} matches</span>
        </div>
      </div>
    </Link>
  );
}

function ScoringHomeInner() {
  const user = useAuthStore(s => s.user);

  const { data: liveData } = useQuery({
    queryKey: ["scoring-live"],
    queryFn: () => scoringApi.get("/matches/live").then(r => r.data),
    refetchInterval: 15_000
  });

  const { data: tourData } = useQuery({
    queryKey: ["scoring-tournaments"],
    queryFn: () => scoringApi.get("/tournaments?status=ongoing&limit=6").then(r => r.data)
  });

  const liveMatches = liveData?.matches ?? [];
  const tournaments = tourData?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scoring Console"
        subtitle={`Signed in as ${user?.full_name}`}
        action={
          <div className="flex gap-2">
            <Link to="/scoring/tournaments" className="btn-secondary text-sm">All tournaments</Link>
            <Link to="/scoring/tournaments/new" className="btn-accent text-sm flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> New tournament
            </Link>
          </div>
        }
      />

      {/* Live now */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-red-500" />
          <h2 className="font-disp font-semibold text-base text-ink">Live Now</h2>
          {liveMatches.length > 0 && (
            <span className="font-mononum text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{liveMatches.length}</span>
          )}
        </div>
        {liveMatches.length === 0 ? (
          <div className="panel p-8 text-center text-ink-sub">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No live matches right now</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveMatches.map((m: any) => <LiveMatchCard key={m.id} match={m} />)}
          </div>
        )}
      </section>

      {/* Ongoing tournaments */}
      {tournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <h2 className="font-disp font-semibold text-base text-ink">Ongoing Tournaments</h2>
            </div>
            <Link to="/scoring/tournaments" className="lab text-brand-500 hover:underline">View all →</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tournaments.map((t: any) => <TournamentCard key={t.id} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ScoringHome() {
  return <ScoringHomeInner />;
}
