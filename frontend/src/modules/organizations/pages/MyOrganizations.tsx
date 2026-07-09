import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { useAuthStore } from "../../../store/auth";
import { PageHeader, Spinner, EmptyState, Kicker } from "../../../components/UI";
import { Trash2, Pencil, MoreVertical, Plus, Briefcase, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { queryKeys } from "../../../hooks/queryKeys";

export default function MyOrganizations() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = useQuery({
    queryKey: [...queryKeys.myOrganizations(), isAdmin, search],
    queryFn: async () =>
      isAdmin
        ? (await api.get("/organizations", { params: { q: search || undefined, limit: 100 } })).data.items as any[]
        : (await api.get("/organizations/mine")).data.items as any[]
  });

  const deleteOrg = useMutation({
    mutationFn: async (id: string) => api.delete(`/organizations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myOrganizations() });
      setPendingDeleteId(null);
    }
  });

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  function verificationBadge(o: any) {
    const status = o.verification?.status ?? o.verification_status;
    if (status === "approved") return <span className="badge-verified text-[10px]"><span className="tick">✓</span> Verified</span>;
    if (status === "pending") return <span className="badge text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">Pending</span>;
    return null;
  }

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        title={isAdmin ? "All organizations" : "My organizations"}
        subtitle={isAdmin ? "Platform-wide club & academy registry" : "Club & academy profiles"}
        sticky
        action={
          <Link to="/organizations/new" className="hidden sm:inline-flex btn-accent min-h-[44px] items-center gap-1.5">
            <Plus className="h-4 w-4" /> New organization
          </Link>
        }
      />

      {isAdmin && (
        <input
          className="input max-w-xs min-h-[44px]"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {!q.data?.length ? (
        <EmptyState
          title="No organizations yet"
          hint="Create an organization profile to post opportunities and manage applicants."
          action={
            <Link to="/organizations/new" className="btn-accent min-h-[44px] flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Create organization
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data.map((o) => (
            <div key={o.id} className="panel overflow-hidden">
              <div className="h-2 bg-ink" />
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Kicker>{o.org_type}</Kicker>
                      {verificationBadge(o)}
                    </div>
                    <h3 className="font-disp text-xl sm:text-2xl mt-1.5 truncate">{o.org_name}</h3>
                    <div className="lab mt-1 text-[11px]">{[o.city, o.country].filter(Boolean).join(", ")}</div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      data-menu-button
                      onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)}
                      className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === o.id && (
                      <div data-menu-content className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                        <Link
                          to={`/organizations/${o.id}/edit`}
                          onClick={() => setMenuOpenId(null)}
                          className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft min-h-[44px]"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <button
                          onClick={() => { setPendingDeleteId(o.id); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-[12.5px] text-red-600 hover:bg-red-50 min-h-[44px]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {o.description && (
                  <p className="mt-3 text-sm text-ink-sub leading-snug line-clamp-2">{o.description}</p>
                )}

                {o.sport_categories?.length > 0 && (
                  <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
                    {o.sport_categories.slice(0, 4).map((s: string) => (
                      <span key={s} className="badge flex-shrink-0 capitalize">{s}</span>
                    ))}
                    {o.sport_categories.length > 4 && (
                      <span className="badge flex-shrink-0">+{o.sport_categories.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-hairsoft flex items-center gap-3">
                  <Link
                    to={`/opportunities/new?org_id=${o.id}`}
                    className="flex items-center gap-1.5 font-mononum text-[10px] uppercase tracking-[0.08em] text-brand-500 hover:underline min-h-[44px]"
                  >
                    <Briefcase className="h-3.5 w-3.5" /> Post opportunity
                  </Link>
                  <Link
                    to={`/tournaments/new?org_id=${o.id}`}
                    className="flex items-center gap-1.5 font-mononum text-[10px] uppercase tracking-[0.08em] text-brand-500 hover:underline min-h-[44px]"
                  >
                    <Trophy className="h-3.5 w-3.5" /> New tournament
                  </Link>
                  <Link
                    to={`/organizations/${o.id}`}
                    className="ml-auto font-mononum text-[10px] uppercase tracking-[0.08em] text-ink-sub hover:text-ink min-h-[44px] flex items-center"
                  >
                    View profile →
                  </Link>
                </div>

                {pendingDeleteId === o.id && (
                  <div className="mt-4 flex items-center gap-3 rounded bg-red-50 border border-red-200 p-3">
                    <span className="flex-1 text-[12.5px] text-red-900">Delete this organization?</span>
                    <button onClick={() => deleteOrg.mutate(o.id)} disabled={deleteOrg.isPending}
                      className="btn-danger min-h-[44px]">
                      Confirm
                    </button>
                    <button onClick={() => setPendingDeleteId(null)} className="btn-secondary min-h-[44px]">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB — mobile only */}
      <Link
        to="/organizations/new"
        className="sm:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom))] right-4 z-50 h-14 w-14 rounded-full bg-brand-500 text-white shadow-pop flex items-center justify-center"
        aria-label="Create organization"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
