import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Badge, StatusPill } from "../components/UI";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
import type { Opportunity } from "../types";

const TYPE_LABELS: Record<string, string> = {
  trial: "Trial",
  recruitment: "Recruitment",
  scholarship: "Scholarship",
  tournament: "Tournament",
  coaching_job: "Coaching Job"
};

export default function Opportunities() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [type, setType] = useState<string>("");
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState<string>("open");
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

  const params: any = { status };
  if (type) params.type = type;
  if (sport) params.sport = sport;

  const q = useQuery({
    queryKey: ["opportunities", params],
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", { params })).data.items
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => api.delete(`/opportunities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      setPendingDeleteId(null);
    }
  });

  const updateOpp = useMutation({
    mutationFn: async (id: string) => api.put(`/opportunities/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] })
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Opportunities"
        subtitle="Trials, scholarships, recruitment, tournaments and coaching jobs."
        action={
          (user?.role === "club" || user?.role === "organizer" || user?.role === "admin") && (
            <Link to="/opportunities/new" className="btn-primary">Post an opportunity</Link>
          )
        }
      />
      <div className="card card-body grid gap-3 sm:grid-cols-3">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="trial">Trial</option>
          <option value="recruitment">Recruitment</option>
          <option value="scholarship">Scholarship</option>
          <option value="tournament">Tournament</option>
          <option value="coaching_job">Coaching Job</option>
        </select>
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
                    <Badge color="blue">{TYPE_LABELS[o.type] ?? o.type}</Badge>
                    <Badge>{o.sport}</Badge>
                    <Badge>Age {o.age_min}-{o.age_max}</Badge>
                    <Badge>Deadline {o.application_deadline}</Badge>
                  </div>
                </Link>
                {isPoster && (
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
                          to={`/opportunities/${o.id}/edit`}
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
                    <span className="text-xs text-red-900 flex-1">Delete this opportunity?</span>
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
          {!q.data?.length && <div className="card card-body text-sm text-slate-600">No opportunities match your filters.</div>}
        </div>
      )}
    </div>
  );
}
