import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMyApplications } from "../hooks";
import { PageHeader, Spinner, EmptyState, StatusPill, Avatar, Tabs } from "../components/UI";
import type { Application } from "../models";

function StageTrack({ status }: { status: string }) {
  const order = ["pending", "shortlisted", "selected"];
  const terminalBad = status === "rejected" || status === "withdrawn";
  const idx = order.indexOf(status);
  const steps = [
    { k: "pending",     l: "Applied" },
    { k: "shortlisted", l: "Shortlisted" },
    { k: "selected",    l: terminalBad ? (status === "rejected" ? "Not selected" : "Withdrawn") : "Selected" }
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const reached  = !terminalBad && idx >= i;
        const isBadEnd = terminalBad && i === 2;
        const color    = isBadEnd
          ? status === "rejected" ? "#C0392B" : "#9A9286"
          : reached ? "#FA4D14" : "rgba(20,17,13,0.15)";
        return (
          <div key={s.k} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-[11px] h-[11px] rounded-full flex-shrink-0 border-[1.5px]"
                style={{ background: (reached || isBadEnd) ? color : "transparent", borderColor: (reached || isBadEnd) ? color : "rgba(20,17,13,0.2)" }} />
              <span className="font-mononum text-[10.5px] uppercase tracking-[0.04em]"
                style={{ color: (reached || isBadEnd) ? "#14110D" : "#9A9286" }}>{s.l}</span>
            </div>
            {i < 2 && <span className="h-[1.5px] min-w-[22px] mx-2.5 flex-shrink-0"
              style={{ background: (!terminalBad && idx > i) ? "#FA4D14" : "rgba(20,17,13,0.15)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="panel px-4 py-4">
      <div className="lab">{label}</div>
      <div className={`font-disp mt-2 text-4xl ${accent ? "text-brand-500" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function HistoryTimeline({ history }: { history: any[] }) {
  return (
    <div className="mt-4 pt-4 border-t border-hairsoft animate-fadein">
      {history.map((h: any, i: number) => (
        <div key={i} className="flex gap-3 pb-3">
          <div className="flex flex-col items-center">
            <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
            {i < history.length - 1 && <span className="w-px flex-1 bg-hair mt-1" style={{ minHeight: 18 }} />}
          </div>
          <div>
            <div className="text-[13px]">
              <span className="capitalize font-semibold text-ink">{h.status}</span>
              <span className="lab ml-2">{new Date(h.at).toLocaleDateString()} · by {h.by === "system" ? "System" : "Club"}</span>
            </div>
            {h.note && <div className="text-[12.5px] text-ink-sub mt-0.5 leading-snug">{h.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyApplications() {
  const navigate = useNavigate();
  const { list, withdraw } = useMyApplications();
  const [activeTab, setActiveTab] = useState("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (list.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  const apps: Application[] = list.data ?? [];
  const counts = {
    pending:     apps.filter((a) => a.status === "pending").length,
    shortlisted: apps.filter((a) => a.status === "shortlisted").length,
    selected:    apps.filter((a) => a.status === "selected").length,
    rejected:    apps.filter((a) => a.status === "rejected").length,
    withdrawn:   apps.filter((a) => a.status === "withdrawn").length,
  };

  const tabs = [
    { id: "active",      label: "Active" },
    { id: "all",         label: "All" },
    { id: "shortlisted", label: `Shortlisted${counts.shortlisted ? ` (${counts.shortlisted})` : ""}` },
    { id: "selected",    label: `Selected${counts.selected ? ` (${counts.selected})` : ""}` },
    { id: "closed",      label: "Closed" },
  ];

  const filtered = apps.filter((a) => {
    if (activeTab === "active")      return ["pending", "shortlisted"].includes(a.status);
    if (activeTab === "shortlisted") return a.status === "shortlisted";
    if (activeTab === "selected")    return a.status === "selected";
    if (activeTab === "closed")      return ["rejected", "withdrawn"].includes(a.status);
    return true;
  });

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="My applications" subtitle="Application tracker"
        action={<Link to="/opportunities" className="btn-secondary">Browse opportunities →</Link>} />

      {!apps.length ? (
        <EmptyState title="No applications yet"
          hint="Find an opportunity and apply to start tracking your progress here."
          action={<Link to="/opportunities" className="btn-accent">Browse opportunities</Link>} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3.5">
            <Metric label="Pending"     value={counts.pending} />
            <Metric label="Shortlisted" value={counts.shortlisted} accent />
            <Metric label="Selected"    value={counts.selected} />
          </div>

          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

          {!filtered.length ? (
            <EmptyState title="Nothing in this stage"
              hint="Applications you submit will appear here, tracked through every stage."
              action={<Link to="/opportunities" className="btn-secondary">Browse opportunities</Link>} />
          ) : (
            <div className="space-y-4">
              {filtered.map((a: Application) => {
                const isExpanded  = expandedId === a.id;
                const canWithdraw = a.status === "pending" || a.status === "shortlisted";
                const lastHistory = a.history?.[a.history.length - 1];
                return (
                  <div key={a.id} className="panel p-[18px]">
                    <div className="flex gap-4 items-start">
                      <Avatar name={a.opportunity_title} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="badge">Opportunity</span>
                          <span className="lab">Applied {new Date(a.applied_at).toLocaleDateString()} · Updated {new Date(a.updated_at).toLocaleDateString()}</span>
                        </div>
                        <Link to={`/opportunities/${a.opportunity_id}`}
                          className="font-disp text-xl leading-tight hover:text-brand-500 transition">
                          {a.opportunity_title}
                        </Link>
                      </div>
                      <StatusPill status={a.status} />
                    </div>

                    <div className="mt-4 py-3.5 border-y border-hairsoft"><StageTrack status={a.status} /></div>

                    {a.status === "shortlisted" && (
                      <div className="mt-3 px-3 py-3 rounded text-[13px] text-blue-900 leading-snug" style={{ background: "#E2EAF8" }}>
                        <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-2">Next ·</span>
                        {(lastHistory as any)?.note ?? "Awaiting the club's next decision — you may be invited to a conditioning camp or interview."}
                      </div>
                    )}
                    {a.status === "selected" && (
                      <div className="mt-3 px-3 py-3 rounded text-[13px] text-emerald-900 leading-snug" style={{ background: "#E2F0E8" }}>
                        <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-2">Selected ·</span>
                        Congratulations! Contact the club via Messages to discuss next steps.
                      </div>
                    )}
                    {a.status === "rejected" && (lastHistory as any)?.note && (
                      <div className="mt-3 px-3 py-3 rounded text-[13px] text-red-900 leading-snug" style={{ background: "#F8E3E0" }}>
                        <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-2">Reason ·</span>
                        {(lastHistory as any).note}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4">
                      <button onClick={() => setExpandedId(isExpanded ? null : a.id)} className="btn-ghost text-[12px]">
                        {isExpanded ? "Hide history ▴" : "View history ▾"}
                      </button>
                      <div className="flex gap-2">
                        {a.status === "selected" && (
                          <button className="btn-secondary text-[12.5px]" onClick={() => navigate("/messages")}>
                            Message club
                          </button>
                        )}
                        {canWithdraw && (
                          <button className="btn-ghost text-[12.5px]" disabled={withdraw.isPending}
                            onClick={() => withdraw.mutate(a.id)}>
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && a.history?.length > 0 && <HistoryTimeline history={a.history} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
