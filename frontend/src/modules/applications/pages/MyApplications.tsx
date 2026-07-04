import { useState } from "react";
import { Link } from "react-router-dom";
import { useMyApplications } from "../../../hooks";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { PageHeader, Spinner, EmptyState, StatusPill } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { humanizeError } from "../../../api/client";
import type { Application, ApplicationStatus } from "../../../models";

const STATUS_TABS: { id: string; label: string }[] = [
  { id: "all",         label: "All" },
  { id: "pending",     label: "Pending" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "selected",    label: "Selected" },
  { id: "rejected",    label: "Rejected" },
  { id: "withdrawn",   label: "Withdrawn" },
];

const STATUS_EMPTY: Record<string, { title: string; hint: string }> = {
  all:         { title: "No applications yet",     hint: "Find an opportunity and apply to start tracking your progress." },
  pending:     { title: "No pending applications", hint: "Applications awaiting club review will appear here." },
  shortlisted: { title: "No shortlisted applications", hint: "Clubs will shortlist you when you advance past the first stage." },
  selected:    { title: "No selections yet",       hint: "Congratulations — selected applications will appear here." },
  rejected:    { title: "No rejections",           hint: "Rejected applications will appear here." },
  withdrawn:   { title: "No withdrawn applications", hint: "Applications you withdraw will appear here." },
};

const STATUS_BADGE_COLOR: Record<ApplicationStatus, string> = {
  pending:     "bg-amber-100 text-amber-800",
  shortlisted: "bg-blue-100 text-blue-800",
  selected:    "bg-emerald-100 text-emerald-800",
  rejected:    "bg-red-100 text-red-800",
  withdrawn:   "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`font-mononum text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_BADGE_COLOR[status]}`}>
      {status}
    </span>
  );
}

function WithdrawConfirm({
  app,
  onConfirm,
  onCancel,
  isPending,
  error,
}: {
  app: Application;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-70 leading-relaxed">
        Are you sure you want to withdraw your application for{" "}
        <span className="font-semibold text-ink">{app.opportunity_title}</span>?
        This action cannot be undone.
      </p>
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
      )}
      <div className="flex gap-3">
        <button
          className="btn-danger flex-1 min-h-[44px]"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? "Withdrawing…" : "Confirm withdrawal"}
        </button>
        <button className="btn-secondary min-h-[44px]" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ApplicationCard({
  app,
  onWithdraw,
}: {
  app: Application;
  onWithdraw: (app: Application) => void;
}) {
  const canWithdraw = app.status === "pending" || app.status === "shortlisted";
  const rejectionReason = app.rejection_reason ?? (app.history as any[])?.find((h) => h.status === "rejected")?.reason;

  return (
    <div className="panel p-4 lg:p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {app.opportunity_sport && (
              <span className="badge capitalize">{app.opportunity_sport}</span>
            )}
            {app.opportunity_type && (
              <span className="badge capitalize">{app.opportunity_type}</span>
            )}
            <StatusBadge status={app.status} />
          </div>
          <Link
            to={`/opportunities/${app.opportunity_id}`}
            className="font-disp text-lg leading-tight hover:text-brand-500 transition block"
          >
            {app.opportunity_title ?? "Opportunity"}
          </Link>
          {app.org_name && (
            <div className="lab mt-0.5">{app.org_name}</div>
          )}
        </div>
      </div>

      {/* Applied date */}
      <div className="text-[12px] text-ink-sub">
        Applied {new Date(app.applied_at).toLocaleDateString()}
        {app.updated_at !== app.applied_at && (
          <> · Updated {new Date(app.updated_at).toLocaleDateString()}</>
        )}
      </div>

      {/* Contextual messages */}
      {app.status === "shortlisted" && (
        <div className="rounded px-3 py-2.5 text-[13px] text-blue-900 leading-snug" style={{ background: "#E2EAF8" }}>
          <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-1.5">Shortlisted ·</span>
          Awaiting the club's next decision — you may be invited to a trial or interview.
        </div>
      )}
      {app.status === "selected" && (
        <div className="rounded px-3 py-2.5 text-[13px] text-emerald-900 leading-snug" style={{ background: "#E2F0E8" }}>
          <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-1.5">Selected ·</span>
          Congratulations! Contact the club via Messages to discuss next steps.
        </div>
      )}
      {app.status === "rejected" && rejectionReason && (
        <div className="rounded px-3 py-2.5 text-[13px] text-red-900 leading-snug" style={{ background: "#F8E3E0" }}>
          <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-1.5">Reason ·</span>
          {rejectionReason}
        </div>
      )}

      {/* Actions */}
      {canWithdraw && (
        <div className="flex justify-end pt-1">
          <button
            className="btn-ghost text-[12.5px] min-h-[44px]"
            onClick={() => onWithdraw(app)}
          >
            Withdraw
          </button>
        </div>
      )}
    </div>
  );
}

export default function MyApplications() {
  const { list, withdraw } = useMyApplications();
  const [activeTab, setActiveTab] = useState("all");
  const [withdrawTarget, setWithdrawTarget] = useState<Application | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  function handleWithdrawClick(app: Application) {
    setWithdrawTarget(app);
    setWithdrawError(null);
  }

  function handleWithdrawConfirm() {
    if (!withdrawTarget) return;
    withdraw.mutate(withdrawTarget.id, {
      onSuccess: () => setWithdrawTarget(null),
      onError: (err) => setWithdrawError(humanizeError(err)),
    });
  }

  if (list.isLoading) {
    return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  }

  const apps: Application[] = list.data ?? [];

  const tabCounts = STATUS_TABS.reduce<Record<string, number>>((acc, tab) => {
    if (tab.id === "all") acc[tab.id] = apps.length;
    else acc[tab.id] = apps.filter((a) => a.status === tab.id).length;
    return acc;
  }, {});

  const filtered = activeTab === "all"
    ? apps
    : apps.filter((a) => a.status === activeTab);

  const emptyState = STATUS_EMPTY[activeTab] ?? STATUS_EMPTY.all;

  return (
    <div className="max-w-4xl space-y-5">
      <BackButton />
      <PageHeader
        title="My applications"
        subtitle="Track every application from submission to selection"
        sticky
        action={
          <Link to="/opportunities" className="btn-secondary min-h-[44px] flex items-center">
            Browse opportunities →
          </Link>
        }
      />

      {!apps.length ? (
        <EmptyState
          title={emptyState.title}
          hint={emptyState.hint}
          action={<Link to="/opportunities" className="btn-accent min-h-[44px] inline-flex items-center">Browse opportunities</Link>}
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {[
              { label: "Pending",     count: tabCounts.pending,     color: "#B6791E" },
              { label: "Shortlisted", count: tabCounts.shortlisted, color: "#2B66C9" },
              { label: "Selected",    count: tabCounts.selected,    color: "#2E7D52" },
              { label: "Rejected",    count: tabCounts.rejected,    color: "#C0392B" },
              { label: "Withdrawn",   count: tabCounts.withdrawn,   color: "#9A9286" },
            ].map(({ label, count, color }) => (
              <div key={label} className="panel px-3 py-3" style={{ borderTop: `2px solid ${color}` }}>
                <div className="font-disp text-2xl" style={{ color }}>{count}</div>
                <div className="lab mt-1 text-[10px]">{label}</div>
              </div>
            ))}
          </div>

          {/* Status filter tabs — horizontally scrollable */}
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="flex gap-0 border-b border-hair min-w-max lg:min-w-0">
              {STATUS_TABS.map((tab) => {
                const count = tabCounts[tab.id] ?? 0;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`font-mononum text-[11.5px] tracking-[0.05em] px-4 py-2.5 border-b-2 -mb-px transition whitespace-nowrap min-h-[44px] ${
                      isActive
                        ? "border-brand-500 text-ink font-semibold"
                        : "border-transparent text-ink-sub hover:text-ink"
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`ml-1.5 text-[10px] ${isActive ? "text-brand-500" : "text-ink-faint"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Applications grid */}
          {!filtered.length ? (
            <EmptyState
              title={emptyState.title}
              hint={emptyState.hint}
              action={
                <Link to="/opportunities" className="btn-secondary min-h-[44px] inline-flex items-center">
                  Browse opportunities
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((app) => (
                <ApplicationCard key={app.id} app={app} onWithdraw={handleWithdrawClick} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Withdraw confirmation — MobileDrawer on mobile, inline modal on desktop */}
      {withdrawTarget && (
        <>
          {/* Mobile: MobileDrawer */}
          <MobileDrawer
            isOpen={!!withdrawTarget}
            onClose={() => setWithdrawTarget(null)}
            title="Withdraw application"
          >
            <WithdrawConfirm
              app={withdrawTarget}
              onConfirm={handleWithdrawConfirm}
              onCancel={() => setWithdrawTarget(null)}
              isPending={withdraw.isPending}
              error={withdrawError}
            />
          </MobileDrawer>

          {/* Desktop: overlay modal */}
          <div
            className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-4"
            style={{ background: "rgba(20,17,13,0.55)" }}
            onClick={(e) => e.target === e.currentTarget && setWithdrawTarget(null)}
          >
            <div className="panel w-full max-w-md p-6 animate-popin">
              <h3 className="font-disp text-xl mb-4">Withdraw application</h3>
              <WithdrawConfirm
                app={withdrawTarget}
                onConfirm={handleWithdrawConfirm}
                onCancel={() => setWithdrawTarget(null)}
                isPending={withdraw.isPending}
                error={withdrawError}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
