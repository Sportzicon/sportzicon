import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Badge, StatusPill } from "../components/UI";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
import type { Opportunity } from "../types";

export default function Tournaments() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const params: any = { status, type: "tournament" };
  if (sport) params.sport = sport;

  const q = useQuery({
    queryKey: ["tournaments", params],
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", { params })).data.items
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => api.delete(`/opportunities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      setPendingDeleteId(null);
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tournaments"
        subtitle="Competitive tournaments and sporting events."
        action={
          (user?.role === "club" || user?.role === "organizer" || user?.role === "admin") && (
            <Link to="/tournaments/new" className="btn-primary">Post a tournament</Link>
          )
        }
      />
      <div className="card card-body grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Sport" value={sport} onChange={(e) => setSport(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["open", "closed", "filled"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {q.isLoading ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data?.map((o) => {
            const isPoster = user?.id === o.posted_by_user_id;
            return (
              <div key={o.id} className="card card-body">
                <Link to={`/opportunities/${o.id}`} className="hover:text-brand-700">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{o.title}</h3>
                    <StatusPill status={o.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{o.org_name} · {o.city}, {o.country}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge>{o.sport}</Badge>
                    <Badge>Age {o.age_min}-{o.age_max}</Badge>
                    <Badge>Deadline {o.application_deadline}</Badge>
                  </div>
                </Link>
                {isPoster && (
                  <div className="mt-3 border-t pt-3 flex justify-end relative" ref={menuOpenId === o.id ? menuRef : undefined}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)}
                      className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                      title="More options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === o.id && (
                      <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                        <Link
                          to={`/tournaments/${o.id}/edit`}
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
                )}
                {pendingDeleteId === o.id && (
                  <div className="mt-3 bg-red-50 p-2 rounded flex gap-2 items-center border border-red-200">
                    <span className="text-xs text-red-900 flex-1">Delete this tournament?</span>
                    <button
                      onClick={() => deleteOpp.mutate(o.id)}
                      disabled={deleteOpp.isPending}
                      className="btn-danger btn-sm"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setPendingDeleteId(null)} className="btn-secondary btn-sm">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!q.data?.length && <div className="card card-body text-sm text-slate-600">No tournaments match your filters.</div>}
        </div>
      )}
    </div>
  );
}
