import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { api } from "../../api/client";
import { queryKeys } from "../../hooks/queryKeys";
import { useAuthStore } from "../../store/auth";
import { hasRole } from "../../utils/roles";
import { Trophy, Plus, MapPin, Calendar, Users, Radio, Clock, CheckCircle, Link2, ArrowRight } from "lucide-react";
import { PageHeader } from "../../components/UI";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi"];
type TStatus = "all" | "ongoing" | "upcoming" | "completed";

const TABS: { value: TStatus; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "ongoing",   label: "Ongoing" },
  { value: "upcoming",  label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "ongoing")  return (
    <span className="inline-flex items-center gap-1 lab px-2 py-0.5 rounded-full bg-red-100 text-red-600">
      <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
    </span>
  );
  if (status === "upcoming")  return <span className="lab px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Upcoming</span>;
  if (status === "completed") return <span className="lab px-2 py-0.5 rounded-full bg-fill2 text-ink-sub">Completed</span>;
  return <span className="lab px-2 py-0.5 rounded-full bg-fill text-ink-sub capitalize">{status}</span>;
}

// Scoring tournament card (full management)
function ScoringTournamentCard({ t, highlight }: { t: any; highlight?: boolean }) {
  return (
    <Link
      to={`/scoring/tournaments/${t.id}`}
      className={`card p-5 hover:shadow-md transition-shadow flex flex-col gap-3 ${highlight ? "ring-2 ring-red-200" : ""}`}
    >
      <div className="flex items-start gap-3">
        {t.logo_url ? (
          <img src={t.logo_url} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-emerald-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink leading-tight line-clamp-2">{t.name}</p>
            <StatusBadge status={t.status} />
          </div>
          <p className="lab text-ink-sub capitalize mt-1">
            {t.sport}{t.format ? ` · ${t.format}` : ""}{t.season ? ` · ${t.season}` : ""}
          </p>
          {t.opportunity_id && (
            <span className="inline-flex items-center gap-1 lab text-brand-500 mt-0.5 text-[10px]">
              <Link2 className="w-2.5 h-2.5" /> Linked to tournament post
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="lab text-ink-faint flex items-center gap-1"><Users className="w-3 h-3" />{t._count?.teams ?? 0} teams</span>
        <span className="lab text-ink-faint flex items-center gap-1"><Trophy className="w-3 h-3" />{t._count?.matches ?? 0} matches</span>
        {t.location && <span className="lab text-ink-faint flex items-center gap-1"><MapPin className="w-3 h-3" />{t.location}</span>}
        {(t.start_date || t.end_date) && (
          <span className="lab text-ink-faint flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {t.start_date}{t.end_date ? ` – ${t.end_date}` : ""}
          </span>
        )}
      </div>
    </Link>
  );
}

// Opportunity-sourced tournament card (not yet set up in scoring)
function OpportunityTournamentCard({ opp, canManage }: { opp: any; canManage: boolean }) {
  const setupUrl = `/scoring/tournaments/new?opportunity_id=${opp.id}&name=${encodeURIComponent(opp.title)}&sport=${opp.sport}`;
  return (
    <div className="card p-5 flex flex-col gap-3 border-dashed border-2 border-hair">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Trophy className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink leading-tight line-clamp-2">{opp.title}</p>
            <span className="lab px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">Not set up</span>
          </div>
          <p className="lab text-ink-sub capitalize mt-1">{opp.sport}</p>
          <span className="inline-flex items-center gap-1 lab text-ink-faint mt-0.5 text-[10px]">
            <Link2 className="w-2.5 h-2.5" /> From tournament post · {opp.application_count ?? 0} applications
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {opp.city && <span className="lab text-ink-faint flex items-center gap-1"><MapPin className="w-3 h-3" />{opp.city}</span>}
        {opp.start_date && <span className="lab text-ink-faint flex items-center gap-1"><Calendar className="w-3 h-3" />{opp.start_date}{opp.end_date ? ` – ${opp.end_date}` : ""}</span>}
        {opp.application_deadline && <span className="lab text-ink-faint">Apply by {opp.application_deadline}</span>}
      </div>
      {canManage && (
        <Link to={setupUrl} className="btn-accent text-sm flex items-center gap-1 justify-center">
          <Radio className="w-3.5 h-3.5" /> Set up scoring <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function ScoringTournamentsInner() {
  const user = useAuthStore(s => s.user);
  const canManage = hasRole(user?.role ?? "", "organizer", "scorer");
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = (searchParams.get("status") || "all") as TStatus;
  const sport       = searchParams.get("sport") || "";

  function setFilter(k: "status" | "sport", v: string) {
    const next = new URLSearchParams(searchParams);
    if (!v || (k === "status" && v === "all")) next.delete(k); else next.set(k, v);
    setSearchParams(next, { replace: true });
  }

  // Scoring tournaments from scoring backend
  const { data: scoringData, isLoading: loadingScoring } = useQuery({
    queryKey: queryKeys.scoringTournaments({ sport, status: statusParam !== "all" ? statusParam : "" }),
    queryFn: () =>
      scoringApi.get("/tournaments", {
        params: {
          ...(statusParam !== "all" && { status: statusParam }),
          ...(sport && { sport }),
          limit: 200
        }
      }).then(r => r.data),
    refetchInterval: 30_000
  });

  // Main app tournament opportunities (type=tournament) — only in "all" / "upcoming" tabs
  const { data: oppData } = useQuery({
    queryKey: queryKeys.opportunities({ type: "tournament", status: "open", ...(sport ? { sport } : {}) }),
    queryFn: () =>
      api.get("/opportunities", {
        params: { type: "tournament", status: "open", ...(sport ? { sport } : {}), limit: 100 }
      }).then(r => r.data.data ?? []),
    enabled: statusParam === "all" || statusParam === "upcoming",
    staleTime: 60_000
  });

  const scoringItems: any[] = scoringData?.items ?? [];
  const oppItems: any[] = oppData ?? [];

  // Opportunities that don't yet have a scoring tournament set up
  const linkedOpportunityIds = new Set(scoringItems.map((t: any) => t.opportunity_id).filter(Boolean));
  const unlinkedOpps = oppItems.filter((o: any) => !linkedOpportunityIds.has(o.id));

  const ongoingItems   = scoringItems.filter(t => t.status === "ongoing");
  const upcomingItems  = scoringItems.filter(t => t.status === "upcoming");
  const completedItems = scoringItems.filter(t => t.status === "completed");

  const totalCount = scoringItems.length + (statusParam === "all" || statusParam === "upcoming" ? unlinkedOpps.length : 0);
  const countOf = (s: TStatus) => {
    if (s === "all") return totalCount;
    if (s === "ongoing")  return ongoingItems.length;
    if (s === "upcoming") return upcomingItems.length + unlinkedOpps.length;
    return scoringItems.filter(t => t.status === s).length;
  };

  const isLoading = loadingScoring;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tournaments"
        subtitle={ongoingItems.length > 0 ? `${ongoingItems.length} tournament${ongoingItems.length > 1 ? "s" : ""} ongoing now` : "All tournaments — scoring & upcoming"}
        action={canManage && (
          <Link to="/scoring/tournaments/new" className="btn-accent text-sm flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New tournament
          </Link>
        )}
      />

      {/* Status tabs */}
      <div className="flex gap-0 border-b border-hair overflow-x-auto scrollbar-none">
        {TABS.map(tab => {
          const count = countOf(tab.value);
          return (
            <button
              key={tab.value}
              onClick={() => setFilter("status", tab.value)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 lab transition-colors border-b-2 -mb-px ${
                statusParam === tab.value
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-ink-sub hover:text-ink"
              }`}
            >
              {tab.value === "ongoing" && ongoingItems.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                  statusParam === tab.value ? "bg-brand-100 text-brand-600" : "bg-fill text-ink-faint"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sport filter chips */}
      <div className="flex items-center gap-2">
        <span className="lab text-ink-faint shrink-0">Sport:</span>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {["", ...SPORTS].map(s => (
            <button
              key={s || "all"}
              onClick={() => setFilter("sport", s)}
              className={`shrink-0 px-2.5 py-1 rounded-md lab capitalize transition ${
                sport === s ? "bg-brand-100 text-brand-600" : "text-ink-sub hover:bg-fill"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card p-5 h-32 animate-pulse bg-fill" />)}
        </div>
      ) : totalCount === 0 ? (
        <div className="card p-12 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-ink-faint opacity-30" />
          <p className="font-disp text-xl text-ink">No tournaments found</p>
          <p className="lab text-ink-faint mt-1">
            {statusParam !== "all" ? `No ${statusParam} tournaments` : "Create your first tournament or post one from the main app."}
          </p>
          {canManage && (
            <div className="flex gap-3 justify-center mt-4 flex-wrap">
              <Link to="/scoring/tournaments/new" className="btn-accent flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Create Tournament
              </Link>
              <Link to="/tournaments/new" className="btn-secondary flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Post Tournament Opportunity
              </Link>
            </div>
          )}
        </div>
      ) : statusParam === "all" ? (
        /* Grouped view */
        <div className="space-y-8">
          {/* Ongoing scoring tournaments */}
          {ongoingItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-red-50 border border-red-100 border-b-0">
                <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span className="lab font-semibold text-red-700">Ongoing Now</span>
                <span className="ml-auto lab text-red-400 bg-white/60 rounded-full px-2 py-0.5">{ongoingItems.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ongoingItems.map(t => <ScoringTournamentCard key={t.id} t={t} highlight />)}
              </div>
            </div>
          )}

          {/* Upcoming scoring + unlinked opportunities */}
          {(upcomingItems.length > 0 || unlinkedOpps.length > 0) && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-blue-50 border border-blue-100 border-b-0">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="lab font-semibold text-blue-700">Upcoming</span>
                <span className="ml-auto lab text-blue-400 bg-white/60 rounded-full px-2 py-0.5">
                  {upcomingItems.length + unlinkedOpps.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingItems.map(t => <ScoringTournamentCard key={t.id} t={t} />)}
                {unlinkedOpps.map(o => <OpportunityTournamentCard key={o.id} opp={o} canManage={canManage} />)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-fill border border-hair border-b-0">
                <CheckCircle className="w-3.5 h-3.5 text-ink-faint" />
                <span className="lab font-semibold text-ink-sub">Completed</span>
                <span className="ml-auto lab text-ink-faint bg-white/60 rounded-full px-2 py-0.5">{completedItems.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedItems.map(t => <ScoringTournamentCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
        </div>
      ) : statusParam === "upcoming" ? (
        /* Upcoming: scoring + unlinked opps */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingItems.map(t => <ScoringTournamentCard key={t.id} t={t} />)}
          {unlinkedOpps.map(o => <OpportunityTournamentCard key={o.id} opp={o} canManage={canManage} />)}
        </div>
      ) : (
        /* Other filtered tabs */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scoringItems.map(t => <ScoringTournamentCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}

export default function ScoringTournaments() {
  return <ScoringTournamentsInner />;
}
