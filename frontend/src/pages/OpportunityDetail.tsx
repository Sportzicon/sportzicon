import { useState, useRef, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Spinner, StatusPill, SectionHead, Kicker } from "../components/UI";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
import type { Opportunity } from "../types";

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

// ── 3-step Apply Modal ────────────────────────────────────────────────────────
function ApplyModal({ opp, onClose, onSuccess }: { opp: Opportunity; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await api.post(`/opportunities/${opp.id}/apply`, { cover_note: note });
      qc.invalidateQueries({ queryKey: ["my-apps"] });
      onSuccess();
    } catch (e) {
      setErr(getApiError(e).message);
    } finally { setBusy(false); }
  }

  // close on backdrop click
  function onBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,17,13,0.55)" }}
      onClick={onBackdrop}
    >
      <div className="panel w-full max-w-[600px] max-h-[90vh] overflow-auto animate-popin">
        {/* modal header */}
        <div className="px-6 py-[18px] border-b border-hair flex items-start justify-between gap-4">
          <div>
            <Kicker>Apply — step {step + 1} of {APPLY_STEPS.length}</Kicker>
            <h3 className="font-disp text-xl mt-1">{opp.title}</h3>
          </div>
          <button onClick={onClose} className="text-[20px] text-ink-sub hover:text-ink leading-none mt-0.5">×</button>
        </div>

        {/* step tabs */}
        <div className="flex gap-0 border-b border-hair px-6">
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

        {/* step content */}
        <div className="p-6">
          {/* ── Step 0: Cover note ── */}
          {step === 0 && (
            <div className="animate-fadein">
              <label className="block">
                <span className="label">Cover note to the club *</span>
                <textarea
                  className="input"
                  rows={8}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                  placeholder="Why are you a great fit? Include your key stats, experience, relevant formats, and availability for the trial/conditioning camp."
                  autoFocus
                  style={{ resize: "vertical" }}
                />
                <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">
                  {note.length} / 1000 characters
                </span>
              </label>
            </div>
          )}

          {/* ── Step 1: Documents ── */}
          {step === 1 && (
            <div className="animate-fadein space-y-3">
              <div className="lab text-ink mb-3">Documents for this listing</div>
              {/* Standard docs — auto-inferred from opportunity */}
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
              <p className="font-mononum text-[10.5px] text-ink-faint mt-3">
                Private documents are shared with this club only via signed time-limited links.
              </p>
            </div>
          )}

          {/* ── Step 2: Review ── */}
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

        {/* modal footer */}
        <div className="px-6 py-4 border-t border-hair flex justify-between items-center">
          <button className="btn-ghost" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          {step < APPLY_STEPS.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>Continue →</button>
          ) : (
            <button className="btn-accent" onClick={submit} disabled={busy || !note.trim()}>
              {busy ? "Submitting…" : "Submit application →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OpportunityDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["opp", id],
    queryFn: async () => (await api.get<{ opportunity: Opportunity }>(`/opportunities/${id}`)).data.opportunity
  });

  const deleteOpp = useMutation({
    mutationFn: async (oppId: string) => api.delete(`/opportunities/${oppId}`),
    onSuccess: () => navigate("/opportunities")
  });

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  const o = q.data;
  if (!o) return <div className="panel p-8 text-center font-disp text-xl text-ink-70">Opportunity not found.</div>;

  const isPoster = user?.id === o.posted_by_user_id;
  const canApply = user?.role === "athlete" && o.status === "open" && !applied;
  const deadline = deadlineInfo(o.application_deadline);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* back link */}
      <button onClick={() => navigate(-1)} className="btn-ghost text-[12.5px]">← Opportunities</button>

      {/* header panel */}
      <div className="panel overflow-hidden">
        <div className="h-3 bg-ink w-full" />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="badge">{TYPE_LABELS[o.type] ?? o.type}</span>
                <span className="badge">{o.sport}</span>
                <StatusPill status={o.status} />
                {!deadline.closed && (
                  <span className="font-mononum text-[10px] uppercase tracking-[0.08em]"
                    style={{ color: deadline.urgent ? "#FA4D14" : "#9A9286" }}>
                    {deadline.text}
                  </span>
                )}
              </div>
              <h1 className="font-disp text-4xl leading-tight">{o.title}</h1>
              <div className="lab mt-2">{o.org_name} · {o.city}, {o.state ?? o.country}</div>
            </div>

            {isPoster && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={`/opportunities/${o.id}/applicants`} className="btn-secondary">
                  Review {o.application_count} applicants →
                </Link>
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setMenuOpen(!menuOpen)} className="btn-ghost p-2">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                      <Link to={`/opportunities/${o.id}/edit`} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <button onClick={() => { setPendingDelete(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* stat strip */}
          <div className="mt-5 pt-5 border-t border-hairsoft grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><div className="lab">Applications</div><div className="font-mononum text-2xl text-ink mt-1">{o.application_count}</div></div>
            {o.vacancies != null && (
              <div><div className="lab">Vacancies</div><div className="font-mononum text-2xl text-ink mt-1">{o.vacancies_filled ?? 0}/{o.vacancies}</div></div>
            )}
            <div><div className="lab">Age range</div><div className="font-mononum text-2xl text-ink mt-1">{o.age_min}–{o.age_max}</div></div>
            <div><div className="lab">Deadline</div><div className="font-mononum text-sm text-ink mt-1">{o.application_deadline}</div></div>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <div className="panel p-4 border-red-200 bg-red-50 flex flex-wrap gap-4 items-center">
          <div className="flex-1">
            <p className="font-semibold text-red-900">Delete this opportunity?</p>
            <p className="text-sm text-red-700 mt-0.5">This cannot be undone.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => deleteOpp.mutate(o.id)} disabled={deleteOpp.isPending} className="btn-danger">Confirm delete</button>
            <button onClick={() => setPendingDelete(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* main content — 2/3 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Zone 01 — About */}
          <div className="panel p-6">
            <SectionHead n="01" title="About this opportunity" />
            <p className="text-[14.5px] text-ink-70 leading-relaxed whitespace-pre-wrap mt-4">{o.description}</p>
          </div>

          {/* Zone 02 — Eligibility */}
          {o.eligibility && (
            <div className="panel p-6">
              <SectionHead n="02" title="Eligibility" />
              <p className="text-[14.5px] text-ink-70 leading-relaxed mt-4">{o.eligibility}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
                <div><div className="lab">Age range</div><div className="font-mononum text-sm text-ink mt-1">{o.age_min}–{o.age_max}</div></div>
                <div><div className="lab">Gender</div><div className="font-mononum text-sm text-ink mt-1 capitalize">{o.gender_eligibility}</div></div>
                <div><div className="lab">Level</div><div className="font-mononum text-sm text-ink mt-1 capitalize">{o.experience_level_required?.replace(/_/g, " ")}</div></div>
              </div>
            </div>
          )}

          {/* Zone 03 — Documents */}
          <div className="panel p-6">
            <SectionHead n="03" title="Documents required" />
            <div className="mt-4 flex flex-wrap gap-2">
              {["Sports CV (PDF)", "Government ID", "Coach endorsement (optional)"].map((d) => (
                <span key={d} className="badge">
                  <span className="text-brand-500 mr-1">▭</span> {d}
                </span>
              ))}
            </div>
          </div>

          {/* applied success */}
          {applied && (
            <div className="panel p-6 text-center animate-fadein">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">✓</div>
              <h3 className="font-disp text-2xl mt-4">Application submitted!</h3>
              <p className="text-sm text-ink-sub mt-2 leading-relaxed">
                {o.org_name} has been notified. You'll receive a notification when they review your application.
              </p>
              <Link to="/applications" className="btn-secondary mt-5 inline-flex">Track your applications →</Link>
            </div>
          )}
        </div>

        {/* sidebar — 1/3 sticky */}
        <aside>
          <div className="panel p-5 sticky top-20 space-y-4">
            {/* Large deadline countdown (zip 2 pattern) */}
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

            {/* detail rows */}
            <div>
              <DetailRow label="Vacancies" value={o.vacancies ? `${(o.vacancies - (o.vacancies_filled ?? 0))} of ${o.vacancies} open` : undefined} />
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

            {/* CTA buttons */}
            {isPoster ? (
              <Link to={`/opportunities/${o.id}/applicants`} className="btn-primary w-full text-center">
                Review {o.application_count} applicants →
              </Link>
            ) : applied ? (
              <Link to="/applications" className="btn-secondary w-full text-center">View in tracker →</Link>
            ) : canApply ? (
              <button className="btn-accent w-full" onClick={() => setApplyOpen(true)}>
                Apply now →
              </button>
            ) : deadline.closed ? (
              <button className="btn-secondary w-full" disabled>Applications closed</button>
            ) : !user ? (
              <Link to="/login" className="btn-primary w-full text-center inline-flex justify-center">
                Sign in to apply
              </Link>
            ) : null}

            {/* ☆ Save (zip 2 pattern) */}
            {user && !isPoster && (
              <button
                onClick={() => setSaved((s) => !s)}
                className="w-full font-mononum text-[10px] uppercase tracking-[0.08em] text-ink-sub hover:text-ink transition"
              >
                {saved ? "★ Saved" : "☆ Save opportunity"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Apply Modal */}
      {applyOpen && (
        <ApplyModal
          opp={o}
          onClose={() => setApplyOpen(false)}
          onSuccess={() => { setApplyOpen(false); setApplied(true); }}
        />
      )}
    </div>
  );
}
