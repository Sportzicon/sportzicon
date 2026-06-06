import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import { Trophy, Plus, Filter } from "lucide-react";
import { PageHeader, EmptyState } from "../../components/UI";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi"];
const STATUSES = ["upcoming", "ongoing", "completed"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ongoing: "bg-red-100 text-red-600",
    upcoming: "bg-amber-100 text-amber-700",
    completed: "bg-slate-100 text-slate-600"
  };
  return (
    <span className={`inline-block font-mononum text-[10px] px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.toUpperCase()}
    </span>
  );
}

function ScoringTournamentsInner() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === "organizer" || user?.role === "admin" || user?.role === "scorer";
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["scoring-tournaments", sport, status],
    queryFn: () => scoringApi.get(`/tournaments?${new URLSearchParams({ ...(sport && { sport }), ...(status && { status }) })}`).then(r => r.data)
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tournaments"
        subtitle="Cricket & multi-sport scoring"
        action={canManage && (
          <Link to="/scoring/tournaments/new" className="btn-accent text-sm flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New tournament
          </Link>
        )}
      />

      <div className="panel p-3 flex gap-3 flex-wrap items-center">
        <Filter className="w-4 h-4 text-ink-faint" />
        <select className="input text-sm py-1.5 w-auto" value={sport} onChange={e => setSport(e.target.value)}>
          <option value="">All Sports</option>
          {SPORTS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="input text-sm py-1.5 w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card p-5 h-32 animate-pulse bg-fill" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No tournaments found" hint="Create the first one!" action={canManage && <Link to="/scoring/tournaments/new" className="btn-accent text-sm">New tournament</Link>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t: any) => (
            <Link key={t.id} to={`/scoring/tournaments/${t.id}`} className="card p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  {t.logo_url
                    ? <img src={t.logo_url} className="w-11 h-11 rounded-xl object-cover" alt="" />
                    : <Trophy className="w-6 h-6 text-emerald-600" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{t.name}</p>
                  <p className="lab text-ink-sub capitalize">{t.sport}{t.format ? ` · ${t.format}` : ""}</p>
                </div>
              </div>
              {t.location && <p className="lab text-ink-faint mb-2 truncate">📍 {t.location}</p>}
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <span className="lab text-ink-faint">{t._count?.teams ?? 0} teams</span>
                  <span className="lab text-ink-faint">{t._count?.matches ?? 0} matches</span>
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

export default function ScoringTournaments() {
  return <ScoringTournamentsInner />;
}
