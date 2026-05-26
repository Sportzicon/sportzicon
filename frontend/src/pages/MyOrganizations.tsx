import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, VerifiedBadge } from "../components/UI";

export default function MyOrganizations() {
  const q = useQuery({
    queryKey: ["my-orgs"],
    queryFn: async () => (await api.get("/organizations/mine")).data.items as any[]
  });

  if (q.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My organizations"
        action={<Link to="/organizations/new" className="btn-primary">New organization</Link>}
      />
      {q.data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {q.data.map((o) => (
            <li key={o.id} className="card card-body">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{o.org_name}</h3>
                <VerifiedBadge verification={o.verification} />
              </div>
              <p className="text-xs text-slate-500">{o.org_type} · {o.city}, {o.country}</p>
              {o.description && <p className="text-sm mt-2">{o.description}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="card card-body text-sm text-slate-600">No organizations yet.</div>
      )}
    </div>
  );
}
