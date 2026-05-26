import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";
import { Link } from "react-router-dom";

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifs"],
    queryFn: async () => (await api.get("/notifications")).data.items as any[]
  });
  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read", { ids: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["notif-count"] });
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        action={<button className="btn-secondary" onClick={() => markAll.mutate()}>Mark all read</button>}
      />
      {q.isLoading ? <Spinner /> : (
        <div className="card divide-y">
          {q.data?.length ? q.data.map((n) => (
            <div key={n.id} className={`p-4 ${n.read ? "" : "bg-brand-50/40"}`}>
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-sm text-slate-700">{n.body}</div>
              <div className="text-xs text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</div>
              {n.link && <Link to={n.link} className="text-brand-700 text-xs">View →</Link>}
            </div>
          )) : <div className="p-6 text-sm text-slate-600">No notifications.</div>}
        </div>
      )}
    </div>
  );
}
