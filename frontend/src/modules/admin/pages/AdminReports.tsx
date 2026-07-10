import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../../../api/client";
import { PageHeader, Spinner } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { queryKeys } from "../../../hooks/queryKeys";
import { CheckCircle, XCircle, AlertOctagon } from "lucide-react";

type ReportItem = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter?: { full_name: string; email: string };
  notes?: string;
};

export default function AdminReports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("");
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveAction, setResolveAction] = useState<"warned" | "suspended" | "dismissed">("warned");
  const [resolveNotes, setResolveNotes] = useState("");
  const [actionErr, setActionErr] = useState<string | null>(null);

  const filters: Record<string, unknown> = { status };
  if (type) filters.type = type;

  const q = useQuery({
    queryKey: queryKeys.adminReports(filters),
    queryFn: async () =>
      (await api.get("/admin/reports", { params: { ...filters, limit: 100 } })).data.items as ReportItem[]
  });

  const resolve = useMutation({
    mutationFn: async (vars: { id: string; action: "warned" | "suspended" | "dismissed"; notes?: string }) =>
      api.patch(`/admin/reports/${vars.id}/resolve`, { action: vars.action, notes: vars.notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminReports() });
      setResolveId(null);
      setResolveNotes("");
      setActionErr(null);
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const items = q.data ?? [];

  return (
    <div className="space-y-4">
      <BackButton to="/admin" label="Admin" className="mb-1" />
      <PageHeader title="Reports" subtitle="Abuse and dispute reports" />

      {actionErr && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{actionErr}</div>
      )}

      {/* Filters */}
      <div className="card card-body flex flex-wrap gap-3">
        <select className="input flex-1 min-w-[120px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
        <select className="input flex-1 min-w-[120px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="user">User</option>
          <option value="post">Post</option>
          <option value="reel">Reel</option>
          <option value="blog">Blog</option>
          <option value="organization">Organization</option>
          <option value="message">Message</option>
          <option value="opportunity">Opportunity</option>
        </select>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="card card-body text-center py-10 text-sm text-slate-500">
          No reports found. {status === "open" ? "All clear!" : ""}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className={`card p-4 space-y-3 ${r.status === "open" ? "border-l-4 border-red-400" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm capitalize">{r.target_type} report</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "open" ? "bg-red-100 text-red-700" :
                      r.status === "actioned" ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>{r.status}</span>
                  </div>
                  <div className="text-sm text-slate-700 mt-1 line-clamp-2">{r.reason}</div>
                  {r.reporter && (
                    <div className="text-xs text-slate-400 mt-1">
                      Reported by {r.reporter.full_name} · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  )}
                  {r.notes && <div className="text-xs text-slate-500 mt-1 italic">{r.notes}</div>}
                </div>
              </div>

              {r.status === "open" && (
                <>
                  {resolveId === r.id ? (
                    <div className="space-y-3 rounded bg-slate-50 p-3">
                      <div className="text-sm font-medium">Resolve report</div>
                      <div className="flex flex-wrap gap-2">
                        {(["warned", "suspended", "dismissed"] as const).map((a) => (
                          <button
                            key={a}
                            onClick={() => setResolveAction(a)}
                            className={`text-xs px-3 py-2 rounded-full border font-medium transition min-h-[44px] ${
                              resolveAction === a
                                ? a === "suspended" ? "bg-red-600 border-red-600 text-white"
                                  : a === "warned" ? "bg-orange-500 border-orange-500 text-white"
                                  : "bg-slate-600 border-slate-600 text-white"
                                : "bg-white border-slate-300 text-slate-700 hover:border-slate-500"
                            }`}
                          >
                            {a === "warned" ? "Warn user" : a === "suspended" ? "Suspend user" : "Dismiss"}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="input w-full text-sm"
                        rows={2}
                        placeholder="Notes (optional)…"
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolve.mutate({ id: r.id, action: resolveAction, notes: resolveNotes || undefined })}
                          disabled={resolve.isPending}
                          className="btn-primary min-h-[44px] flex-1 flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="h-4 w-4" /> Confirm
                        </button>
                        <button
                          onClick={() => { setResolveId(null); setResolveNotes(""); setActionErr(null); }}
                          className="btn-secondary min-h-[44px] flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setResolveId(r.id); setResolveAction("warned"); setResolveNotes(""); setActionErr(null); }}
                        className="btn-secondary min-h-[44px] flex items-center gap-1.5 text-sm"
                      >
                        <AlertOctagon className="h-4 w-4 text-orange-500" /> Resolve
                      </button>
                      <button
                        onClick={() => resolve.mutate({ id: r.id, action: "dismissed" })}
                        disabled={resolve.isPending}
                        className="btn-secondary min-h-[44px] flex items-center gap-1.5 text-sm"
                      >
                        <XCircle className="h-4 w-4 text-slate-400" /> Dismiss
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
