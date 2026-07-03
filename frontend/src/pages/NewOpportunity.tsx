import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { opportunityService, organizationService } from "../services";
import { humanizeError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, SectionHead } from "../components/UI";
import { queryKeys } from "../hooks/queryKeys";
import { SPORTS_LIST } from "../data/sportPositions";
import type { CreateOpportunityRequest } from "../models";

const TYPES = ["trial", "recruitment", "scholarship", "tournament", "coaching_job"];
const TYPE_LABELS: Record<string, string> = {
  trial: "Trial", recruitment: "Recruitment", scholarship: "Scholarship",
  tournament: "Tournament", coaching_job: "Coaching Job"
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

export default function NewOpportunity() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const orgsQ = useQuery({
    queryKey: queryKeys.myOrgs(),
    queryFn: () => isAdmin
      ? organizationService.list()
      : organizationService.getMine()
  });
  const oppQ = useQuery({
    queryKey: queryKeys.opportunity(id ?? ""),
    queryFn: () => opportunityService.get(id!),
    enabled: !!id
  });

  const [form, setForm] = useState<Omit<CreateOpportunityRequest, "org_id"> & { org_id: string; vacancies?: number }>({
    org_id: "", title: "", type: "trial", sport: "", description: "",
    eligibility: "", age_min: 14, age_max: 35, gender_eligibility: "all",
    experience_level_required: "any", country: "India", state: "", city: "",
    start_date: "", end_date: "", application_deadline: "",
    vacancies: undefined
  });
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.org_id && orgsQ.data?.length) setForm((f) => ({ ...f, org_id: orgsQ.data![0].id }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgsQ.data]);

  useEffect(() => {
    if (oppQ.data) {
      const opp = oppQ.data;
      setForm({
        org_id: opp.org_id || "", title: opp.title || "", type: opp.type || "trial",
        sport: opp.sport || "", description: opp.description || "", eligibility: opp.eligibility || "",
        age_min: opp.age_min || 14, age_max: opp.age_max || 35,
        gender_eligibility: opp.gender_eligibility || "all",
        experience_level_required: opp.experience_level_required || "any",
        country: opp.country || "India", state: opp.state || "", city: opp.city || "",
        start_date: opp.start_date || "", end_date: opp.end_date || "",
        application_deadline: opp.application_deadline || "", vacancies: opp.vacancies
      });
    }
  }, [oppQ.data]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 5) errors.title = "Title must be at least 5 characters";
    if (!form.sport) errors.sport = "Please select a sport";
    if (!form.description.trim() || form.description.trim().length < 20) errors.description = "Description must be at least 20 characters";
    if (form.type !== "coaching_job" && !form.start_date) errors.start_date = "Start date is required";
    if (form.type !== "coaching_job" && !form.end_date) errors.end_date = "End date is required";
    if (!form.application_deadline) errors.application_deadline = "Application deadline is required";
    if (form.application_deadline && form.application_deadline < today()) errors.application_deadline = "Deadline must be today or in the future";
    if (!form.state) errors.state = "State is required";
    if (!form.city) errors.city = "City is required";
    if (Number(form.age_max) < Number(form.age_min)) errors.age_max = "Max age must be ≥ min age";
    if (form.vacancies != null && (form.vacancies < 1 || form.vacancies > 1000)) errors.vacancies = "Vacancies must be between 1 and 1000";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setErr(null); setBusy(true);
    try {
      const payload: any = { ...form };
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] == null) && delete payload[k]);
      if (payload.vacancies) payload.vacancies = Number(payload.vacancies);
      payload.age_min = Number(payload.age_min);
      payload.age_max = Number(payload.age_max);

      const saved = isEdit
        ? await opportunityService.update(id!, payload)
        : await opportunityService.create(payload);

      await qc.invalidateQueries({ queryKey: queryKeys.opportunitiesInfinite() });
      if (isEdit) await qc.invalidateQueries({ queryKey: queryKeys.opportunity(id!) });
      navigate(`/opportunities/${saved.id}`);
    } catch (e) {
      setErr(humanizeError(e));
    } finally { setBusy(false); }
  }

  if (isEdit && oppQ.isPending) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  if (!isEdit && !isAdmin && !orgsQ.data?.length) {
    return (
      <div className="panel p-8 max-w-lg">
        <div className="kicker">Organization required</div>
        <h2 className="font-disp text-3xl mt-2">Create an organization first</h2>
        <p className="text-sm text-ink-sub mt-3 leading-relaxed">You need an organization profile before posting opportunities.</p>
        <button className="btn-accent mt-5 min-h-[44px]" onClick={() => navigate("/organizations/new")}>Create organization →</button>
      </div>
    );
  }

  const set = (k: string, v: any) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((fe) => { const ne = { ...fe }; delete ne[k]; return ne; });
  };

  const descLen = form.description.length;

  return (
    <form onSubmit={submit} noValidate className="space-y-6 max-w-3xl pb-28 lg:pb-0">
      <div className="hidden lg:block">
        <PageHeader
          title={isEdit ? "Edit opportunity" : "Post an opportunity"}
          subtitle="New listing"
          sticky
        />
      </div>
      <div className="lg:hidden mb-2">
        <h1 className="font-disp text-2xl">{isEdit ? "Edit opportunity" : "Post an opportunity"}</h1>
      </div>

      {/* Section 01 — Basics */}
      <div className="panel p-5 space-y-4">
        <SectionHead n="01" title="Basics" />
        <Field label="Organization">
          <select className="input min-h-[44px]" value={form.org_id} onChange={(e) => set("org_id", e.target.value)}>
            {isAdmin && <option value="">Select organization…</option>}
            {(orgsQ.data ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
          </select>
        </Field>
        <Field label="Title *" error={fieldErrors.title}>
          <input className={`input min-h-[44px] ${fieldErrors.title ? "border-red-400" : ""}`}
            value={form.title} onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Senior Men's Trial — Season 2026" />
        </Field>
        <div>
          <span className="label">Opportunity type *</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {TYPES.map((t) => (
              <button
                key={t} type="button"
                onClick={() => set("type", t)}
                className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-2 rounded border transition min-h-[44px] ${
                  form.type === t ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink hover:text-ink"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <Field label="Sport *" error={fieldErrors.sport}>
          <select className={`input min-h-[44px] ${fieldErrors.sport ? "border-red-400" : ""}`}
            value={form.sport} onChange={(e) => set("sport", e.target.value)}>
            <option value="">Select sport…</option>
            {SPORTS_LIST.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Description *" error={fieldErrors.description}
          hint={`${descLen}/5000 characters${descLen < 20 ? ` — need ${20 - descLen} more` : ""}`}>
          <textarea className={`input min-h-[44px] ${fieldErrors.description ? "border-red-400" : ""}`}
            rows={4} value={form.description} onChange={(e) => set("description", e.target.value.slice(0, 5000))}
            placeholder="Describe the opportunity in detail…" />
          <div className={`text-[10.5px] mt-0.5 font-mononum text-right ${descLen > 4800 ? "text-red-500" : "text-ink-faint"}`}>
            {descLen}/5000
          </div>
        </Field>
      </div>

      {/* Section 02 — Eligibility */}
      <div className="panel p-5 space-y-4">
        <SectionHead n="02" title="Eligibility & criteria" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Age min *" error={fieldErrors.age_min}>
            <input className="input font-mononum min-h-[44px]" type="number" inputMode="numeric"
              min={0} max={120} value={form.age_min} onChange={(e) => set("age_min", e.target.value)} />
          </Field>
          <Field label="Age max *" error={fieldErrors.age_max}>
            <input className="input font-mononum min-h-[44px]" type="number" inputMode="numeric"
              min={0} max={120} value={form.age_max} onChange={(e) => set("age_max", e.target.value)} />
          </Field>
          <Field label="Gender eligibility">
            <select className="input min-h-[44px]" value={form.gender_eligibility} onChange={(e) => set("gender_eligibility", e.target.value)}>
              <option value="all">Open to all</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Experience level">
            <select className="input min-h-[44px]" value={form.experience_level_required} onChange={(e) => set("experience_level_required", e.target.value)}>
              <option value="any">Any level</option>
              <option value="beginner">Beginner</option>
              <option value="amateur">Amateur</option>
              <option value="semi_pro">Semi-pro</option>
              <option value="professional">Professional</option>
            </select>
          </Field>
          <Field label="Vacancies" hint="Leave blank for unlimited" error={fieldErrors.vacancies}>
            <input className="input font-mononum min-h-[44px]" type="number" inputMode="numeric"
              min={1} max={1000}
              value={form.vacancies ?? ""} placeholder="e.g. 5"
              onChange={(e) => set("vacancies", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
        <Field label="Eligibility criteria">
          <textarea className="input min-h-[44px]" rows={2} value={form.eligibility}
            onChange={(e) => set("eligibility", e.target.value)}
            placeholder="Minimum requirements, experience, documentation…" />
        </Field>
      </div>

      {/* Section 03 — Dates & location */}
      <div className="panel p-5 space-y-4">
        <SectionHead n="03" title="Dates & location" />
        <div className="grid sm:grid-cols-3 gap-4">
          {form.type !== "coaching_job" && (
            <>
              <Field label="Start date *" error={fieldErrors.start_date}>
                <input className="input font-mononum min-h-[44px]" type="date" value={form.start_date}
                  min={today()}
                  onChange={(e) => set("start_date", e.target.value)} />
              </Field>
              <Field label="End date *" error={fieldErrors.end_date}>
                <input className="input font-mononum min-h-[44px]" type="date" value={form.end_date}
                  min={form.start_date || tomorrow()}
                  onChange={(e) => set("end_date", e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Application deadline *" hint="Auto-closes on this date." error={fieldErrors.application_deadline}>
            <input className={`input font-mononum min-h-[44px] ${fieldErrors.application_deadline ? "border-red-400" : ""}`}
              type="date" value={form.application_deadline}
              min={today()}
              onChange={(e) => set("application_deadline", e.target.value)} />
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Country">
            <input className="input min-h-[44px]" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="State *" error={fieldErrors.state}>
            <input className={`input min-h-[44px] ${fieldErrors.state ? "border-red-400" : ""}`}
              value={form.state} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="City *" error={fieldErrors.city}>
            <input className={`input min-h-[44px] ${fieldErrors.city ? "border-red-400" : ""}`}
              value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
        </div>
      </div>

      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

      {/* Desktop submit row */}
      <div className="hidden lg:flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost min-h-[44px]" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent min-h-[44px]" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish listing →"}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-paper border-t border-hair px-4 py-3 flex gap-3">
        <button type="button" className="btn-ghost flex-1 min-h-[44px]" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent flex-1 min-h-[44px]" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish →"}
        </button>
      </div>
    </form>
  );
}
