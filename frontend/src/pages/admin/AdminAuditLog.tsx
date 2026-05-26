import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";

export default function AdminAuditLog() {
  const q = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => (await api.get("/admin/audit-logs", { params: { limit: 200 } })).data.items as any[]
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" subtitle="Every admin action is recorded here." />
      {q.isLoading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-slate-50 text-slate-600"><tr>
              <th className="p-3">When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th>
            </tr></thead>
            <tbody>
              {q.data?.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.actor_id.slice(0, 8)}…</td>
                  <td className="font-mono text-xs">{l.action}</td>
                  <td>{l.target_type ? `${l.target_type}/${l.target_id?.slice(0, 8)}…` : "—"}</td>
                  <td className="font-mono text-xs">{l.details ? JSON.stringify(l.details) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
