import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, humanizeError } from "../../api/client";
import { Wizard } from "../../components/Wizard";
import { PageHeader } from "../../components/UI";

const DRAFT_KEY = "admin_create_org_draft";

const STEPS = [
  { title: "Organization Identity", subtitle: "Name, type and ownership" },
  { title: "Location & Contact", subtitle: "Where and how to reach them" },
  { title: "Settings & Details", subtitle: "Plan, sports and description" },
];

type Draft = {
  step: number;
  // step 1
  org_name: string;
  org_type: string;
  owner_user_id: string;
  // step 2
  country: string;
  state: string;
  city: string;
  address: string;
  website: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  // step 3
  subscription_plan: string;
  sport_categories: string; // comma-separated
  description: string;
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    step: 0,
    org_name: "", org_type: "", owner_user_id: "",
    country: "", state: "", city: "", address: "", website: "",
    contact_name: "", contact_email: "", contact_phone: "",
    subscription_plan: "free", sport_categories: "", description: ""
  };
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const ORG_TYPES = ["club", "academy", "federation", "school", "brand", "university", "ngo", "other"];

export default function AdminCreateOrganization() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraftRaw] = useState<Draft>(loadDraft);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(
    localStorage.getItem(DRAFT_KEY) ? new Date() : null
  );
  const [submitError, setSubmitError] = useState("");
  // Per-step touched sets — errors only show after the user has interacted with a field
  const [touched1, setTouched1] = useState<Set<string>>(new Set());
  const [touched2, setTouched2] = useState<Set<string>>(new Set());
  const [, setTouched3] = useState<Set<string>>(new Set());

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

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraftRaw({
      step: 0,
      org_name: "", org_type: "", owner_user_id: "",
      country: "", state: "", city: "", address: "", website: "",
      contact_name: "", contact_email: "", contact_phone: "",
      subscription_plan: "free", sport_categories: "", description: ""
    });
    setDraftSavedAt(null);
    setTouched1(new Set()); setTouched2(new Set()); setTouched3(new Set());
  }

  // Each step validates only its own fields
  const step1Errors = {
    org_name: draft.org_name.trim().length < 2 ? "Organization name required (min 2 chars)" : "",
    org_type: !draft.org_type ? "Type required" : "",
    contact_email: draft.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact_email)
      ? "Invalid email format" : "",
  };
  const step1Valid = !step1Errors.org_name && !step1Errors.org_type;

  // Step 2 has no required fields
  const step2Errors = {
    contact_email: draft.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact_email)
      ? "Invalid email format" : "",
    website: draft.website && !/^https?:\/\/.+/.test(draft.website)
      ? "Must start with http:// or https://" : "",
  };
  const step2Valid = !step2Errors.contact_email && !step2Errors.website;

  // Step 3 has no required fields
  const step3Valid = true;

  const createOrg = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        org_name: draft.org_name,
        org_type: draft.org_type,
        subscription_plan: draft.subscription_plan,
      };
      if (draft.owner_user_id) body.owner_user_id = draft.owner_user_id;
      if (draft.description) body.description = draft.description;
      if (draft.country) body.country = draft.country;
      if (draft.state) body.state = draft.state;
      if (draft.city) body.city = draft.city;
      if (draft.address) body.address = draft.address;
      if (draft.website) body.website = draft.website;
      if (draft.contact_name) body.contact_name = draft.contact_name;
      if (draft.contact_email) body.contact_email = draft.contact_email;
      if (draft.contact_phone) body.contact_phone = draft.contact_phone;
      if (draft.sport_categories) {
        body.sport_categories = draft.sport_categories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return api.post("/admin/organizations", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      localStorage.removeItem(DRAFT_KEY);
      navigate("/admin/organizations");
    },
    onError: (e: any) => setSubmitError(humanizeError(e)),
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
        <button className="btn-secondary btn-sm" onClick={() => navigate("/admin/organizations")}>← Back to organizations</button>
        <PageHeader title="Create Organization" subtitle="Register a new organization on the platform" />
      </div>

      <Wizard
        steps={STEPS}
        currentStep={draft.step}
        canProceed={stepCanProceed()}
        isLastStep={draft.step === STEPS.length - 1}
        isSubmitting={createOrg.isPending}
        submitLabel="Create organization"
        error={submitError}
        draftSavedAt={draftSavedAt}
        onDiscardDraft={discardDraft}
        onBack={goBack}
        onNext={goNext}
        onSubmit={() => createOrg.mutate()}
      >
        {/* ── Step 1: Identity ──────────────────────────────────────────── */}
        {draft.step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Organization name" required>
              <input
                className="input"
                value={draft.org_name}
                onChange={(e) => setF("org_name", e.target.value)}
                onBlur={() => setTouched1((s) => new Set([...s, "org_name"]))}
                placeholder="Sportivox FC"
              />
              {touched1.has("org_name") && step1Errors.org_name && (
                <p className="text-xs text-red-600 mt-0.5">{step1Errors.org_name}</p>
              )}
            </Field>

            <Field label="Organization type" required>
              <select
                className="input"
                value={draft.org_type}
                onChange={(e) => setF("org_type", e.target.value)}
                onBlur={() => setTouched1((s) => new Set([...s, "org_type"]))}
              >
                <option value="">Select type…</option>
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              {touched1.has("org_type") && step1Errors.org_type && (
                <p className="text-xs text-red-600 mt-0.5">{step1Errors.org_type}</p>
              )}
            </Field>

            <div className="sm:col-span-2">
              <Field label="Owner user ID (optional)">
                <input
                  className="input"
                  value={draft.owner_user_id}
                  onChange={(e) => setF("owner_user_id", e.target.value)}
                  placeholder="Paste user UUID — leave blank to assign to your account"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Find the ID on the user's detail page. If left blank, the org is owned by the admin account creating it.
                </p>
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 2: Location & Contact ────────────────────────────────── */}
        {draft.step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Country">
              <input className="input" value={draft.country} onChange={(e) => setF("country", e.target.value)} placeholder="India" />
            </Field>
            <Field label="State">
              <input className="input" value={draft.state} onChange={(e) => setF("state", e.target.value)} placeholder="Maharashtra" />
            </Field>
            <Field label="City">
              <input className="input" value={draft.city} onChange={(e) => setF("city", e.target.value)} placeholder="Mumbai" />
            </Field>
            <Field label="Address">
              <input className="input" value={draft.address} onChange={(e) => setF("address", e.target.value)} placeholder="123 Main Street" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Website">
                <input
                  className="input"
                  value={draft.website}
                  onChange={(e) => setF("website", e.target.value)}
                  onBlur={() => setTouched2((s) => new Set([...s, "website"]))}
                  placeholder="https://yourorg.com"
                />
                {touched2.has("website") && step2Errors.website && (
                  <p className="text-xs text-red-600 mt-0.5">{step2Errors.website}</p>
                )}
              </Field>
            </div>
            <Field label="Contact name">
              <input className="input" value={draft.contact_name} onChange={(e) => setF("contact_name", e.target.value)} placeholder="Jane Smith" />
            </Field>
            <Field label="Contact email">
              <input
                className="input"
                type="email"
                value={draft.contact_email}
                onChange={(e) => setF("contact_email", e.target.value)}
                onBlur={() => setTouched2((s) => new Set([...s, "contact_email"]))}
                placeholder="contact@yourorg.com"
              />
              {touched2.has("contact_email") && step2Errors.contact_email && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.contact_email}</p>
              )}
            </Field>
            <Field label="Contact phone">
              <input className="input" value={draft.contact_phone} onChange={(e) => setF("contact_phone", e.target.value)} placeholder="+91 9876543210" />
            </Field>
          </div>
        )}

        {/* ── Step 3: Settings & Details ────────────────────────────────── */}
        {draft.step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Subscription plan">
                <select
                  className="input"
                  value={draft.subscription_plan}
                  onChange={(e) => setF("subscription_plan", e.target.value)}
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </Field>
              <Field label="Sport categories">
                <input
                  className="input"
                  value={draft.sport_categories}
                  onChange={(e) => setF("sport_categories", e.target.value)}
                  placeholder="Cricket, Football, Basketball"
                />
                <p className="text-xs text-slate-400 mt-1">Separate with commas</p>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className="input"
                rows={5}
                value={draft.description}
                onChange={(e) => setF("description", e.target.value)}
                placeholder="Tell us about this organization…"
              />
            </Field>
          </div>
        )}
      </Wizard>
    </div>
  );
}
