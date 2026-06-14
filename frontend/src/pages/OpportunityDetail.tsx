import { useState, useRef, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { opportunityService } from "../services";
import { humanizeError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { hasRole } from "../utils/roles";
import { useOpportunityApplication } from "../hooks/useApplications";
import { Spinner, StatusPill, SectionHead, Kicker } from "../components/UI";
import { MobileDrawer } from "../components/MobileDrawer";
import { Trash2, Pencil, MoreVertical, ChevronDown } from "lucide-react";
import { queryKeys } from "../hooks/queryKeys";
import type { Opportunity, ApplyRequest } from "../models";

const TYPE_LABELS: Record<string, string> = {
  trial: "Trial", recruitment: "Recruitment", scholarship: "Scholarship",
  tournament: "Tournament", coaching_job: "Coaching Job"
};

const APPLY_STEPS = ["Cover note", "Documents", "Review"];

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-2.5 border-b border-hairsoft last:border-0">
      <span className="lab">{label}</span>
      <span className="font-mononum text-[12.5px] text-right text-ink capitalize">{value}</span>
    </div>
  );
}

function deadlineInfo(deadline: string) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400_000);
  if (d < 0) return { text: "Closed", urgent: false, closed: true };
  if (d === 0) return { text: "Closes today", urgent: true, closed: false };
  if (d <= 5) return { text: `${d}d left`, urgent: true, closed: false };
  return { text: `${d}d left`, urgent: false, closed: false };
}

function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 lg:p-6 text-left min-h-[44px]"
      >
        <span className="font-disp text-base lg:text-lg">{title}</span>
        <ChevronDown className={`h-4 w-4 text-ink-sub transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 lg:px-6 pb-5 lg:pb-6">{children}</div>}
    </div>
  );
}

// ── 3-step Apply Modal ────────────────────────────────────────────────────────
function ApplyModal({ opp, onClose, onSuccess }: { opp: Opportunity; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [extraDocs, setExtraDocs] = useState<{ type: string; file: File }[]>([]);
  const [extraType, setExtraType] = useState("");
  const extraInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const EXTRA_DOC_TYPES = [
    "Medical Certificate", "Fitness Report", "Training Certificate",
    "Reference Letter", "Academic Transcript", "Age Proof",
    "NOC from Current Club", "Passport Copy", "Other",
  ];

  function addExtraDoc(file: File) {
    if (!extraType) return;
    setExtraDocs((prev) => [...prev, { type: extraType, file }]);
    setExtraType("");
    if (extraInputRef.current) extraInputRef.current.value = "";
  }

  function removeExtraDoc(i: number) {
    setExtraDocs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (extraDocs.length > 0) {
        const form = new FormData();
        form.append("cover_note", note);
        extraDocs.forEach((d, i) => {
          form.append(`extra_doc_type_${i}`, d.type);
          form.append(`extra_doc_file_${i}`, d.file);
        });
        await opportunityService.apply(opp.id, form);
      } else {
        await opportunityService.apply(opp.id, { cover_note: note } as ApplyRequest);
      }
      qc.invalidateQueries({ queryKey: queryKeys.myApplications() });
      onSuccess();
    } catch (e) {
      setErr(humanizeError(e));
    } finally { setBusy(false); }
  }

  function onBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(20,17,13,0.55)" }}
      onClick={onBackdrop}
    >
      <div className="panel w-full sm:max-w-[600px] max-h-[92vh] overflow-auto animate-popin rounded-b-none sm:rounded-b-lg">
        {/* modal header */}
        <div className="px-5 py-4 border-b border-hair flex items-start justify-between gap-4">
          <div>
            <Kicker>Apply — step {step + 1} of {APPLY_STEPS.length}</Kicker>
            <h3 className="font-disp text-xl mt-1">{opp.title}</h3>
          </div>
          <button onClick={onClose} className="text-[20px] text-ink-sub hover:text-ink leading-none mt-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center">×</button>
        </div>

        {/* step tabs */}
        <div className="flex gap-0 border-b border-hair px-5">
          {APPLY_STEPS.map((s, i) => (
            <button key={s}
              onClick={() => i < step && setStep(i)}
              className={`font-mononum text-[11.5px] tracking-[0.06em] px-4 py-2.5 border-b-2 -mb-px transition ${
                step === i ? "border-brand-500 text-ink font-semibold"
                : i < step ? "border-transparent text-brand-500 hover:text-ink cursor-pointer"
                : "border-transparent text-ink-faint cursor-default"
              }`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="p-5">
          {step === 0 && (
            <div className="animate-fadein">
              <label className="block">
                <span className="label">Cover note to the club *</span>
                <textarea
                  className="input"
                  rows={8}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                  placeholder="Why are you a great fit? Include your key stats, experience, and availability."
                  autoFocus
                  style={{ resize: "vertical" }}
                />
                <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">
                  {note.length} / 1000 characters
                </span>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fadein space-y-3">
              <div className="lab text-ink mb-3">Documents for this listing</div>
              {[
                { label: "Sports CV (PDF)", status: "attached", note: "Linked from your profile" },
                { label: "Government ID", status: "review", note: "Submitted via verification" },
                { label: "Coach endorsement", status: "optional", note: "Optional — adds credibility" }
              ].map((doc) => (
                <div key={doc.label} className="panel p-3.5 flex items-center gap-3">
                  <span style={{ color: doc.status === "attached" ? "#2E7D52" : doc.status === "review" ? "#B6791E" : "#9A9286", fontSize: 16 }}>
                    {doc.status === "attached" ? "✓" : doc.status === "review" ? "◔" : "○"}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-ink">{doc.label}</div>
                  </div>
                  <span className="lab text-[10.5px]"
                    style={{ color: doc.status === "attached" ? "#2E7D52" : doc.status === "review" ? "#B6791E" : "#9A9286" }}>
                    {doc.note}
                  </span>
                </div>
              ))}

              <div className="border border-dashed border-hair rounded p-4 space-y-3">
                <div className="lab text-ink text-[11px]">Additional documents (optional)</div>
                {extraDocs.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 panel p-3">
                    <span style={{ color: "#2E7D52", fontSize: 16 }}>✓</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-ink">{d.type}</div>
                      <div className="lab text-[10.5px] truncate mt-0.5">{d.file.name}</div>
                    </div>
                    <button onClick={() => removeExtraDoc(i)} className="lab text-[10.5px] text-red-500 hover:text-red-700 transition flex-shrink-0 min-h-[44px]">
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    className="input font-mononum flex-1 min-w-[180px] min-h-[44px]"
                    style={{ fontSize: 12 }}
                    value={extraType}
                    onChange={(e) => {
                      setExtraType(e.target.value);
                      if (extraInputRef.current) extraInputRef.current.value = "";
                    }}
                  >
                    <option value="">Select document type…</option>
                    {EXTRA_DOC_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label className={`flex-shrink-0 ${!extraType ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}>
                    <input
                      ref={extraInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="hidden"
                      disabled={!extraType}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) addExtraDoc(file);
                      }}
                    />
                    <span className="btn-secondary text-[11px] px-3 min-h-[44px] flex items-center whitespace-nowrap">+ Upload file</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadein space-y-4">
              <div className="panel p-4 bg-fill space-y-0">
                <DetailRow label="Opportunity" value={opp.title} />
                <DetailRow label="Organisation" value={opp.org_name} />
                <DetailRow label="Type" value={TYPE_LABELS[opp.type] ?? opp.type} />
                <DetailRow label="Sport" value={opp.sport} />
                <DetailRow label="Location" value={`${opp.city}, ${opp.country}`} />
              </div>
              <div>
                <div className="lab mb-2">Your cover note</div>
                <p className="text-[13.5px] text-ink-70 leading-relaxed bg-fill rounded p-4">{note || <em className="text-ink-faint">No cover note written.</em>}</p>
              </div>
              {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-hair flex justify-between items-center">
          <button className="btn-ghost min-h-[44px]" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          {step < APPLY_STEPS.length - 1 ? (
            <button className="btn-primary min-h-[44px]" onClick={() => setStep(step + 1)}>Continue →</button>
          ) : (
            <button className="btn-accent min-h-[44px]" onClick={submit} disabled={busy || !note.trim()}>
              {busy ? "Submitting…" : "Submit application →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile comments drawer placeholder
function CommentsDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title="Comments">
      <p className="text-sm text-ink-sub py-4">Comments coming soon.</p>
    </MobileDrawer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OpportunityDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);
  const [applyOpen, setApplyOpen] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { application: existingApp } = useOpportunityApplication(id);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = useQuery({
    queryKey: queryKeys.opportunity(id),
    queryFn: () => opportunityService.get(id)
  });

  const deleteOpp = useMutation({
    mutationFn: (oppId: string) => opportunityService.delete(oppId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      navigate("/opportunities");
    }
  });

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  const o = q.data;
  if (!o) return <div className="panel p-8 text-center font-disp text-xl text-ink-70">Opportunity not found.</div>;

  const isPoster = hasRole(user?.role ?? "", "club", "organizer") && user?.id === o.posted_by_user_id;
  const deadline = deadlineInfo(o.application_deadline);
  const spotsLeft = o.vacancies != null ? o.vacancies - (o.vacancies_filled ?? 0) : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;

  const alreadyApplied = justApplied || (existingApp != null && existingApp.status !== "withdrawn");
  const currentAppStatus = existingApp?.status;
  const canApply = hasRole(user?.role ?? "", "athlete") && o.status === "open" && !alreadyApplied;

  function ApplyButton({ className = "" }: { className?: string }) {
    if (isPoster) return (
      <Link to={`/opportunities/${o!.id}/applicants`} className={`btn-primary text-center flex items-center justify-center min-h-[44px] ${className}`}>
        Review {o!.application_count} applicants →
      </Link>
    );
    if (alreadyApplied) return (
      <Link
        to="/applications"
        className={`btn-secondary text-center flex items-center justify-center min-h-[44px] ${className}`}
      >
        Applied ✓{currentAppStatus ? ` — ${currentAppStatus}` : ""} · View tracker
      </Link>
    );
    if (deadline.closed) return (
      <button className={`btn-secondary flex items-center justify-center min-h-[44px] ${className}`} disabled>
        Applications closed
      </button>
    );
    if (isFull) return (
      <button className={`btn-secondary flex items-center justify-center min-h-[44px] ${className}`} disabled>
        No vacancies
      </button>
    );
    if (canApply) return (
      <button className={`btn-accent flex items-center justify-center min-h-[44px] ${className}`} onClick={() => setApplyOpen(true)}>
        Apply now →
      </button>
    );
    if (!user) return (
      <Link to="/login" className={`btn-primary text-center flex items-center justify-center min-h-[44px] ${className}`}>
        Sign in to apply
      </Link>
    );
    return null;
  }

  return (
    <div className="max-w-5xl pb-24 lg:pb-0">
      <button onClick={() => navigate(-1)} className="btn-ghost text-[12.5px] mb-4 min-h-[44px]">← Opportunities</button>

      {/* header panel */}
      <div className="panel overflow-hidden mb-5">
        <div className="h-3 bg-ink w-full" />
        <div className="p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="badge">{TYPE_LABELS[o.type] ?? o.type}</span>
                <span className="badge capitalize">{o.sport}</span>
                <StatusPill status={o.status} />
                {deadline.closed && (
                  <span className="bg-red-100 text-red-700 font-mononum text-[9px] uppercase tracking-widest px-2 py-0.5 rounded">
                    Deadline passed
                  </span>
                )}
                {!deadline.closed && (
                  <span className="font-mononum text-[10px] uppercase tracking-[0.08em]"
                    style={{ color: deadline.urgent ? "#FA4D14" : "#9A9286" }}>
                    {deadline.text}
                  </span>
                )}
              </div>
              <h1 className="font-disp text-3xl lg:text-4xl leading-tight">{o.title}</h1>
              <div className="lab mt-2">{o.org_name} · {o.city}, {o.state ?? o.country}</div>
            </div>

            {isPoster && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={`/opportunities/${o.id}/applicants`} className="hidden lg:flex btn-secondary items-center min-h-[44px]">
                  Review {o.application_count} applicants →
                </Link>
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setMenuOpen(!menuOpen)} className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                      <Link to={`/opportunities/${o.id}/edit`} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft min-h-[44px]">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <button onClick={() => { setPendingDelete(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-[12.5px] text-red-600 hover:bg-red-50 min-h-[44px]">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats row — horizontally scrollable on mobile */}
          <div className="mt-5 pt-5 border-t border-hairsoft overflow-x-auto">
            <div className="flex gap-6 min-w-max lg:grid lg:grid-cols-4 lg:min-w-0">
              <div className="flex-shrink-0"><div className="lab">Applications</div><div className="font-mononum text-2xl text-ink mt-1">{o.application_count}</div></div>
              {o.vacancies != null && (
                <div className="flex-shrink-0">
                  <div className="lab">Spots left</div>
                  <div className="font-mononum text-2xl mt-1" style={{ color: isFull ? "#B83232" : undefined }}>
                    {isFull ? "Full" : `${spotsLeft}/${o.vacancies}`}
                  </div>
                </div>
              )}
              <div className="flex-shrink-0"><div className="lab">Age range</div><div className="font-mononum text-2xl text-ink mt-1">{o.age_min}–{o.age_max}</div></div>
              <div className="flex-shrink-0"><div className="lab">Deadline</div><div className="font-mononum text-sm text-ink mt-1">{o.application_deadline}</div></div>
            </div>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <div className="panel p-4 border-red-200 bg-red-50 flex flex-wrap gap-4 items-center mb-5">
          <div className="flex-1">
            <p className="font-semibold text-red-900">Delete this opportunity?</p>
            <p className="text-sm text-red-700 mt-0.5">This cannot be undone. All pending applications will be withdrawn.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => deleteOpp.mutate(o.id)} disabled={deleteOpp.isPending} className="btn-danger min-h-[44px]">Confirm delete</button>
            <button onClick={() => setPendingDelete(false)} className="btn-secondary min-h-[44px]">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Left: content ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* About — collapsible on mobile */}
          <CollapsibleSection title="About this opportunity">
            <p className="text-[14.5px] text-ink-70 leading-relaxed whitespace-pre-wrap">{o.description}</p>
          </CollapsibleSection>

          {o.eligibility && (
            <CollapsibleSection title="Eligibility">
              <p className="text-[14.5px] text-ink-70 leading-relaxed mb-4">{o.eligibility}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><div className="lab">Age range</div><div className="font-mononum text-sm text-ink mt-1">{o.age_min}–{o.age_max}</div></div>
                <div><div className="lab">Gender</div><div className="font-mononum text-sm text-ink mt-1 capitalize">{o.gender_eligibility}</div></div>
                <div><div className="lab">Level</div><div className="font-mononum text-sm text-ink mt-1 capitalize">{o.experience_level_required?.replace(/_/g, " ")}</div></div>
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Documents required" defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {["Sports CV (PDF)", "Government ID", "Coach endorsement (optional)"].map((d) => (
                <span key={d} className="badge"><span className="text-brand-500 mr-1">▭</span> {d}</span>
              ))}
            </div>
          </CollapsibleSection>

          {justApplied && (
            <div className="panel p-6 text-center animate-fadein">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">✓</div>
              <h3 className="font-disp text-2xl mt-4">Application submitted!</h3>
              <p className="text-sm text-ink-sub mt-2 leading-relaxed">
                {o.org_name} has been notified. You'll receive a notification when they review your application.
              </p>
              <Link to="/applications" className="btn-secondary mt-5 inline-flex min-h-[44px] items-center">Track your applications →</Link>
            </div>
          )}
        </div>

        {/* ── Right: sticky sidebar (desktop only) ── */}
        <aside className="hidden lg:block">
          <div className="panel p-5 sticky top-4 space-y-4">
            {!deadline.closed && (
              <div>
                <div className="font-disp text-5xl leading-none" style={{ color: deadline.urgent ? "#FA4D14" : "#14110D" }}>
                  {deadline.text}
                </div>
                <div className="lab mt-1.5">Deadline {o.application_deadline}</div>
              </div>
            )}
            {deadline.closed && (
              <div className="font-disp text-3xl text-ink-sub">Applications closed</div>
            )}
            <div className="h-px bg-hair" />
            <div>
              <DetailRow label="Spots left" value={o.vacancies ? (isFull ? "Full" : `${spotsLeft} of ${o.vacancies}`) : undefined} />
              <DetailRow label="Applicants" value={o.application_count} />
              <DetailRow label="Status" value={o.status} />
              <DetailRow label="Type" value={TYPE_LABELS[o.type] ?? o.type} />
              <DetailRow label="Sport" value={o.sport} />
              <DetailRow label="Experience" value={o.experience_level_required?.replace(/_/g, " ")} />
              <DetailRow label="Gender" value={o.gender_eligibility} />
              <DetailRow label="Start" value={o.start_date} />
              <DetailRow label="End" value={o.end_date} />
              {o.contact_email && <DetailRow label="Contact" value={o.contact_email} />}
            </div>
            <ApplyButton className="w-full" />
            {user && !isPoster && (
              <button
                onClick={() => setSaved((s) => !s)}
                className="w-full font-mononum text-[10px] uppercase tracking-[0.08em] text-ink-sub hover:text-ink transition min-h-[44px]"
              >
                {saved ? "★ Saved" : "☆ Save opportunity"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* ── Mobile sticky bottom apply bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper border-t border-hair px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex gap-3">
          {user && !isPoster && (
            <button
              onClick={() => setSaved((s) => !s)}
              className="btn-ghost min-h-[44px] px-3 flex-shrink-0"
              title={saved ? "Unsave" : "Save"}
            >
              {saved ? "★" : "☆"}
            </button>
          )}
          <div className="flex-1">
            <ApplyButton className="w-full" />
          </div>
        </div>
      </div>

      {applyOpen && (
        <ApplyModal
          opp={o}
          onClose={() => setApplyOpen(false)}
          onSuccess={() => { setApplyOpen(false); setJustApplied(true); }}
        />
      )}

      <CommentsDrawer isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </div>
  );
}
