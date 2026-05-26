import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Badge, StatusPill } from "../components/UI";
import type { Opportunity } from "../types";

export default function Opportunities() {
  const user = useAuthStore((s) => s.user);
  const [type, setType] = useState<string>("");
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState<string>("open");

  const params: any = { status };
  if (type) params.type = type;
  if (sport) params.sport = sport;

  const q = useQuery({
    queryKey: ["opportunities", params],
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", { params })).data.items
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Opportunities"
        subtitle="Trials, scholarships, recruitment, tournaments and coaching jobs."
        action={
          (user?.role === "club" || user?.role === "organizer") && (
            <Link to="/opportunities/new" className="btn-primary">Post an opportunity</Link>
          )
        }
      />
      <div className="card card-body grid gap-3 sm:grid-cols-3">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {["trial", "recruitment", "scholarship", "tournament", "coaching_job"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Sport" value={sport} onChange={(e) => setSport(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["open", "closed", "filled"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {q.isLoading ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data?.map((o) => (
            <Link key={o.id} to={`/opportunities/${o.id}`} className="card card-body hover:shadow">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{o.title}</h3>
                <StatusPill status={o.status} />
              </div>
              <div className="text-xs text-slate-500 mt-1">{o.org_name} · {o.city}, {o.country}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge color="blue">{o.type}</Badge>
                <Badge>{o.sport}</Badge>
                <Badge>Age {o.age_min}-{o.age_max}</Badge>
                <Badge>Deadline {o.application_deadline}</Badge>
              </div>
            </Link>
          ))}
          {!q.data?.length && <div className="card card-body text-sm text-slate-600">No opportunities match your filters.</div>}
        </div>
      )}
    </div>
  );
}
