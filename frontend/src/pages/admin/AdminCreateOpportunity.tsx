import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, humanizeError } from "../../api/client";
import { queryKeys } from "../../hooks/queryKeys";
import { Wizard } from "../../components/Wizard";
import { PageHeader } from "../../components/UI";

const DRAFT_KEY = "admin_create_opp_draft";

const STEPS = [
  { title: "Basics", subtitle: "Title, type, sport and organization" },
  { title: "Schedule & Location", subtitle: "Dates and where it takes place" },
  { title: "Eligibility & Details", subtitle: "Who can apply and specifics" },
];

const OPP_TYPES = ["trial", "recruitment", "scholarship", "tournament", "coaching_job"] as const;
const GENDERS = ["all", "male", "female", "other"] as const;
const EXPERIENCE = ["any", "beginner", "amateur", "semi_pro", "professional"] as const;

type Draft = {
  step: number;
  // step 1
  org_id: string;
  title: string;
  type: string;
  sport: string;
  // step 2
  start_date: string;
  end_date: string;
  application_deadline: string;
  country: string;
  state: string;
  city: string;
  // step 3
  description: string;
  eligibility: string;
  age_min: string;
  age_max: string;
  gender_eligibility: string;
  experience_level_required: string;
  entry_fee: string;
  vacancies: string;
  contact_email: string;
  contact_phone: string;
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    step: 0,
    org_id: "", title: "", type: "tournament", sport: "",
    start_date: "", end_date: "", application_deadline: "",
    country: "", state: "", city: "",
    description: "", eligibility: "",
    age_min: "", age_max: "",
    gender_eligibility: "all", experience_level_required: "any",
    entry_fee: "", vacancies: "",
    contact_email: "", contact_phone: ""
  };
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function AdminCreateOpportunity() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraftRaw] = useState<Draft>(loadDraft);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(
    localStorage.getItem(DRAFT_KEY) ? new Date() : null
  );
  const [submitError, setSubmitError] = useState("");
  // Per-step touched sets
  const [touched1, setTouched1] = useState<Set<string>>(new Set());
  const [touched2, setTouched2] = useState<Set<string>>(new Set());
  const [touched3, setTouched3] = useState<Set<string>>(new Set());

  const setDraft = useCallback((updater: (prev: Draft) => Draft) => {
    setDraftRaw((prev) => {
      const next = updater(prev);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      setDraftSavedAt(new Date());
      return next;
    });
  }, []);

  function setF(key: keyof Draft, val: string) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function touch(set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    set((s) => new Set([...s, key]));
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraftRaw({
      step: 0,
      org_id: "", title: "", type: "tournament", sport: "",
      start_date: "", end_date: "", application_deadline: "",
      country: "", state: "", city: "",
      description: "", eligibility: "",
      age_min: "", age_max: "",
      gender_eligibility: "all", experience_level_required: "any",
      entry_fee: "", vacancies: "",
      contact_email: "", contact_phone: ""
    });
    setDraftSavedAt(null);
    setTouched1(new Set()); setTouched2(new Set()); setTouched3(new Set());
  }

  // Step 1 — validate only step 1 fields
  const step1Errors = {
    org_id: !draft.org_id.trim() ? "Organization ID required" : "",
    title: draft.title.trim().length < 3 ? "Title required (min 3 chars)" : "",
    sport: !draft.sport.trim() ? "Sport required" : "",
  };
  const step1Valid = !step1Errors.org_id && !step1Errors.title && !step1Errors.sport;

  // Step 2 — validate only step 2 fields
  const step2Errors = {
    start_date: !draft.start_date ? "Start date required" : "",
    end_date: !draft.end_date ? "End date required"
      : draft.start_date && draft.end_date < draft.start_date ? "End date must be after start date" : "",
    application_deadline: !draft.application_deadline ? "Deadline required"
      : draft.start_date && draft.application_deadline > draft.start_date ? "Deadline should be before or on start date" : "",
    country: !draft.country.trim() ? "Country required" : "",
    city: !draft.city.trim() ? "City required" : "",
  };
  const step2Valid = !step2Errors.start_date && !step2Errors.end_date
    && !step2Errors.application_deadline && !step2Errors.country && !step2Errors.city;

  // Step 3 — validate only step 3 fields
  const step3Errors = {
    description: draft.description.trim().length < 10 ? "Description required (min 10 chars)" : "",
    contact_email: draft.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact_email)
      ? "Invalid email format" : "",
  };
  const step3Valid = !step3Errors.description && !step3Errors.contact_email;

  const createOpp = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        org_id: draft.org_id,
        title: draft.title,
        type: draft.type,
        sport: draft.sport,
        description: draft.description,
        country: draft.country,
        city: draft.city,
        start_date: draft.start_date,
        end_date: draft.end_date,
        application_deadline: draft.application_deadline,
        gender_eligibility: draft.gender_eligibility,
        experience_level_required: draft.experience_level_required,
      };
      if (draft.state) body.state = draft.state;
      if (draft.eligibility) body.eligibility = draft.eligibility;
      if (draft.age_min) body.age_min = Number(draft.age_min);
      if (draft.age_max) body.age_max = Number(draft.age_max);
      if (draft.entry_fee) body.entry_fee = Number(draft.entry_fee);
      if (draft.vacancies) body.vacancies = Number(draft.vacancies);
      if (draft.contact_email) body.contact_email = draft.contact_email;
      if (draft.contact_phone) body.contact_phone = draft.contact_phone;
      return api.post("/admin/opportunities", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminOpportunities() });
      localStorage.removeItem(DRAFT_KEY);
      navigate("/admin/opportunities");
    },
    onError: (e: unknown) => setSubmitError(humanizeError(e)),
  });

  function stepCanProceed() {
    if (draft.step === 0) return step1Valid;
    if (draft.step === 1) return step2Valid;
    return step3Valid;
  }

  function goNext() {
    setDraft((d) => ({ ...d, step: d.step + 1 }));
    window.scrollTo(0, 0);
  }

  function goBack() {
    setDraft((d) => ({ ...d, step: d.step - 1 }));
    window.scrollTo(0, 0);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <button className="btn-secondary btn-sm" onClick={() => navigate("/admin/opportunities")}>← Back to opportunities</button>
        <PageHeader title="Create Opportunity" subtitle="Create a tournament, trial or other opportunity" />
      </div>

      <Wizard
        steps={STEPS}
        currentStep={draft.step}
        canProceed={stepCanProceed()}
        isLastStep={draft.step === STEPS.length - 1}
        isSubmitting={createOpp.isPending}
        submitLabel="Create opportunity"
        error={submitError}
        draftSavedAt={draftSavedAt}
        onDiscardDraft={discardDraft}
        onBack={goBack}
        onNext={goNext}
        onSubmit={() => createOpp.mutate()}
      >
        {/* ── Step 1: Basics ────────────────────────────────────────────── */}
        {draft.step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Organization ID" required hint="Find this on the Organizations page — copy the org's UUID from the URL or detail view">
                <input
                  className="input"
                  value={draft.org_id}
                  onChange={(e) => setF("org_id", e.target.value)}
                  onBlur={() => touch(setTouched1, "org_id")}
                  placeholder="e.g. 3f2504e0-4f89-11d3-9a0c-0305e82c3301"
                />
                {touched1.has("org_id") && step1Errors.org_id && (
                  <p className="text-xs text-red-600 mt-0.5">{step1Errors.org_id}</p>
                )}
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Title" required>
                <input
                  className="input"
                  value={draft.title}
                  onChange={(e) => setF("title", e.target.value)}
                  onBlur={() => touch(setTouched1, "title")}
                  placeholder="Under-19 State Cricket Championship"
                />
                {touched1.has("title") && step1Errors.title && (
                  <p className="text-xs text-red-600 mt-0.5">{step1Errors.title}</p>
                )}
              </Field>
            </div>

            <Field label="Type" required>
              <select
                className="input"
                value={draft.type}
                onChange={(e) => setF("type", e.target.value)}
              >
                {OPP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sport" required>
              <input
                className="input"
                value={draft.sport}
                onChange={(e) => setF("sport", e.target.value)}
                onBlur={() => touch(setTouched1, "sport")}
                placeholder="Cricket, Football, Tennis…"
              />
              {touched1.has("sport") && step1Errors.sport && (
                <p className="text-xs text-red-600 mt-0.5">{step1Errors.sport}</p>
              )}
            </Field>
          </div>
        )}

        {/* ── Step 2: Schedule & Location ───────────────────────────────── */}
        {draft.step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Application deadline" required>
              <input
                className="input"
                type="date"
                value={draft.application_deadline}
                onChange={(e) => setF("application_deadline", e.target.value)}
                onBlur={() => touch(setTouched2, "application_deadline")}
              />
              {touched2.has("application_deadline") && step2Errors.application_deadline && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.application_deadline}</p>
              )}
            </Field>

            <Field label="Start date" required>
              <input
                className="input"
                type="date"
                value={draft.start_date}
                onChange={(e) => setF("start_date", e.target.value)}
                onBlur={() => touch(setTouched2, "start_date")}
              />
              {touched2.has("start_date") && step2Errors.start_date && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.start_date}</p>
              )}
            </Field>

            <Field label="End date" required>
              <input
                className="input"
                type="date"
                value={draft.end_date}
                onChange={(e) => setF("end_date", e.target.value)}
                onBlur={() => touch(setTouched2, "end_date")}
              />
              {touched2.has("end_date") && step2Errors.end_date && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.end_date}</p>
              )}
            </Field>

            <Field label="Country" required>
              <input
                className="input"
                value={draft.country}
                onChange={(e) => setF("country", e.target.value)}
                onBlur={() => touch(setTouched2, "country")}
                placeholder="India"
              />
              {touched2.has("country") && step2Errors.country && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.country}</p>
              )}
            </Field>

            <Field label="State">
              <input className="input" value={draft.state} onChange={(e) => setF("state", e.target.value)} placeholder="Maharashtra" />
            </Field>

            <Field label="City" required>
              <input
                className="input"
                value={draft.city}
                onChange={(e) => setF("city", e.target.value)}
                onBlur={() => touch(setTouched2, "city")}
                placeholder="Mumbai"
              />
              {touched2.has("city") && step2Errors.city && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.city}</p>
              )}
            </Field>
          </div>
        )}

        {/* ── Step 3: Eligibility & Details ─────────────────────────────── */}
        {draft.step === 2 && (
          <div className="space-y-4">
            <Field label="Description" required>
              <textarea
                className="input"
                rows={4}
                value={draft.description}
                onChange={(e) => setF("description", e.target.value)}
                onBlur={() => touch(setTouched3, "description")}
                placeholder="Describe this opportunity in detail…"
              />
              {touched3.has("description") && step3Errors.description && (
                <p className="text-xs text-red-600 mt-0.5">{step3Errors.description}</p>
              )}
            </Field>

            <Field label="Eligibility notes">
              <textarea
                className="input"
                rows={2}
                value={draft.eligibility}
                onChange={(e) => setF("eligibility", e.target.value)}
                placeholder="Any specific eligibility requirements…"
              />
            </Field>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Age min">
                <input className="input" type="number" min={0} max={120} value={draft.age_min} onChange={(e) => setF("age_min", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Age max">
                <input className="input" type="number" min={0} max={120} value={draft.age_max} onChange={(e) => setF("age_max", e.target.value)} placeholder="99" />
              </Field>
              <Field label="Vacancies">
                <input className="input" type="number" min={1} value={draft.vacancies} onChange={(e) => setF("vacancies", e.target.value)} placeholder="—" />
              </Field>
              <Field label="Entry fee (₹)">
                <input className="input" type="number" min={0} value={draft.entry_fee} onChange={(e) => setF("entry_fee", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Gender eligibility">
                <select className="input" value={draft.gender_eligibility} onChange={(e) => setF("gender_eligibility", e.target.value)}>
                  {GENDERS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Experience required">
                <select className="input" value={draft.experience_level_required} onChange={(e) => setF("experience_level_required", e.target.value)}>
                  {EXPERIENCE.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Contact email">
                <input
                  className="input min-h-[44px]"
                  type="email"
                  inputMode="email"
                  value={draft.contact_email}
                  onChange={(e) => setF("contact_email", e.target.value)}
                  onBlur={() => touch(setTouched3, "contact_email")}
                  placeholder="contact@org.com"
                />
                {touched3.has("contact_email") && step3Errors.contact_email && (
                  <p className="text-xs text-red-600 mt-0.5">{step3Errors.contact_email}</p>
                )}
              </Field>
              <Field label="Contact phone">
                <input className="input" value={draft.contact_phone} onChange={(e) => setF("contact_phone", e.target.value)} placeholder="+91 9876543210" />
              </Field>
            </div>
          </div>
        )}
      </Wizard>
    </div>
  );
}
