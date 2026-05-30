import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, EmptyState, Kicker } from "../components/UI";
import { Trash2, Pencil, MoreVertical, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function MyOrganizations() {
  const qc = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["my-orgs"],
    queryFn: async () => (await api.get("/organizations/mine")).data.items as any[]
  });

  const deleteOrg = useMutation({
    mutationFn: async (id: string) => api.delete(`/organizations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-orgs"] }); setPendingDeleteId(null); }
  });

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My organizations"
        subtitle="Club & academy profiles"
        action={<Link to="/organizations/new" className="btn-accent">+ New organization</Link>}
      />

      {!q.data?.length ? (
        <EmptyState
          title="No organizations yet"
          hint="Create an organization profile to post opportunities and manage applicants."
          action={<Link to="/organizations/new" className="btn-accent">Create organization</Link>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data.map((o) => (
            <div key={o.id} className="panel overflow-hidden">
              <div className="h-2 bg-ink" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Kicker>{o.org_type}</Kicker>
                      {o.verification?.status === "approved" && (
                        <span className="badge-verified"><span className="tick">✓</span> Verified</span>
                      )}
                    </div>
                    <h3 className="font-disp text-2xl mt-1.5">{o.org_name}</h3>
                    <div className="lab mt-1">{o.city}{o.country ? `, ${o.country}` : ""}</div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      data-menu-button
                      onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)}
                      className="btn-ghost p-2"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === o.id && (
                      <div data-menu-content className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                        <Link
                          to={`/organizations/${o.id}/edit`}
                          onClick={() => setMenuOpenId(null)}
                          className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <button
                          onClick={() => { setPendingDeleteId(o.id); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50"
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
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {o.sport_categories.map((s: string) => <span key={s} className="badge">{s}</span>)}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-hairsoft flex items-center justify-between">
                  <Link to={`/opportunities/new`} className="font-mononum text-[10px] uppercase tracking-[0.08em] text-brand-500 hover:underline">
                    + Post opportunity
                  </Link>
                  <Link to={`/organizations/${o.id}`} className="font-mononum text-[10px] uppercase tracking-[0.08em] text-ink-sub hover:text-ink">
                    View profile →
                  </Link>
                </div>

                {pendingDeleteId === o.id && (
                  <div className="mt-4 flex items-center gap-3 rounded bg-red-50 border border-red-200 p-3">
                    <span className="flex-1 text-[12.5px] text-red-900">Delete this organization?</span>
                    <button onClick={() => deleteOrg.mutate(o.id)} disabled={deleteOrg.isPending} className="btn-danger">Confirm</button>
                    <button onClick={() => setPendingDeleteId(null)} className="btn-secondary">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
