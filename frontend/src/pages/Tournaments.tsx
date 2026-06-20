import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hasRole } from "../utils/roles";
import { api } from "../api/client";
import { queryKeys } from "../hooks/queryKeys";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, EmptyState, StatusPill, Kicker, Pagination } from "../components/UI";

const PAGE_SIZE = 10;
import { Trash2, Pencil, MoreVertical, Radio, Link2 } from "lucide-react";
import type { Opportunity } from "../types";

export default function Tournaments() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("open");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [sport, status]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const params: any = { status, type: "tournament" };
  if (sport) params.sport = sport;

  const q = useQuery({
    queryKey: queryKeys.tournaments(params),
    queryFn: async () => (await api.get<{ data: Opportunity[] }>("/opportunities", { params })).data.data
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => api.delete(`/opportunities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.tournaments() }); setPendingDeleteId(null); }
  });

  const canPost = hasRole(user?.role ?? "", "club", "organizer");
  const isOrganizer = hasRole(user?.role ?? "", "organizer");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tournaments"
        subtitle="Competitive events"
        action={
          <div className="flex gap-2">
            {isOrganizer && (
              <Link to="/scoring" className="btn-secondary flex items-center gap-1">
                🎯 Scoring Console
              </Link>
            )}
            {canPost && <Link to="/tournaments/new" className="btn-accent">+ Post tournament</Link>}
          </div>
        }
      />

      <div className="panel p-4 flex flex-wrap gap-3">
        <input className="input w-44" placeholder="Sport" value={sport} onChange={(e) => setSport(e.target.value)} />
        <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="filled">Filled</option>
        </select>
      </div>

      {q.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : !q.data?.length ? (
        <EmptyState title="No tournaments" hint="Check back later or post your own tournament." action={canPost ? <Link to="/tournaments/new" className="btn-accent">+ Post tournament</Link> : undefined} />
      ) : (
        <>
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o) => {
            const isPoster = user?.id === o.posted_by_user_id;
            return (
              <div key={o.id} className="panel overflow-hidden">
                <Link to={`/opportunities/${o.id}`} className="block p-5 hover:bg-fill transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Kicker>Tournament · {o.sport}</Kicker>
                      <h3 className="font-disp text-xl mt-1.5 leading-tight">{o.title}</h3>
                      <div className="lab mt-1">{o.org_name} · {o.city}, {o.country}</div>
                    </div>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-hairsoft pt-3">
                    <div><div className="lab">Age</div><div className="font-mononum text-sm text-ink mt-0.5">{o.age_min}–{o.age_max}</div></div>
                    <div><div className="lab">Deadline</div><div className="font-mononum text-sm text-ink mt-0.5">{o.application_deadline}</div></div>
                    <div><div className="lab">Registered</div><div className="font-mononum text-sm text-ink mt-0.5">{o.application_count}</div></div>
                  </div>
                </Link>

                {/* Scoring integration */}
                <div className="px-5 pb-3 pt-3 border-t border-hairsoft flex items-center gap-2 flex-wrap">
                  {(o as any).scoring_tournament_id ? (
                    <Link
                      to={`/scoring/tournaments/${(o as any).scoring_tournament_id}`}
                      className="btn-secondary text-xs min-h-0 px-3 py-1.5 flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Radio className="w-3 h-3" /> Live Scoring
                    </Link>
                  ) : hasRole(user?.role ?? "", "organizer", "scorer") ? (
                    <Link
                      to={`/scoring/tournaments/new?opportunity_id=${o.id}`}
                      className="btn-secondary text-xs min-h-0 px-3 py-1.5 flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" /> Set up scoring
                    </Link>
                  ) : null}
                </div>

                {isPoster && (
                  <div className="px-5 pb-4 flex justify-end relative border-t border-hairsoft pt-3">
                    <button data-menu-button onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)} className="btn-ghost p-2">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === o.id && (
                      <div data-menu-content className="absolute right-4 bottom-12 panel shadow-pop z-10 min-w-36">
                        <Link to={`/tournaments/${o.id}/edit`} onClick={() => setMenuOpenId(null)}
                          className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <button onClick={() => { setPendingDeleteId(o.id); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                    {pendingDeleteId === o.id && (
                      <div className="absolute right-4 bottom-14 panel shadow-pop z-10 p-3 flex items-center gap-2 min-w-52">
                        <span className="text-[12.5px] text-ink flex-1">Delete this tournament?</span>
                        <button onClick={() => deleteOpp.mutate(o.id)} disabled={deleteOpp.isPending} className="btn-danger">Confirm</button>
                        <button onClick={() => setPendingDeleteId(null)} className="btn-secondary">Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Pagination page={page} total={q.data.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  );
}
