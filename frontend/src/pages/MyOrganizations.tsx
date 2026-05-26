import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, VerifiedBadge } from "../components/UI";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
import { useState, useEffect } from "react";

export default function MyOrganizations() {
  const qc = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-menu-button]') && !target.closest('[data-menu-content]')) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["my-orgs"],
    queryFn: async () => (await api.get("/organizations/mine")).data.items as any[]
  });

  const deleteOrg = useMutation({
    mutationFn: async (id: string) => api.delete(`/organizations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-orgs"] });
      setPendingDeleteId(null);
    }
  });

  if (q.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My organizations"
        action={<Link to="/organizations/new" className="btn-primary">New organization</Link>}
      />
      {q.data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {q.data.map((o) => (
            <li key={o.id} className="card card-body">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{o.org_name}</h3>
                <VerifiedBadge verification={o.verification} />
              </div>
              <p className="text-xs text-slate-500">{o.org_type} · {o.city}, {o.country}</p>
              {o.description && <p className="text-sm mt-2">{o.description}</p>}
              <div className="mt-3 border-t pt-3 flex justify-end relative">
                <button
                  data-menu-button
                  onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)}
                  className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                  title="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpenId === o.id && (
                  <div data-menu-content className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    <Link
                      to={`/organizations/${o.id}/edit`}
                      onClick={() => setMenuOpenId(null)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 rounded-t-lg"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                    <button
                      onClick={() => {
                        setPendingDeleteId(o.id);
                        setMenuOpenId(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
              {pendingDeleteId === o.id && (
                <div className="mt-3 bg-red-50 p-2 rounded flex gap-2 items-center border border-red-200">
                  <span className="text-xs text-red-900 flex-1">Delete this organization?</span>
                  <button
                    onClick={() => deleteOrg.mutate(o.id)}
                    disabled={deleteOrg.isPending}
                    className="btn-danger btn-sm"
                  >
                    Confirm
                  </button>
                  <button onClick={() => setPendingDeleteId(null)} className="btn-secondary btn-sm">
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="card card-body text-sm text-slate-600">No organizations yet.</div>
      )}
    </div>
  );
}
