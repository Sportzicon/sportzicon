import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";
import { FileText, ExternalLink, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { queryKeys } from "../../hooks/queryKeys";

interface VerificationItem {
  id: string;
  entity_type: string;
  entity_id: string;
  verification_type: string;
  documents: string[];
  notes?: string;
  status: string;
  submitted_by: string;
  created_at: number | string;
}

function formatDate(val: number | string) {
  const d = typeof val === "number" ? new Date(val) : new Date(val);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminVerifications() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectErr, setRejectErr] = useState<string | null>(null);
  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: queryKeys.adminVerifications(),
    queryFn: async () => (await api.get("/verifications/pending")).data.items as VerificationItem[]
  });

  const review = useMutation({
    mutationFn: async (vars: { id: string; decision: "approve" | "reject"; reason?: string }) =>
      api.post(`/verifications/${vars.id}/review`, { decision: vars.decision, reason: vars.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminVerifications() });
      setRejectTargetId(null);
      setRejectReason("");
      setApproveConfirmId(null);
      setActionErr(null);
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const approveOrg = useMutation({
    mutationFn: async (orgId: string) => api.patch(`/verifications/${orgId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminVerifications() });
      setApproveConfirmId(null);
      setActionErr(null);
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const rejectOrg = useMutation({
    mutationFn: async (vars: { orgId: string; reason: string }) =>
      api.patch(`/verifications/${vars.orgId}/reject`, { reason: vars.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminVerifications() });
      setRejectTargetId(null);
      setRejectReason("");
      setActionErr(null);
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  function handleApprove(v: VerificationItem) {
    if (v.entity_type === "organization") {
      setApproveConfirmId(v.entity_id);
    } else {
      review.mutate({ id: v.id, decision: "approve" });
    }
  }

  function handleRejectOpen(v: VerificationItem) {
    setRejectTargetId(v.entity_type === "organization" ? `org:${v.entity_id}` : `verif:${v.id}`);
    setRejectReason("");
    setRejectErr(null);
  }

  function handleRejectConfirm() {
    if (!rejectTargetId) return;
    if (rejectReason.trim().length < 10) {
      setRejectErr("Reason must be at least 10 characters.");
      return;
    }
    if (rejectTargetId.startsWith("org:")) {
      rejectOrg.mutate({ orgId: rejectTargetId.slice(4), reason: rejectReason });
    } else {
      review.mutate({ id: rejectTargetId.slice(6), decision: "reject", reason: rejectReason });
    }
  }

  const items = q.data ?? [];
  const isActing = review.isPending || approveOrg.isPending || rejectOrg.isPending;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pending verifications"
        subtitle={`${items.length} item${items.length !== 1 ? "s" : ""} to review`}
      />

      {actionErr && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{actionErr}</div>
      )}

      {q.isLoading ? (
        <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>
      ) : items.length === 0 ? (
        <div className="card card-body text-center py-12">
          <div className="text-2xl mb-2">✓</div>
          <div className="font-semibold text-ink">All clear</div>
          <div className="text-sm text-ink-sub mt-1">No pending verifications.</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairsoft bg-fill text-left">
                  <th className="px-4 py-3 font-medium text-ink-sub text-xs uppercase tracking-wide">Entity</th>
                  <th className="px-4 py-3 font-medium text-ink-sub text-xs uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 font-medium text-ink-sub text-xs uppercase tracking-wide">Submitted</th>
                  <th className="px-4 py-3 font-medium text-ink-sub text-xs uppercase tracking-wide">Docs</th>
                  <th className="px-4 py-3 font-medium text-ink-sub text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairsoft">
                {items.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink capitalize">{v.entity_type}</div>
                      <div className="text-xs text-ink-faint font-mono">{v.entity_id.slice(0, 12)}…</div>
                      {v.notes && <div className="text-xs text-ink-sub mt-0.5 italic">{v.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge capitalize">{v.verification_type.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-sub text-xs">{formatDate(v.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {v.documents.map((d, i) => (
                          <a key={i} href={d} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-brand-500 hover:underline text-xs min-h-[44px]">
                            <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                            Document {i + 1}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {approveConfirmId === v.entity_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-sub">Confirm approve?</span>
                          <button
                            onClick={() => approveOrg.mutate(v.entity_id)}
                            disabled={isActing}
                            className="btn-primary text-xs min-h-[44px] flex items-center gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Yes
                          </button>
                          <button onClick={() => setApproveConfirmId(null)}
                            className="btn-secondary text-xs min-h-[44px]">No</button>
                        </div>
                      ) : rejectTargetId && (rejectTargetId === `org:${v.entity_id}` || rejectTargetId === `verif:${v.id}`) ? (
                        <div className="space-y-2">
                          <textarea
                            className="input text-xs w-full"
                            rows={2}
                            placeholder="Rejection reason (min 10 chars)…"
                            value={rejectReason}
                            onChange={(e) => { setRejectReason(e.target.value); setRejectErr(null); }}
                          />
                          {rejectErr && <div className="text-red-600 text-xs">{rejectErr}</div>}
                          <div className="flex gap-2">
                            <button onClick={handleRejectConfirm} disabled={isActing}
                              className="btn-danger text-xs min-h-[44px]">
                              Confirm reject
                            </button>
                            <button onClick={() => { setRejectTargetId(null); setRejectReason(""); }}
                              className="btn-secondary text-xs min-h-[44px]">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(v)} disabled={isActing}
                            className="btn-primary text-xs min-h-[44px] flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button onClick={() => handleRejectOpen(v)} disabled={isActing}
                            className="btn-danger text-xs min-h-[44px] flex items-center gap-1">
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden card divide-y divide-hairsoft">
            {items.map((v) => {
              const isExpanded = expandedId === v.id;
              const isRejectTarget = rejectTargetId === `org:${v.entity_id}` || rejectTargetId === `verif:${v.id}`;
              const isApproveTarget = approveConfirmId === v.entity_id;

              return (
                <div key={v.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink capitalize">{v.entity_type} verification</div>
                      <span className="badge text-[10px] capitalize mt-1">{v.verification_type.replace(/_/g, " ")}</span>
                      <div className="text-xs text-ink-sub mt-1">{formatDate(v.created_at)}</div>
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <>
                      {v.notes && <p className="text-sm text-ink-sub italic">{v.notes}</p>}
                      <div className="space-y-1">
                        {v.documents.map((d, i) => (
                          <a key={i} href={d} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-sm text-brand-500 min-h-[44px]">
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            Document {i + 1}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ))}
                      </div>
                    </>
                  )}

                  {isApproveTarget ? (
                    <div className="rounded bg-green-50 border border-green-200 p-3 space-y-2">
                      <div className="text-sm text-green-900 font-medium">Approve this verification?</div>
                      <div className="flex gap-2">
                        <button onClick={() => approveOrg.mutate(v.entity_id)} disabled={isActing}
                          className="btn-primary min-h-[44px] flex-1 flex items-center justify-center gap-1">
                          <Check className="h-4 w-4" /> Confirm
                        </button>
                        <button onClick={() => setApproveConfirmId(null)}
                          className="btn-secondary min-h-[44px] flex-1">Cancel</button>
                      </div>
                    </div>
                  ) : isRejectTarget ? (
                    <div className="space-y-2">
                      <textarea
                        className="input w-full"
                        rows={3}
                        placeholder="Rejection reason (min 10 characters)…"
                        value={rejectReason}
                        onChange={(e) => { setRejectReason(e.target.value); setRejectErr(null); }}
                      />
                      {rejectErr && <div className="text-red-600 text-xs">{rejectErr}</div>}
                      <div className="flex gap-2">
                        <button onClick={handleRejectConfirm} disabled={isActing}
                          className="btn-danger min-h-[44px] flex-1">
                          Confirm reject
                        </button>
                        <button onClick={() => { setRejectTargetId(null); setRejectReason(""); }}
                          className="btn-secondary min-h-[44px] flex-1">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(v)} disabled={isActing}
                        className="btn-primary min-h-[44px] flex-1 flex items-center justify-center gap-1.5">
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button onClick={() => handleRejectOpen(v)} disabled={isActing}
                        className="btn-danger min-h-[44px] flex-1 flex items-center justify-center gap-1.5">
                        <X className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
