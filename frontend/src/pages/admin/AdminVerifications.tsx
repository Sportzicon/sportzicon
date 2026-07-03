import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";
import { FileText, ExternalLink, Check, X, ChevronRight } from "lucide-react";
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

interface EntityDetail {
  name: string;
  subtitle?: string;
  description?: string;
  location?: string;
  fields: { label: string; value: string }[];
}

function formatDate(val: number | string) {
  const d = typeof val === "number" ? new Date(val) : new Date(val);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toEntityDetail(entityType: string, data: any): EntityDetail {
  if (entityType === "user") {
    const u = data.user ?? data;
    const location = [u.city, u.state, u.country].filter(Boolean).join(", ");
    return {
      name: u.full_name,
      subtitle: u.role,
      description: u.bio,
      location,
      fields: [
        { label: "Email", value: u.email },
        ...(u.phone ? [{ label: "Phone", value: u.phone }] : []),
        ...(u.athlete?.primary_sport ? [{ label: "Sport", value: u.athlete.primary_sport }] : [])
      ]
    };
  }
  const o = data.organization ?? data;
  const location = [o.city, o.state, o.country].filter(Boolean).join(", ");
  return {
    name: o.org_name,
    subtitle: o.org_type,
    description: o.description,
    location,
    fields: [
      { label: "Sports", value: (o.sport_categories ?? []).join(", ") || "—" },
      ...(o.website ? [{ label: "Website", value: o.website }] : []),
      ...(o.contact_email ? [{ label: "Contact email", value: o.contact_email }] : []),
      ...(o.contact_phone ? [{ label: "Contact phone", value: o.contact_phone }] : [])
    ]
  };
}

export default function AdminVerifications() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<VerificationItem | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectErr, setRejectErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  const q = useQuery({
    queryKey: queryKeys.adminVerifications(),
    queryFn: async () => {
      const res = await api.get("/verifications/pending");
      const raw = res.data?.items ?? res.data ?? [];
      return (Array.isArray(raw) ? raw : []) as VerificationItem[];
    }
  });

  const entityQ = useQuery({
    queryKey: ["admin", "verification-entity", selected?.entity_type, selected?.entity_id],
    queryFn: async () => {
      const path = selected!.entity_type === "user"
        ? `/users/${selected!.entity_id}`
        : `/organizations/${selected!.entity_id}`;
      const res = await api.get(path);
      return toEntityDetail(selected!.entity_type, res.data);
    },
    enabled: !!selected
  });

  const closeModal = () => {
    setSelected(null);
    setIsRejecting(false);
    setRejectReason("");
    setRejectErr(null);
    setActionErr(null);
  };

  const review = useMutation({
    mutationFn: async (vars: { id: string; decision: "approve" | "reject"; reason?: string }) =>
      api.post(`/verifications/${vars.id}/review`, { decision: vars.decision, reason: vars.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminVerifications() });
      closeModal();
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const approveOrg = useMutation({
    mutationFn: async (orgId: string) => api.patch(`/verifications/${orgId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminVerifications() });
      closeModal();
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const rejectOrg = useMutation({
    mutationFn: async (vars: { orgId: string; reason: string }) =>
      api.patch(`/verifications/${vars.orgId}/reject`, { reason: vars.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminVerifications() });
      closeModal();
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  function handleApprove() {
    if (!selected) return;
    if (selected.entity_type === "organization") {
      approveOrg.mutate(selected.entity_id);
    } else {
      review.mutate({ id: selected.id, decision: "approve" });
    }
  }

  function handleRejectConfirm() {
    if (!selected) return;
    if (rejectReason.trim().length < 10) {
      setRejectErr("Reason must be at least 10 characters.");
      return;
    }
    if (selected.entity_type === "organization") {
      rejectOrg.mutate({ orgId: selected.entity_id, reason: rejectReason });
    } else {
      review.mutate({ id: selected.id, decision: "reject", reason: rejectReason });
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

      {q.isLoading ? (
        <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>
      ) : items.length === 0 ? (
        <div className="card card-body text-center py-12">
          <div className="text-2xl mb-2">✓</div>
          <div className="font-semibold text-ink">All clear</div>
          <div className="text-sm text-ink-sub mt-1">No pending verifications.</div>
        </div>
      ) : (
        <div className="card divide-y divide-hairsoft overflow-hidden">
          {items.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-fill min-h-[64px]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink capitalize">{v.entity_type} verification</span>
                  <span className="badge text-[10px] capitalize">{v.verification_type.replace(/_/g, " ")}</span>
                </div>
                {v.notes && <div className="text-xs text-ink-sub mt-0.5 italic truncate">{v.notes}</div>}
                <div className="text-xs text-ink-faint mt-1 flex items-center gap-3">
                  <span>{formatDate(v.created_at)}</span>
                  <span>{(Array.isArray(v.documents) ? v.documents.length : 0)} document{v.documents?.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-ink-faint flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full sm:max-w-lg bg-panel rounded-t-2xl sm:rounded-xl shadow-card max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-hair px-4 py-3">
              <h2 className="font-disp text-lg text-ink capitalize">{selected.entity_type} verification</h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="flex h-11 min-h-[44px] w-11 items-center justify-center text-ink-sub hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex-1 space-y-4">
              {entityQ.isLoading ? (
                <div className="flex justify-center py-8"><Spinner className="text-brand-500" /></div>
              ) : entityQ.isError ? (
                <div className="text-sm text-red-600">Could not load entity details.</div>
              ) : entityQ.data ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold text-ink text-base">{entityQ.data.name}</div>
                    {entityQ.data.subtitle && (
                      <span className="badge capitalize text-xs mt-1">{entityQ.data.subtitle}</span>
                    )}
                  </div>
                  {entityQ.data.location && (
                    <div className="text-sm text-ink-sub">{entityQ.data.location}</div>
                  )}
                  {entityQ.data.description && (
                    <p className="text-sm text-ink-sub">{entityQ.data.description}</p>
                  )}
                  {entityQ.data.fields.length > 0 && (
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                      {entityQ.data.fields.map((f) => (
                        <div key={f.label} className="flex justify-between gap-3 border-b border-hairsoft pb-1">
                          <dt className="text-ink-faint">{f.label}</dt>
                          <dd className="text-ink text-right break-all">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ) : null}

              <div className="border-t border-hairsoft pt-3 space-y-2">
                <div className="text-xs font-medium text-ink-sub uppercase tracking-wide">
                  Submitted {formatDate(selected.created_at)}
                </div>
                {selected.notes && <p className="text-sm text-ink-sub italic">{selected.notes}</p>}
                <div className="space-y-1">
                  {(Array.isArray(selected.documents) ? selected.documents : []).map((d, i) => (
                    <a key={i} href={d} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-brand-500 min-h-[44px]">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      Document {i + 1}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ))}
                  {selected.documents?.length === 0 && (
                    <div className="text-sm text-ink-faint">No documents submitted.</div>
                  )}
                </div>
              </div>

              {actionErr && (
                <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{actionErr}</div>
              )}
            </div>

            <div className="shrink-0 border-t border-hair bg-panel p-4">
              {isRejecting ? (
                <div className="space-y-2">
                  <textarea
                    className="input w-full"
                    rows={3}
                    placeholder="Rejection reason (min 10 characters)…"
                    value={rejectReason}
                    onChange={(e) => { setRejectReason(e.target.value); setRejectErr(null); }}
                    autoFocus
                  />
                  {rejectErr && <div className="text-red-600 text-xs">{rejectErr}</div>}
                  <div className="flex gap-2">
                    <button onClick={handleRejectConfirm} disabled={isActing}
                      className="btn-danger min-h-[44px] flex-1">
                      Confirm reject
                    </button>
                    <button onClick={() => { setIsRejecting(false); setRejectReason(""); setRejectErr(null); }}
                      className="btn-secondary min-h-[44px] flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleApprove} disabled={isActing}
                    className="btn-primary min-h-[44px] flex-1 flex items-center justify-center gap-1.5">
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button onClick={() => setIsRejecting(true)} disabled={isActing}
                    className="btn-danger min-h-[44px] flex-1 flex items-center justify-center gap-1.5">
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
