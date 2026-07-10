import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApplicants } from "../../../hooks";
import { useAuthStore } from "../../../store/auth";
import { hasRole } from "../../../utils/roles";
import { PageHeader, Spinner, EmptyState, StatusPill, Avatar } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { MapPin, Calendar, Users } from "lucide-react";
import { humanizeError } from "../../../api/client";
import type { Application } from "../../../models";

type ActionStatus = "shortlisted" | "selected" | "rejected";

const PIPELINE_STATUSES = ["pending", "shortlisted", "selected", "rejected"] as const;

const STATUS_COLORS: Record<string, string> = {
  pending:     "#B6791E",
  shortlisted: "#2B66C9",
  selected:    "#2E7D52",
  rejected:    "#C0392B",
  withdrawn:   "#9A9286",
};

const STATUS_LABELS: Record<string, string> = {
  pending:     "Awaiting review",
  shortlisted: "Shortlisted",
  selected:    "Selected",
  rejected:    "Rejected / Withdrawn",
};

// ── Confirm dialog (desktop modal & mobile inline) ───────────────────────────
function ConfirmAction({
  action,
  applicantName,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  isPending,
  error,
}: {
  action: ActionStatus;
  applicantName: string;
  reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const isReject = action === "rejected";
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-ink-70">
        {isReject
          ? `Reject ${applicantName}'s application?`
          : `Select ${applicantName} for this opportunity?`}
      </p>
      {isReject && (
        <textarea
          className="input"
          rows={2}
          placeholder="Reason for rejection (optional — shared with applicant)"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
      )}
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
      )}
      <div className="flex gap-2">
        <button
          className={`min-h-[44px] flex-1 ${isReject ? "btn-danger" : "btn-accent"}`}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending
            ? (isReject ? "Rejecting…" : "Selecting…")
            : (isReject ? "Confirm rejection" : "Confirm selection")}
        </button>
        <button className="btn-secondary min-h-[44px]" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Single applicant card ─────────────────────────────────────────────────────
function ApplicantCard({
  app,
  vacanciesLeft,
  canAct,
  isPending,
  onAction,
}: {
  app: Application;
  vacanciesLeft: number | null;
  canAct: boolean;
  isPending: boolean;
  onAction: (id: string, status: ActionStatus) => void;
}) {
  const athleteData = app.applicant?.athlete_data as { primary_sport?: string; primary_position?: string } | null;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={app.applicant_name ?? "?"} size={44} />
        <div className="flex-1 min-w-0">
          <Link
            to={`/profile/${app.applicant_user_id}`}
            className="font-disp text-base hover:text-brand-500 transition block leading-tight"
          >
            {app.applicant_name ?? "Applicant"}
          </Link>
          {(athleteData?.primary_sport || athleteData?.primary_position) && (
            <div className="lab mt-0.5 text-[11px] capitalize">
              {[athleteData.primary_sport, athleteData.primary_position].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="lab mt-0.5 text-[11px]">
            Applied {new Date(app.applied_at).toLocaleDateString()}
          </div>
        </div>
        <StatusPill status={app.status} />
      </div>

      {canAct && app.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <button
            className="btn-accent flex-1 text-[12.5px] min-h-[44px]"
            disabled={isPending}
            onClick={() => onAction(app.id, "shortlisted")}
          >
            Shortlist →
          </button>
          <button
            className="btn-secondary text-[12.5px] min-h-[44px]"
            disabled={isPending}
            onClick={() => onAction(app.id, "rejected")}
          >
            Reject
          </button>
        </div>
      )}
      {canAct && app.status === "shortlisted" && (
        <div className="flex gap-2 pt-1">
          <button
            className="btn-accent flex-1 text-[12.5px] min-h-[44px]"
            disabled={isPending || (vacanciesLeft !== null && vacanciesLeft <= 0)}
            title={vacanciesLeft !== null && vacanciesLeft <= 0 ? "All vacancies filled" : undefined}
            onClick={() => onAction(app.id, "selected")}
          >
            {vacanciesLeft !== null && vacanciesLeft <= 0 ? "No vacancies" : "Select ✓"}
          </button>
          <button
            className="btn-secondary text-[12.5px] min-h-[44px]"
            disabled={isPending}
            onClick={() => onAction(app.id, "rejected")}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ── Desktop Kanban board ──────────────────────────────────────────────────────
function KanbanBoard({
  apps,
  vacanciesLeft,
  canAct,
  isPending,
  onAction,
}: {
  apps: Application[];
  vacanciesLeft: number | null;
  canAct: boolean;
  isPending: boolean;
  onAction: (id: string, status: ActionStatus) => void;
}) {
  const columns = PIPELINE_STATUSES.map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    color: STATUS_COLORS[s],
    items: apps.filter((a) => {
      if (s === "rejected") return a.status === "rejected" || a.status === "withdrawn";
      return a.status === s;
    }),
  }));

  return (
    <div className="grid grid-cols-4 gap-3 min-h-[300px]">
      {columns.map(({ status, label, color, items }) => (
        <div key={status} className="space-y-2">
          <div
            className="panel px-3 py-2 flex items-center justify-between"
            style={{ borderTop: `2px solid ${color}` }}
          >
            <span className="font-mononum text-[10.5px] uppercase tracking-[0.06em]" style={{ color }}>
              {label}
            </span>
            <span className="font-disp text-lg" style={{ color }}>{items.length}</span>
          </div>
          <div className="space-y-2">
            {items.map((app) => (
              <ApplicantCard
                key={app.id}
                app={app}
                vacanciesLeft={vacanciesLeft}
                canAct={canAct}
                isPending={isPending}
                onAction={onAction}
              />
            ))}
            {!items.length && (
              <div className="panel p-4 text-center text-[12px] text-ink-faint">Empty</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Applicants() {
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState("all");
  const [pendingAction, setPendingAction] = useState<{ id: string; status: ActionStatus; name: string } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { opportunity: oppQ, applicants: q, updateStatus: m } = useApplicants(id);

  const canAct = hasRole(user?.role ?? "", "club", "organizer");

  function handleAction(appId: string, status: ActionStatus) {
    const app = q.data?.find((a: Application) => a.id === appId);
    setPendingAction({ id: appId, status, name: app?.applicant_name ?? "applicant" });
    setActionReason("");
    setActionError(null);
  }

  function handleConfirm() {
    if (!pendingAction) return;
    m.mutate(
      { id: pendingAction.id, status: pendingAction.status, reason: actionReason || undefined },
      {
        onSuccess: () => {
          setPendingAction(null);
          setActionReason("");
        },
        onError: (err) => setActionError(humanizeError(err)),
      }
    );
  }

  if (q.isLoading) {
    return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  }

  const apps: Application[] = q.data ?? [];
  const opp = oppQ.data;

  const counts = {
    all:         apps.length,
    pending:     apps.filter((a) => a.status === "pending").length,
    shortlisted: apps.filter((a) => a.status === "shortlisted").length,
    selected:    apps.filter((a) => a.status === "selected").length,
    rejected:    apps.filter((a) => a.status === "rejected" || a.status === "withdrawn").length,
  };

  const vacanciesLeft = opp?.vacancies != null
    ? Math.max(opp.vacancies - counts.selected, 0)
    : null;

  const deadlineDays = opp?.application_deadline
    ? Math.ceil((new Date(opp.application_deadline).getTime() - Date.now()) / 86400_000)
    : null;

  const mobileTabs = [
    { id: "all",         label: `All ${counts.all}` },
    { id: "pending",     label: `New ${counts.pending}` },
    { id: "shortlisted", label: `Shortlisted ${counts.shortlisted}` },
    { id: "selected",    label: `Selected ${counts.selected}` },
    { id: "rejected",    label: `Rejected ${counts.rejected}` },
  ];

  const mobileFiltered = activeTab === "all" ? apps
    : activeTab === "rejected" ? apps.filter((a) => a.status === "rejected" || a.status === "withdrawn")
    : apps.filter((a) => a.status === activeTab);

  return (
    <div className="space-y-5">
      <BackButton to={`/opportunities/${id}`} label="Opportunity" className="mb-1" />
      <PageHeader
        title={opp ? opp.title : "Applicant review"}
        subtitle="Post → Review → Select"
        sticky
        action={
          <Link to={`/opportunities/${id}`} className="btn-ghost text-[12.5px] min-h-[44px] flex items-center">
            View listing →
          </Link>
        }
      />

      {/* Opportunity context banner */}
      {opp && (
        <div className="panel p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="badge capitalize">{opp.type}</span>
            <span className="badge">{opp.sport}</span>
            <StatusPill status={opp.status} />
          </div>
          <span className="font-semibold text-ink text-[13px]">{opp.org_name}</span>
          {(opp.city || opp.country) && (
            <div className="flex items-center gap-1.5 text-[13px] text-ink-sub">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {[opp.city, opp.state, opp.country].filter(Boolean).join(", ")}
            </div>
          )}
          {opp.application_deadline && (
            <div
              className="flex items-center gap-1.5 text-[13px]"
              style={{ color: deadlineDays !== null && deadlineDays <= 5 ? "#FA4D14" : "#726B60" }}
            >
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              Deadline: {new Date(opp.application_deadline).toLocaleDateString()}
              {deadlineDays !== null && (
                <span className="font-mononum text-[11px]">
                  ({deadlineDays < 0 ? "closed" : deadlineDays === 0 ? "today" : `${deadlineDays}d left`})
                </span>
              )}
            </div>
          )}
          {opp.vacancies && (
            <div className="flex items-center gap-1.5 text-[13px] text-ink-sub ml-auto">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              {counts.selected} / {opp.vacancies} filled
              {vacanciesLeft !== null && (
                <span className="ml-1 font-mononum text-[11px]">({vacanciesLeft} left)</span>
              )}
            </div>
          )}
        </div>
      )}

      {!apps.length ? (
        <EmptyState title="No applications yet" hint="Applications will appear here once candidates apply." />
      ) : (
        <>
          {/* Desktop: Kanban board */}
          <div className="hidden lg:block">
            <KanbanBoard
              apps={apps}
              vacanciesLeft={vacanciesLeft}
              canAct={canAct}
              isPending={m.isPending}
              onAction={handleAction}
            />
          </div>

          {/* Mobile: tab-based list */}
          <div className="lg:hidden space-y-4">
            {/* Status tabs — horizontally scrollable */}
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex gap-0 border-b border-hair min-w-max">
                {mobileTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`font-mononum text-[11px] tracking-[0.05em] px-4 py-2.5 border-b-2 -mb-px transition whitespace-nowrap min-h-[44px] ${
                      activeTab === tab.id
                        ? "border-brand-500 text-ink font-semibold"
                        : "border-transparent text-ink-sub hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {!mobileFiltered.length ? (
              <EmptyState title="No applicants in this stage" hint="Move applicants through the pipeline to populate this view." />
            ) : (
              <div className="space-y-3">
                {mobileFiltered.map((app) => (
                  <ApplicantCard
                    key={app.id}
                    app={app}
                    vacanciesLeft={vacanciesLeft}
                    canAct={canAct}
                    isPending={m.isPending}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation dialog (desktop modal) */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-[calc(56px+env(safe-area-inset-bottom)+16px)] sm:pb-4"
          style={{ background: "rgba(20,17,13,0.55)" }}
          onClick={(e) => e.target === e.currentTarget && setPendingAction(null)}
        >
          <div className="panel w-full max-w-sm p-6 animate-popin rounded-b-none sm:rounded-b-lg">
            <h3 className="font-disp text-lg mb-4">
              {pendingAction.status === "rejected" ? "Reject applicant" : "Select applicant"}
            </h3>
            <ConfirmAction
              action={pendingAction.status}
              applicantName={pendingAction.name}
              reason={actionReason}
              onReasonChange={setActionReason}
              onConfirm={handleConfirm}
              onCancel={() => setPendingAction(null)}
              isPending={m.isPending}
              error={actionError}
            />
          </div>
        </div>
      )}
    </div>
  );
}
