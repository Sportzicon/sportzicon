import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";

export default function AdminVerifications() {
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["admin-verifs"],
    queryFn: async () => (await api.get("/verifications/pending")).data.items as any[]
  });
  const review = useMutation({
    mutationFn: async (vars: { id: string; decision: "approve" | "reject"; reason?: string }) =>
      api.post(`/verifications/${vars.id}/review`, { decision: vars.decision, reason: vars.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-verifs"] })
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Pending verifications" />
      {q.isLoading ? <Spinner /> : (
        <div className="card divide-y">
          {q.data?.length ? q.data.map((v) => (
            <div key={v.id} className="p-4">
              <div className="text-sm font-medium">{v.entity_type} · {v.verification_type}</div>
              <div className="text-xs text-slate-500">Entity {v.entity_id}</div>
              <ul className="mt-2 text-sm list-disc list-inside">
                {v.documents.map((d: string, i: number) => <li key={i}><a className="text-brand-700" href={d} target="_blank" rel="noreferrer">Document {i+1}</a></li>)}
              </ul>
              {v.notes && <p className="text-sm text-slate-600 mt-1">{v.notes}</p>}
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={() => review.mutate({ id: v.id, decision: "approve" })}>Approve</button>
                <button className="btn-danger" onClick={() => setReasonFor(v.id)}>Reject</button>
              </div>
              {reasonFor === v.id && (
                <div className="mt-2 space-y-2">
                  <textarea className="input" rows={2} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        await review.mutateAsync({ id: v.id, decision: "reject", reason });
                        setReasonFor(null); setReason("");
                      }}
                    >Confirm reject</button>
                    <button className="btn-secondary" onClick={() => { setReasonFor(null); setReason(""); }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )) : <div className="p-6 text-sm text-slate-600">Nothing to review.</div>}
        </div>
      )}
    </div>
  );
}
