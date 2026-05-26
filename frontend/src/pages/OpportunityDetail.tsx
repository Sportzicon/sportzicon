import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Badge, StatusPill } from "../components/UI";
import type { Opportunity } from "../types";

export default function OpportunityDetail() {
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [applyState, setApplyState] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  const q = useQuery({
    queryKey: ["opp", id],
    queryFn: async () => (await api.get<{ opportunity: Opportunity }>(`/opportunities/${id}`)).data.opportunity
  });

  async function apply() {
    setApplyState("idle");
    try {
      await api.post(`/opportunities/${id}/apply`, { cover_note: note });
      setApplyState("ok");
      qc.invalidateQueries({ queryKey: ["my-apps"] });
    } catch (e) {
      setApplyState("err");
      setErrMsg(getApiError(e).message);
    }
  }

  if (q.isLoading) return <Spinner />;
  const o = q.data;
  if (!o) return <div className="card card-body">Opportunity not found.</div>;

  const isPoster = user?.id === o.posted_by_user_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.title}
        subtitle={`${o.org_name} · ${o.city}, ${o.country}`}
        action={
          <div className="flex gap-2">
            <StatusPill status={o.status} />
            {isPoster && <Link to={`/opportunities/${o.id}/applicants`} className="btn-secondary">View applicants</Link>}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card card-body">
            <h2 className="text-base font-semibold">About this opportunity</h2>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{o.description}</p>
            {o.eligibility && (<><h3 className="mt-4 text-sm font-semibold">Eligibility</h3><p className="text-sm text-slate-700">{o.eligibility}</p></>)}
          </div>
          {user?.role === "athlete" && o.status === "open" && (
            <div className="card card-body">
              <h3 className="text-base font-semibold">Apply</h3>
              <textarea
                className="input mt-2"
                rows={4}
                placeholder="Cover note — why are you a good fit?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn-primary mt-3" onClick={apply}>Submit application</button>
              {applyState === "ok" && <div className="mt-2 text-sm text-emerald-700">Application submitted.</div>}
              {applyState === "err" && <div className="mt-2 text-sm text-red-700">{errMsg}</div>}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card card-body text-sm space-y-2">
            <h3 className="text-base font-semibold mb-2">Details</h3>
            <Row k="Type" v={o.type} />
            <Row k="Sport" v={o.sport} />
            <Row k="Age" v={`${o.age_min}-${o.age_max}`} />
            <Row k="Gender" v={o.gender_eligibility} />
            <Row k="Experience" v={o.experience_level_required} />
            <Row k="Starts" v={o.start_date} />
            <Row k="Ends" v={o.end_date} />
            <Row k="Apply by" v={o.application_deadline} />
            {o.vacancies != null && <Row k="Vacancies" v={`${o.vacancies_filled}/${o.vacancies}`} />}
            <Row k="Applicants" v={String(o.application_count)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-900 text-right">{v}</span>
    </div>
  );
}
