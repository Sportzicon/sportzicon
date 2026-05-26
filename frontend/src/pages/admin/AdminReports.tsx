import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";

export default function AdminReports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const q = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: async () => (await api.get("/admin/reports", { params: { status } })).data.items as any[]
  });
  const action = useMutation({
    mutationFn: async (vars: { id: string; status: "actioned" | "dismissed"; notes?: string }) =>
      api.patch(`/admin/reports/${vars.id}`, { status: vars.status, notes: vars.notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] })
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" />
      <div className="card card-body">
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>open</option><option>actioned</option><option>dismissed</option><option value="all">all</option>
        </select>
      </div>
      {q.isLoading ? <Spinner /> : (
        <div className="card divide-y">
          {q.data?.length ? q.data.map((r) => (
            <div key={r.id} className="p-4">
              <div className="font-medium text-sm">{r.target_type}/{r.target_id}</div>
              <div className="text-sm text-slate-700">{r.reason}</div>
              <div className="text-xs text-slate-500 mt-1">Status: {r.status}</div>
              {r.status === "open" && (
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary" onClick={() => action.mutate({ id: r.id, status: "actioned" })}>Mark actioned</button>
                  <button className="btn-secondary" onClick={() => action.mutate({ id: r.id, status: "dismissed" })}>Dismiss</button>
                </div>
              )}
            </div>
          )) : <div className="p-6 text-sm text-slate-600">Nothing to review.</div>}
        </div>
      )}
    </div>
  );
}
