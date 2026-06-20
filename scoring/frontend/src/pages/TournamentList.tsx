import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Trophy, PlusCircle, MapPin, Calendar, Users, Radio, Clock, CheckCircle } from "lucide-react";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi"];

type TStatus = "all" | "upcoming" | "ongoing" | "completed";

const STATUS_TABS: { value: TStatus; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "ongoing",   label: "Ongoing" },
  { value: "upcoming",  label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

const SECTION_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  ongoing:   { label: "Ongoing",   cls: "bg-red-50 border-red-100 text-red-700",    icon: <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" /> },
  upcoming:  { label: "Upcoming",  cls: "bg-blue-50 border-blue-100 text-blue-700", icon: <Clock className="w-3.5 h-3.5 text-blue-500" /> },
  completed: { label: "Completed", cls: "bg-gray-50 border-gray-200 text-gray-600", icon: <CheckCircle className="w-3.5 h-3.5 text-gray-400" /> },
};

function TournamentCard({ t, highlight }: { t: any; highlight?: boolean }) {
  return (
    <Link
      to={`/tournaments/${t.id}`}
      className={`card p-5 hover:shadow-md transition-shadow group flex flex-col gap-3 ${highlight ? "ring-2 ring-red-200" : ""}`}
    >
      {/* Logo + name */}
      <div className="flex items-start gap-3">
        {t.logo_url ? (
          <img src={t.logo_url} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
            <Trophy className="w-6 h-6 text-emerald-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight line-clamp-2">{t.name}</p>
            <TStatusBadge status={t.status} />
          </div>
          <p className="text-xs text-gray-400 capitalize mt-1">
            {t.sport}{t.format ? ` · ${t.format}` : ""}{t.season ? ` · ${t.season}` : ""}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t._count?.teams ?? 0} teams</span>
        <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{t._count?.matches ?? 0} matches</span>
        {t.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.location}</span>}
        {(t.start_date || t.end_date) && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {t.start_date}{t.end_date ? ` – ${t.end_date}` : ""}
          </span>
        )}
      </div>
    </Link>
  );
}

function TStatusBadge({ status }: { status: string }) {
  if (status === "ongoing")  return <span className="badge-live shrink-0 flex items-center gap-1"><Radio className="w-2.5 h-2.5 animate-pulse" />Live</span>;
  if (status === "upcoming") return <span className="badge-upcoming shrink-0">Upcoming</span>;
  if (status === "completed") return <span className="badge-completed shrink-0">Done</span>;
  return <span className="badge bg-gray-100 text-gray-500 capitalize shrink-0">{status}</span>;
}

export default function TournamentList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(s => s.user);
  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);

  const statusParam = (searchParams.get("status") || "all") as TStatus;
  const sport       = searchParams.get("sport") || "";

  function setFilter(k: "status" | "sport", v: string) {
    const next = new URLSearchParams(searchParams);
    if (!v || (k === "status" && v === "all")) next.delete(k); else next.set(k, v);
    setSearchParams(next, { replace: true });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments", statusParam, sport],
    queryFn: () =>
      api.get("/tournaments", {
        params: {
          ...(statusParam !== "all" && { status: statusParam }),
          ...(sport && { sport }),
          limit: 200
        }
      }).then(r => r.data),
    refetchInterval: 30_000
  });

  const items: any[] = data?.items ?? [];

  // Count by status from live data (for tab badges)
  const countOf = (s: TStatus) => s === "all" ? items.length : items.filter(t => t.status === s).length;

  const ongoingItems   = items.filter(t => t.status === "ongoing");
  const upcomingItems  = items.filter(t => t.status === "upcoming");
  const completedItems = items.filter(t => t.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          {ongoingItems.length > 0 && (
            <p className="text-sm text-red-600 flex items-center gap-1.5 mt-0.5 font-medium">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {ongoingItems.length} tournament{ongoingItems.length > 1 ? "s" : ""} ongoing now
            </p>
          )}
        </div>
        {canManage && (
          <Link to="/tournaments/new" className="btn-primary shrink-0">
            <PlusCircle className="w-4 h-4" /> New
          </Link>
        )}
      </div>

      {/* Status tabs */}
      <div className="border-b border-gray-200 flex gap-0 overflow-x-auto scrollbar-none">
        {STATUS_TABS.map(tab => {
          const count = countOf(tab.value);
          return (
            <button
              key={tab.value}
              onClick={() => setFilter("status", tab.value)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                statusParam === tab.value
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.value === "ongoing" && ongoingItems.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
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
              onClick={() => setFilter("sport", s)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${
                sport === s ? "bg-emerald-100 text-emerald-700" : "text-gray-500 hover:bg-gray-100"
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
          {[1,2,3,4,5,6].map(i => <div key={i} className="card p-5 h-32 animate-pulse bg-gray-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No tournaments found</p>
          {canManage && (
            <Link to="/tournaments/new" className="btn-primary mt-4 mx-auto">
              <PlusCircle className="w-4 h-4" /> Create First Tournament
            </Link>
          )}
        </div>
      ) : statusParam === "all" ? (
        /* Grouped view */
        <div className="space-y-8">
          {ongoingItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-red-50 border border-red-100 border-b-0">
                <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-700">Ongoing Now</span>
                <span className="ml-auto text-xs bg-white/60 text-red-600 rounded-full px-2 py-0.5">{ongoingItems.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ongoingItems.map(t => <TournamentCard key={t.id} t={t} highlight />)}
              </div>
            </div>
          )}
          {upcomingItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-blue-50 border border-blue-100 border-b-0">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm font-semibold text-blue-700">Upcoming</span>
                <span className="ml-auto text-xs bg-white/60 text-blue-600 rounded-full px-2 py-0.5">{upcomingItems.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingItems.map(t => <TournamentCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
          {completedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-gray-50 border border-gray-200 border-b-0">
                <CheckCircle className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">Completed</span>
                <span className="ml-auto text-xs bg-white/60 text-gray-500 rounded-full px-2 py-0.5">{completedItems.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedItems.map(t => <TournamentCard key={t.id} t={t} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Flat filtered list */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(t => <TournamentCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
