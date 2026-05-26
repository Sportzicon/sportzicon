import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader } from "../../components/UI";

export default function Admin() {
  const q = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => (await api.get("/admin/analytics")).data
  });
  const sections = [
    { to: "/admin/users", title: "Users", desc: "View and moderate user accounts" },
    { to: "/admin/verifications", title: "Verifications", desc: "Approve KYC and badges" },
    { to: "/admin/reports", title: "Reports", desc: "Abuse and dispute reports" },
    { to: "/admin/audit", title: "Audit log", desc: "Every moderation action with timestamp" }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="Platform moderation & analytics." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Users" value={q.data?.users} />
        <Stat label="Organizations" value={q.data?.organizations} />
        <Stat label="Opportunities" value={q.data?.opportunities} />
        <Stat label="Applications" value={q.data?.applications} />
        <Stat label="Open reports" value={q.data?.open_reports} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="card card-body hover:shadow">
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm text-slate-600">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="card card-body">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}
