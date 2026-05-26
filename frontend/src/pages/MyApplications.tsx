import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, StatusPill } from "../components/UI";
import type { Application } from "../types";

export default function MyApplications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-apps"],
    queryFn: async () => (await api.get<{ items: Application[] }>("/applications/mine")).data.items
  });
  const withdraw = useMutation({
    mutationFn: async (id: string) => api.patch(`/applications/${id}/status`, { status: "withdrawn" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-apps"] })
  });

  if (q.isLoading) return <Spinner />;
  return (
    <div className="space-y-4">
      <PageHeader title="My applications" />
      <div className="card divide-y">
        {q.data?.length ? q.data.map((a) => (
          <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link to={`/opportunities/${a.opportunity_id}`} className="font-medium text-slate-900">{a.opportunity_title}</Link>
              <div className="text-xs text-slate-500">Applied {new Date(a.applied_at).toLocaleString()}</div>
              {a.status === "rejected" && a.rejection_reason && (
                <div className="mt-1 text-xs text-slate-600">Reason: {a.rejection_reason}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={a.status} />
              {!["withdrawn", "rejected", "selected"].includes(a.status) && (
                <button className="btn-secondary" onClick={() => withdraw.mutate(a.id)}>Withdraw</button>
              )}
            </div>
          </div>
        )) : <div className="p-6 text-sm text-slate-600">No applications yet.</div>}
      </div>
    </div>
  );
}
