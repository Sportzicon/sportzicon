import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, EmptyState, StatusPill, Avatar, Tabs } from "../components/UI";
import { MapPin, Calendar, Users } from "lucide-react";
import type { Application } from "../types";

const NEXT: Record<string, string[]> = {
  pending: ["shortlisted", "rejected"],
  shortlisted: ["selected", "rejected"],
  selected: [],
  rejected: [],
  withdrawn: []
};

const STAGE_ORDER = ["pending", "shortlisted", "selected"];

function StageTrack({ status }: { status: string }) {
  const isTerminal = status === "rejected" || status === "withdrawn";
  const idx = STAGE_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {STAGE_ORDER.map((s, i) => {
        const reached = !isTerminal && idx >= i;
        const isBad = isTerminal && i === 2;
        const color = isBad ? (status === "rejected" ? "#C0392B" : "#726B60") : reached ? "#FA4D14" : "rgba(20,17,13,0.13)";
        return (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: reached || isBad ? color : "transparent", border: `1.5px solid ${color}` }} />
              <span className="font-mononum text-[10px] uppercase tracking-[0.04em]" style={{ color: reached || isBad ? "#14110D" : "#9A9286" }}>
                {i === 2 && isTerminal ? (status === "rejected" ? "Not selected" : "Withdrawn") : ["Applied", "Shortlisted", "Selected"][i]}
              </span>
            </div>
            {i < 2 && <span className="h-px w-6 mx-2" style={{ background: !isTerminal && idx > i ? "#FA4D14" : "rgba(20,17,13,0.13)" }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function Applicants() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["applicants", id],
    queryFn: async () => (await api.get<{ items: Application[] }>(`/opportunities/${id}/applicants`)).data.items
  });

  // Also fetch opportunity for vacancy info
  const oppQ = useQuery({
    queryKey: ["opp", id],
    queryFn: async () => (await api.get(`/opportunities/${id}`)).data.opportunity
  });

  const m = useMutation({
    mutationFn: async (vars: { id: string; status: string; reason?: string }) =>
      api.patch(`/applications/${vars.id}/status`, { status: vars.status, reason: vars.reason }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["applicants", id] });
      qc.invalidateQueries({ queryKey: ["opp", id] });
      // Invalidate the applicant's profile cache so availability shows immediately
      if (vars.status === "selected" || vars.status === "rejected") {
        const app = q.data?.find((a) => a.id === vars.id);
        if (app?.applicant_user_id) {
          qc.invalidateQueries({ queryKey: ["user", app.applicant_user_id] });
        }
      }
      setRejectingId(null); setReason("");
    }
  });

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  const apps = q.data ?? [];
  const counts = {
    all: apps.length,
    pending: apps.filter((a) => a.status === "pending").length,
    shortlisted: apps.filter((a) => a.status === "shortlisted").length,
    selected: apps.filter((a) => a.status === "selected").length,
    rejected: apps.filter((a) => a.status === "rejected" || a.status === "withdrawn").length
  };

  const opp = oppQ.data;
  const vacanciesLeft = opp?.vacancies ? Math.max(opp.vacancies - counts.selected, 0) : null;

  const tabs = [
    { id: "all", label: `All ${counts.all}` },
    { id: "pending", label: `New ${counts.pending}` },
    { id: "shortlisted", label: `Shortlisted ${counts.shortlisted}` },
    { id: "selected", label: `Selected ${counts.selected}` },
    { id: "rejected", label: `Rejected ${counts.rejected}` }
  ];

  const filtered = activeTab === "all" ? apps
    : activeTab === "rejected" ? apps.filter((a) => a.status === "rejected" || a.status === "withdrawn")
    : apps.filter((a) => a.status === activeTab);

  const deadlineDays = opp?.application_deadline
    ? Math.ceil((new Date(opp.application_deadline).getTime() - Date.now()) / 86400_000)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={opp ? opp.title : "Applicant review"}
        subtitle="Post → Review → Select"
        action={
          <Link to={`/opportunities/${id}`} className="btn-ghost text-[12.5px]">
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
          <div className="flex items-center gap-1.5 text-[13px] text-ink-70">
            <span className="font-semibold text-ink">{opp.org_name}</span>
          </div>
          {(opp.city || opp.country) && (
            <div className="flex items-center gap-1.5 text-[13px] text-ink-sub">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {[opp.city, opp.state, opp.country].filter(Boolean).join(", ")}
            </div>
          )}
          {opp.application_deadline && (
            <div className="flex items-center gap-1.5 text-[13px]"
              style={{ color: deadlineDays !== null && deadlineDays <= 5 ? "#FA4D14" : "#726B60" }}>
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
              {opp.vacancies_filled ?? counts.selected} / {opp.vacancies} filled
            </div>
          )}
        </div>
      )}

      {!apps.length ? (
        <EmptyState title="No applications yet" hint="Applications will appear here once candidates apply." />
      ) : (
        <>
          {/* Pipeline tracker — zip 2 pattern */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { k: "Awaiting review", v: counts.pending, c: "#B6791E" },
              { k: "Shortlisted", v: counts.shortlisted, c: "#2B66C9" },
              { k: "Selected", v: counts.selected, c: "#2E7D52" },
              { k: "Rejected", v: counts.rejected, c: "#C0392B" },
              { k: `Vacancies${opp?.vacancies ? ` / ${opp.vacancies}` : ""}`, v: vacanciesLeft ?? "—", c: "#14110D" }
            ].map(({ k, v, c }) => (
              <div key={k} className="panel px-4 py-3.5" style={{ borderTop: `2px solid ${c}` }}>
                <div className="font-disp text-3xl" style={{ color: c }}>{v}</div>
                <div className="lab mt-1.5">{k}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs — zip 2 pattern */}
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

          {!filtered.length ? (
            <EmptyState title="No applicants in this stage" hint="Move applicants through the pipeline to populate this view." />
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => (
                <div key={a.id} className="panel p-5">
                  {/* applicant header */}
                  <div className="flex gap-3 items-start">
                    <Avatar name={a.applicant_name} size={46} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/profile/${a.applicant_user_id}`} className="font-disp text-xl hover:text-brand-500 transition">
                          {a.applicant_name}
                        </Link>
                      </div>
                      <div className="lab mt-1">Applied {new Date(a.applied_at).toLocaleDateString()}</div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>

                  {/* stage track */}
                  <div className="mt-4 py-3.5 border-y border-hairsoft">
                    <StageTrack status={a.status} />
                  </div>

                  {/* action row — zip 2 pattern: Profile | Cover note ▾ | actions */}
                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                    <div className="flex gap-2">
                      <Link to={`/profile/${a.applicant_user_id}`} className="btn-ghost text-[12px]">
                        Profile
                      </Link>
                      {a.cover_note && (
                        <button
                          onClick={() => setExpandedNoteId(expandedNoteId === a.id ? null : a.id)}
                          className="btn-ghost text-[12px]"
                        >
                          {expandedNoteId === a.id ? "Hide note ▴" : "Cover note ▾"}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {NEXT[a.status]?.map((s) =>
                        s === "rejected" ? (
                          <button key={s} className="btn-secondary text-[12.5px]" onClick={() => setRejectingId(a.id)}>
                            Reject
                          </button>
                        ) : s === "selected" && vacanciesLeft !== null && vacanciesLeft <= 0 ? (
                          // Gap 10 — vacancy guard
                          <button key={s} className="btn-secondary text-[12.5px]" disabled title="All vacancies filled">
                            All vacancies filled
                          </button>
                        ) : (
                          <button key={s} className="btn-accent text-[12.5px]" disabled={m.isPending}
                            onClick={() => m.mutate({ id: a.id, status: s })}>
                            {s === "shortlisted" ? "Shortlist →" : "Select ✓"}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* expandable cover note */}
                  {expandedNoteId === a.id && a.cover_note && (
                    <div className="mt-3 rounded bg-fill p-3 text-[13.5px] text-ink-70 leading-relaxed italic animate-fadein">
                      "{a.cover_note}"
                      {a.history?.find((h: any) => h.status === "rejected")?.reason && (
                        <div className="mt-2 not-italic text-[12px] text-red-800">
                          <span className="font-mononum text-[10px] uppercase tracking-[0.06em]">Rejected: </span>
                          {a.history?.find((h: any) => h.status === "rejected")?.reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* reject modal inline */}
                  {rejectingId === a.id && (
                    <div className="mt-3 space-y-2 animate-fadein">
                      <textarea className="input" rows={2}
                        placeholder="Reason for rejection (optional — shared with applicant)"
                        value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className="flex gap-2">
                        <button className="btn-danger" disabled={m.isPending}
                          onClick={() => m.mutate({ id: a.id, status: "rejected", reason: reason || undefined })}>
                          Confirm rejection
                        </button>
                        <button className="btn-secondary" onClick={() => { setRejectingId(null); setReason(""); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
