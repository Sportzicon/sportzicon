import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, StatusPill } from "../components/UI";
import type { Application } from "../types";

const NEXT: Record<string, string[]> = {
  pending: ["shortlisted", "rejected"],
  shortlisted: ["selected", "rejected"],
  selected: [],
  rejected: [],
  withdrawn: []
};

export default function Applicants() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["applicants", id],
    queryFn: async () => (await api.get<{ items: Application[] }>(`/opportunities/${id}/applicants`)).data.items
  });
  const m = useMutation({
    mutationFn: async (vars: { id: string; status: string; reason?: string }) =>
      api.patch(`/applications/${vars.id}/status`, { status: vars.status, reason: vars.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applicants", id] })
  });

  if (q.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="Applicants" subtitle="Review and progress applications through the pipeline." />
      <div className="card">
        <div className="divide-y">
          {q.data?.length ? q.data.map((a) => (
            <div key={a.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Link to={`/profile/${a.applicant_user_id}`} className="font-medium text-slate-900">{a.applicant_name}</Link>
                  <div className="text-xs text-slate-500">Applied {new Date(a.applied_at).toLocaleString()}</div>
                </div>
                <StatusPill status={a.status} />
              </div>
              {a.cover_note && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{a.cover_note}</p>}
              {NEXT[a.status]?.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {NEXT[a.status].map((s) => (
                    s === "rejected" ? (
                      <button key={s} className="btn-secondary" onClick={() => setRejectingId(a.id)}>Reject</button>
                    ) : (
                      <button key={s} className="btn-primary" onClick={() => m.mutate({ id: a.id, status: s })}>
                        {s === "shortlisted" ? "Shortlist" : "Select"}
                      </button>
                    )
                  ))}
                </div>
              )}
              {rejectingId === a.id && (
                <div className="mt-3 space-y-2">
                  <textarea className="input" rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        await m.mutateAsync({ id: a.id, status: "rejected", reason: reason || undefined });
                        setRejectingId(null);
                        setReason("");
                      }}
                    >Confirm reject</button>
                    <button className="btn-secondary" onClick={() => { setRejectingId(null); setReason(""); }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )) : <div className="p-6 text-sm text-slate-600">No applications yet.</div>}
        </div>
      </div>
    </div>
  );
}
