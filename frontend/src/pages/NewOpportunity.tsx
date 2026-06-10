import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { opportunityService, organizationService } from "../services";
import { humanizeError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, SectionHead } from "../components/UI";
import type { CreateOpportunityRequest } from "../models";

const TYPES = ["trial", "recruitment", "scholarship", "tournament", "coaching_job"];
const TYPE_LABELS: Record<string, string> = {
  trial: "Trial", recruitment: "Recruitment", scholarship: "Scholarship",
  tournament: "Tournament", coaching_job: "Coaching Job"
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
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
    queryKey: ["my-orgs", isAdmin],
    queryFn: () => isAdmin
      ? organizationService.list()
      : organizationService.getMine()
  });
  const oppQ = useQuery({
    queryKey: ["opp", id],
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.org_id && orgsQ.data?.length) setForm((f) => ({ ...f, org_id: orgsQ.data![0].id }));
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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

      await qc.invalidateQueries({ queryKey: ["opp"] });
      await qc.invalidateQueries({ queryKey: ["opportunities"] });
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
        <p className="text-sm text-ink-sub mt-3 leading-relaxed">You need an organization profile before posting opportunities. It helps athletes know who's behind the listing.</p>
        <button className="btn-accent mt-5" onClick={() => navigate("/organizations/new")}>Create organization →</button>
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      <PageHeader
        title={isEdit ? "Edit opportunity" : "Post an opportunity"}
        subtitle="New listing"
        action={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-accent" disabled={busy}>
              {busy ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish listing →"}
            </button>
          </div>
        }
      />

      {/* Section 01 — Basics */}
      <div className="panel p-6 space-y-4">
        <SectionHead n="01" title="Basics" />
        <Field label="Organization">
          <select className="input" value={form.org_id} onChange={(e) => set("org_id", e.target.value)}>
            {isAdmin && <option value="">Select organization…</option>}
            {(orgsQ.data ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
          </select>
        </Field>
        <Field label="Title *">
          <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} required placeholder="e.g. Senior Men's Trial — Season 2026" />
        </Field>
        <div>
          <span className="label">Opportunity type *</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {TYPES.map((t) => (
              <button
                key={t} type="button"
                onClick={() => set("type", t)}
                className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-2 rounded border transition ${
                  form.type === t ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink hover:text-ink"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Sport *">
            <input className="input" value={form.sport} onChange={(e) => set("sport", e.target.value)} required placeholder="e.g. Cricket" />
          </Field>
        </div>
        <Field label="Description *">
          <textarea className="input" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} required placeholder="Describe the opportunity in detail…" />
        </Field>
      </div>

      {/* Section 02 — Eligibility */}
      <div className="panel p-6 space-y-4">
        <SectionHead n="02" title="Eligibility & criteria" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Age min *">
            <input className="input font-mononum" type="text" inputMode="numeric" pattern="[0-9]*" value={form.age_min} onChange={(e) => set("age_min", e.target.value)} />
          </Field>
          <Field label="Age max *">
            <input className="input font-mononum" type="text" inputMode="numeric" pattern="[0-9]*" value={form.age_max} onChange={(e) => set("age_max", e.target.value)} />
          </Field>
          <Field label="Gender eligibility">
            <select className="input" value={form.gender_eligibility} onChange={(e) => set("gender_eligibility", e.target.value)}>
              <option value="all">Open to all</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Experience level">
            <select className="input" value={form.experience_level_required} onChange={(e) => set("experience_level_required", e.target.value)}>
              <option value="any">Any level</option>
              <option value="beginner">Beginner</option>
              <option value="amateur">Amateur</option>
              <option value="semi_pro">Semi-pro</option>
              <option value="professional">Professional</option>
            </select>
          </Field>
          <Field label="Vacancies">
            <input className="input font-mononum" type="number" value={form.vacancies ?? ""} placeholder="Leave blank for unlimited"
              onChange={(e) => set("vacancies", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
        <Field label="Eligibility criteria">
          <textarea className="input" rows={2} value={form.eligibility} onChange={(e) => set("eligibility", e.target.value)} placeholder="Minimum requirements, experience, documentation…" />
        </Field>
      </div>

      {/* Section 03 — Dates & location */}
      <div className="panel p-6 space-y-4">
        <SectionHead n="03" title="Dates & location" />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Start date *">
            <input className="input font-mononum" type="date" value={form.start_date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => set("start_date", e.target.value)} required />
          </Field>
          <Field label="End date *">
            <input className="input font-mononum" type="date" value={form.end_date}
              min={form.start_date || new Date().toISOString().split("T")[0]}
              onChange={(e) => set("end_date", e.target.value)} required />
          </Field>
          <Field label="Application deadline *" hint="Auto-closes at midnight on this date.">
            <input className="input font-mononum" type="date" value={form.application_deadline}
              min={new Date().toISOString().split("T")[0]}
              max={form.start_date || undefined}
              onChange={(e) => set("application_deadline", e.target.value)} required />
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Country"><input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="State *"><input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} required /></Field>
          <Field label="City *"><input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} required /></Field>
        </div>
      </div>

      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish listing →"}
        </button>
      </div>
    </form>
  );
}
