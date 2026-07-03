import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader, Spinner } from "../../components/UI";
import { queryKeys } from "../../hooks/queryKeys";
import { Users, Building2, Briefcase, FileText, AlertTriangle, ShieldCheck, ClipboardList, Activity } from "lucide-react";

export default function Admin() {
  const q = useQuery({
    queryKey: queryKeys.adminAnalytics(),
    queryFn: async () => (await api.get("/admin/analytics")).data
  });

  const sections = [
    { to: "/admin/users", icon: <Users className="h-5 w-5" />, title: "Users", desc: "View, edit profiles and moderate accounts", color: "text-blue-600" },
    { to: "/admin/opportunities", icon: <Briefcase className="h-5 w-5" />, title: "Opportunities", desc: "Manage all tournaments, trials and listings", color: "text-green-600" },
    { to: "/admin/organizations", icon: <Building2 className="h-5 w-5" />, title: "Organizations", desc: "View and edit all clubs and academies", color: "text-purple-600" },
    { to: "/admin/applications", icon: <ClipboardList className="h-5 w-5" />, title: "Applications", desc: "Override application status on behalf of users", color: "text-orange-600" },
    { to: "/admin/verifications", icon: <ShieldCheck className="h-5 w-5" />, title: "Verifications", desc: "Approve KYC and badges", color: "text-brand-600", badge: q.data?.pending_verifications },
    { to: "/admin/reports", icon: <AlertTriangle className="h-5 w-5" />, title: "Reports", desc: "Abuse and dispute reports", color: "text-red-600", badge: q.data?.open_reports },
    { to: "/admin/audit", icon: <FileText className="h-5 w-5" />, title: "Audit log", desc: "Every moderation action with timestamp", color: "text-slate-600" },
    { to: "/admin/scoring", icon: <Activity className="h-5 w-5" />, title: "Live Scoring", desc: "All matches — live, upcoming, results. View scorecards and manage via scoring console.", color: "text-red-600" }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="Platform moderation & analytics." />

      {q.isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Users" value={q.data?.users} />
          <StatCard label="Orgs" value={q.data?.organizations} />
          <StatCard label="Opps" value={q.data?.opportunities} />
          <StatCard label="Applications" value={q.data?.applications} />
          <StatCard label="Open Reports" value={q.data?.open_reports} urgent />
          <StatCard label="Pending Verifs" value={q.data?.pending_verifications} urgent />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="card card-body hover:shadow flex items-start gap-3 min-h-[64px]">
            <span className={`mt-0.5 flex-shrink-0 ${s.color}`}>{s.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{s.title}</h3>
                {s.badge != null && s.badge > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                    {s.badge > 99 ? "99+" : s.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, urgent }: { label: string; value?: number; urgent?: boolean }) {
  return (
    <div className={`card card-body ${urgent && value ? "border-red-200 bg-red-50" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${urgent && value ? "text-red-700" : ""}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
