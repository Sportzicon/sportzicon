import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";
import { queryKeys } from "../../hooks/queryKeys";
import { Download } from "lucide-react";

type AuditEntry = {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip?: string;
  created_at: string;
  actor?: { full_name: string; email: string };
};

export default function AdminAuditLog() {
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters: Record<string, unknown> = {};
  if (actorId) filters.actor_id = actorId;
  if (action) filters.action = action;
  if (dateFrom) filters.date_from = dateFrom;
  if (dateTo) filters.date_to = dateTo;

  const q = useQuery({
    queryKey: queryKeys.adminAuditLog(filters),
    queryFn: async () =>
      (await api.get("/admin/audit-log", { params: { ...filters, limit: 200 } })).data.items as AuditEntry[]
  });

  function downloadCsv() {
    const rows = q.data ?? [];
    const header = ["Timestamp", "Actor", "Actor Role", "Action", "Target Type", "Target ID", "Details", "IP"];
    const lines = rows.map((l) => [
      new Date(l.created_at).toISOString(),
      l.actor ? `${l.actor.full_name} <${l.actor.email}>` : l.actor_id,
      l.actor_role,
      l.action,
      l.target_type ?? "",
      l.target_id ?? "",
      l.details ? JSON.stringify(l.details) : "",
      l.ip ?? ""
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const items = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title="Audit log" subtitle="Every admin action is recorded here." />
        <button
          onClick={downloadCsv}
          disabled={items.length === 0}
          className="btn-secondary min-h-[44px] flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card card-body space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Action contains</label>
            <input
              className="input w-full"
              placeholder="e.g. user.suspended"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Actor ID</label>
            <input
              className="input w-full font-mono text-xs"
              placeholder="User UUID…"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">From date</label>
            <input
              type="date"
              className="input w-full"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To date</label>
            <input
              type="date"
              className="input w-full"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        {(actorId || action || dateFrom || dateTo) && (
          <button
            className="text-xs text-brand-500 hover:underline"
            onClick={() => { setActorId(""); setAction(""); setDateFrom(""); setDateTo(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="card card-body text-center py-10 text-sm text-slate-500">No audit log entries found.</div>
      ) : (
        <>
          {/* Mobile: chronological list */}
          <div className="md:hidden space-y-2">
            {items.map((l) => (
              <div key={l.id} className="card p-4 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-brand-600">{l.action}</span>
                  <span className="text-xs text-slate-400">{new Date(l.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-slate-700">
                  {l.actor ? `${l.actor.full_name}` : l.actor_id.slice(0, 12) + "…"}
                  <span className="text-xs text-slate-400 ml-1">({l.actor_role})</span>
                </div>
                {l.target_type && (
                  <div className="text-xs text-slate-500">
                    Target: {l.target_type}/{l.target_id?.slice(0, 12)}…
                  </div>
                )}
                {l.details && Object.keys(l.details).length > 0 && (
                  <div className="font-mono text-xs text-slate-400 line-clamp-2">{JSON.stringify(l.details)}</div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="p-3 whitespace-nowrap">When</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="text-sm">{l.actor ? l.actor.full_name : l.actor_id.slice(0, 12) + "…"}</div>
                      <div className="text-xs text-slate-400">{l.actor_role}</div>
                    </td>
                    <td className="p-3 font-mono text-xs text-brand-600">{l.action}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {l.target_type ? `${l.target_type}/${l.target_id?.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-400 max-w-xs truncate">
                      {l.details ? JSON.stringify(l.details) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
