import { useState } from "react";
import { useAuthStore } from "../../../store/auth";
import { useDocAccessRequests } from "../hooks/useDocumentAccess";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { PageHeader, Spinner, EmptyState, Avatar, Tabs } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { humanizeError } from "../../../api/client";
import type { DocumentAccessRequest, DocAccessStatus } from "../../../models";

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "revoked", label: "Revoked" },
];

const STATUS_COLOR: Record<DocAccessStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  revoked: "bg-gray-100 text-gray-600",
};

function ConfirmAction({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  isPending,
  error,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-70 leading-relaxed">{body}</p>
      {error && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
      <div className="flex gap-3">
        <button
          className={`${danger ? "btn-danger" : "btn-accent"} flex-1 min-h-[44px]`}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? "Working…" : confirmLabel}
        </button>
        <button className="btn-secondary min-h-[44px]" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}

function RequestCard({
  req,
  onAction,
}: {
  req: DocumentAccessRequest;
  onAction: (req: DocumentAccessRequest, status: "approved" | "rejected" | "revoked") => void;
}) {
  return (
    <div className="panel p-4 lg:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={req.requester?.full_name} src={req.requester?.profile_photo_url} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="badge capitalize">{req.requester?.role}</span>
            <span className={`font-mononum text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_COLOR[req.status]}`}>
              {req.status}
            </span>
          </div>
          <div className="font-disp text-lg leading-tight">{req.requester?.full_name ?? "Unknown user"}</div>
        </div>
      </div>

      <div className="text-[12px] text-ink-sub">
        Requested {new Date(req.requested_at).toLocaleDateString()}
      </div>

      {req.reason && (
        <div className="rounded px-3 py-2.5 text-[13px] text-ink-70 leading-snug bg-fill">
          <span className="font-mononum text-[10px] uppercase tracking-[0.08em] mr-1.5">Reason ·</span>
          {req.reason}
        </div>
      )}

      {req.status === "pending" && (
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-danger text-[12.5px] min-h-[44px] px-4" onClick={() => onAction(req, "rejected")}>
            Reject
          </button>
          <button className="btn-accent text-[12.5px] min-h-[44px] px-4" onClick={() => onAction(req, "approved")}>
            Approve
          </button>
        </div>
      )}
      {req.status === "approved" && (
        <div className="flex justify-end pt-1">
          <button className="btn-danger text-[12.5px] min-h-[44px] px-4" onClick={() => onAction(req, "revoked")}>
            Revoke access
          </button>
        </div>
      )}
    </div>
  );
}

export default function DocumentAccessRequests() {
  const { user: me } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>("pending");
  const { list, decide } = useDocAccessRequests(me?.id ?? "", activeTab);
  const [target, setTarget] = useState<{ req: DocumentAccessRequest; status: "approved" | "rejected" | "revoked" } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleAction(req: DocumentAccessRequest, status: "approved" | "rejected" | "revoked") {
    setTarget({ req, status });
    setActionError(null);
  }

  function handleConfirm() {
    if (!target) return;
    decide.mutate(
      { id: target.req.id, status: target.status },
      {
        onSuccess: () => setTarget(null),
        onError: (err) => setActionError(humanizeError(err)),
      }
    );
  }

  const items = list.data ?? [];

  const ACTION_COPY: Record<"approved" | "rejected" | "revoked", { title: string; body: string; label: string; danger?: boolean }> = {
    approved: {
      title: "Approve access",
      body: `Grant ${target?.req.requester?.full_name ?? "this user"} access to all your documents?`,
      label: "Approve",
    },
    rejected: {
      title: "Reject request",
      body: `Decline ${target?.req.requester?.full_name ?? "this user"}'s document access request?`,
      label: "Reject",
      danger: true,
    },
    revoked: {
      title: "Revoke access",
      body: `Revoke ${target?.req.requester?.full_name ?? "this user"}'s access to your documents? They will need to request again.`,
      label: "Revoke",
      danger: true,
    },
  };

  return (
    <div className="max-w-4xl space-y-5">
      <BackButton />
      <PageHeader title="Document access requests" subtitle="Review who wants access to your profile documents" sticky />

      <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        <Tabs tabs={STATUS_TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {list.isLoading ? (
        <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>
      ) : !items.length ? (
        <EmptyState
          title={`No ${activeTab} requests`}
          hint="Requests from clubs, scouts, and organizers will appear here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((req) => (
            <RequestCard key={req.id} req={req} onAction={handleAction} />
          ))}
        </div>
      )}

      {target && (
        <>
          <MobileDrawer isOpen={!!target} onClose={() => setTarget(null)} title={ACTION_COPY[target.status].title}>
            <ConfirmAction
              title={ACTION_COPY[target.status].title}
              body={ACTION_COPY[target.status].body}
              confirmLabel={ACTION_COPY[target.status].label}
              danger={ACTION_COPY[target.status].danger}
              onConfirm={handleConfirm}
              onCancel={() => setTarget(null)}
              isPending={decide.isPending}
              error={actionError}
            />
          </MobileDrawer>

          <div
            className="hidden lg:flex fixed inset-0 z-50 items-center justify-center p-4"
            style={{ background: "rgba(20,17,13,0.55)" }}
            onClick={(e) => e.target === e.currentTarget && setTarget(null)}
          >
            <div className="panel w-full max-w-md p-6 animate-popin">
              <h3 className="font-disp text-xl mb-4">{ACTION_COPY[target.status].title}</h3>
              <ConfirmAction
                title={ACTION_COPY[target.status].title}
                body={ACTION_COPY[target.status].body}
                confirmLabel={ACTION_COPY[target.status].label}
                danger={ACTION_COPY[target.status].danger}
                onConfirm={handleConfirm}
                onCancel={() => setTarget(null)}
                isPending={decide.isPending}
                error={actionError}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
