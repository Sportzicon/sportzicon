import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Trophy, PlusCircle, Filter } from "lucide-react";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi"];
const STATUSES = ["upcoming", "ongoing", "completed"];

export default function TournamentList() {
  const [params, setParams] = useSearchParams();
  const user = useAuthStore(s => s.user);
  const canManage = user && ["club", "organizer", "admin"].includes(user.role);

  const sport = params.get("sport") || "";
  const status = params.get("status") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments", sport, status],
    queryFn: () => api.get(`/scoring/tournaments?${new URLSearchParams({ ...(sport && { sport }), ...(status && { status }) })}`).then(r => r.data)
  });

  const items = data?.items ?? [];

  function setFilter(k: string, v: string) {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        {canManage && (
          <Link to="/scoring/tournaments/new" className="btn-primary">
            <PlusCircle className="w-4 h-4" /> New Tournament
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className="input w-auto text-sm py-1.5" value={sport} onChange={e => setFilter("sport", e.target.value)}>
            <option value="">All Sports</option>
            {SPORTS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select className="input w-auto text-sm py-1.5" value={status} onChange={e => setFilter("status", e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card p-5 h-32 animate-pulse bg-gray-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No tournaments found</p>
          {canManage && <p className="text-sm mt-1">Create the first one!</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t: any) => (
            <Link key={t.id} to={`/scoring/tournaments/${t.id}`} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                {t.logo_url ? (
                  <img src={t.logo_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <Trophy className="w-6 h-6 text-emerald-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{t.sport}{t.format ? ` · ${t.format}` : ""}</p>
                </div>
              </div>
              {t.location && <p className="text-xs text-gray-400 mb-2 truncate">📍 {t.location}</p>}
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{t._count.teams} teams</span>
                  <span>{t._count.matches} matches</span>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ongoing") return <span className="badge-live">LIVE</span>;
  if (status === "upcoming") return <span className="badge-upcoming">Upcoming</span>;
  if (status === "completed") return <span className="badge-completed">Completed</span>;
  return <span className="badge bg-gray-100 text-gray-500 capitalize">{status}</span>;
}
