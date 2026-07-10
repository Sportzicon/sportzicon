import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { humanizeError } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { PageHeader, Spinner, Badge, Pagination } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { ChevronDown, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const APP_STATUSES = ["applied", "shortlisted", "selected", "rejected", "withdrawn"] as const;

function statusColor(s: string) {
  if (s === "selected") return "green";
  if (s === "rejected" || s === "withdrawn") return "red";
  if (s === "shortlisted") return "yellow";
  return "blue";
}

export default function AdminApplications() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");

  const params: Record<string, string | number | undefined> = { limit: 200 };
  if (statusFilter) params.status = statusFilter;

  const q = useQuery({
    queryKey: queryKeys.adminApplications(params),
    queryFn: async () => (await api.get("/admin/applications", { params })).data.items as any[]
  });

  const transitionApp = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch(`/admin/applications/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminApplications() });
      setOverrideFor(null); setOverrideStatus(""); setOverrideReason(""); setOverrideError("");
    },
    onError: (e: unknown) => setOverrideError(humanizeError(e))
  });

  const allItems = q.data ?? [];
  const paged = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function startOverride(app: Record<string, any>) {
    setOverrideFor(app.id);
    setOverrideStatus(app.status);
    setOverrideReason("");
    setOverrideError("");
  }

  function fmtDate(ts: string | number | null | undefined) {
    if (!ts) return "—";
    try { return new Date(Number(ts)).toLocaleDateString(); } catch { return String(ts).slice(0, 10); }
  }

  return (
    <div className="space-y-4">
      <BackButton to="/admin" label="Admin" className="mb-1" />
      <PageHeader title="Applications" subtitle="Admin view of all applications — override status when needed" />

      <div className="card card-body flex flex-wrap gap-3">
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {APP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="self-center text-sm text-slate-500">{allItems.length} total</span>
      </div>

      {q.isLoading ? <Spinner /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Applicant</th>
                  <th>Opportunity</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((app) => (
                  <>
                    <tr key={app.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">
                        <button
                          className="text-slate-400 hover:text-slate-700"
                          onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                        >
                          {expandedId === app.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{app.applicant_name ?? "—"}</div>
                        <div className="text-xs text-slate-500">{app.applicant_email}</div>
                      </td>
                      <td>
                        <div className="max-w-[200px] truncate">{app.opportunity_title ?? "—"}</div>
                      </td>
                      <td><Badge color="blue">{app.opportunity_type ?? "—"}</Badge></td>
                      <td><Badge color={statusColor(app.status) as any}>{app.status}</Badge></td>
                      <td className="text-xs text-slate-500">{fmtDate(app.applied_at)}</td>
                      <td className="p-3">
                        {overrideFor === app.id ? (
                          <div className="flex gap-2 items-center flex-wrap">
                            <select
                              className="input input-sm"
                              value={overrideStatus}
                              onChange={(e) => setOverrideStatus(e.target.value)}
                            >
                              {APP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input
                              className="input input-sm"
                              placeholder="Reason (optional)"
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                            />
                            <button
                              className="btn-primary btn-sm"
                              disabled={transitionApp.isPending}
                              onClick={() => transitionApp.mutate({ id: app.id, status: overrideStatus, reason: overrideReason || undefined })}
                            >
                              {transitionApp.isPending ? "…" : "Apply"}
                            </button>
                            <button className="btn-secondary btn-sm" onClick={() => setOverrideFor(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn-secondary btn-sm" onClick={() => startOverride(app)}>Override status</button>
                        )}
                      </td>
                    </tr>
                    {overrideFor === app.id && overrideError && (
                      <tr key={`err-${app.id}`} className="bg-red-50">
                        <td colSpan={7} className="px-4 py-2 text-sm text-red-700">{overrideError}</td>
                      </tr>
                    )}
                    {expandedId === app.id && (
                      <tr key={`detail-${app.id}`} className="bg-slate-50">
                        <td colSpan={7} className="p-4 text-sm">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div><span className="font-medium text-slate-600">App ID:</span> <span className="font-mono text-xs">{app.id}</span></div>
                            <div><span className="font-medium text-slate-600">Opportunity ID:</span> <span className="font-mono text-xs">{app.opportunity_id}</span></div>
                            <div><span className="font-medium text-slate-600">Applicant ID:</span> <span className="font-mono text-xs">{app.applicant_user_id}</span></div>
                            <div><span className="font-medium text-slate-600">Updated:</span> {fmtDate(app.updated_at)}</div>
                            {app.rejection_reason && (
                              <div className="col-span-2"><span className="font-medium text-slate-600">Rejection reason:</span> {app.rejection_reason}</div>
                            )}
                          </div>
                          {app.cover_note && (
                            <div className="mt-3">
                              <span className="font-medium text-slate-600 block mb-1">Cover note:</span>
                              <p className="text-slate-700 bg-white p-3 rounded border text-sm">{app.cover_note}</p>
                            </div>
                          )}
                          {Array.isArray(app.history) && app.history.length > 0 && (
                            <div className="mt-3">
                              <span className="font-medium text-slate-600 block mb-1">History:</span>
                              <div className="space-y-1">
                                {(app.history as any[]).map((h, i) => (
                                  <div key={i} className="flex gap-3 text-xs text-slate-600">
                                    <span className="text-slate-400">{new Date(h.at).toLocaleString()}</span>
                                    <Badge color={statusColor(h.status) as any}>{h.status}</Badge>
                                    {h.admin_override && <span className="text-orange-600 font-medium">admin override</span>}
                                    {h.reason && <span>— {h.reason}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {!paged.length && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500 text-sm">No applications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={allItems.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  );
}
