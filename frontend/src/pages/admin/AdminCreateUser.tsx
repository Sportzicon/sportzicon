import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, humanizeError } from "../../api/client";
import { queryKeys } from "../../hooks/queryKeys";
import { Wizard } from "../../components/Wizard";
import { PageHeader } from "../../components/UI";

const DRAFT_KEY = "admin_create_user_draft";

const STEPS = [
  { title: "Account Setup", subtitle: "Email, password and role" },
  { title: "Profile Details", subtitle: "Name and location" },
];

type Draft = {
  step: number;
  // step 1
  email: string;
  password: string;
  confirm_password: string;
  role: string;
  // step 2
  full_name: string;
  phone: string;
  country: string;
  state: string;
  city: string;
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    step: 0,
    email: "", password: "", confirm_password: "", role: "athlete",
    full_name: "", phone: "", country: "", state: "", city: ""
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

export default function AdminCreateUser() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraftRaw] = useState<Draft>(loadDraft);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(
    localStorage.getItem(DRAFT_KEY) ? new Date() : null
  );
  const [submitError, setSubmitError] = useState("");
  // Per-step touched state — only show errors for fields the user has interacted with
  const [touched1, setTouched1] = useState<Set<string>>(new Set());
  const [touched2, setTouched2] = useState<Set<string>>(new Set());

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

  function touch1(key: string) {
    setTouched1((s) => new Set([...s, key]));
  }

  function touch2(key: string) {
    setTouched2((s) => new Set([...s, key]));
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraftRaw({
      step: 0,
      email: "", password: "", confirm_password: "", role: "athlete",
      full_name: "", phone: "", country: "", state: "", city: ""
    });
    setDraftSavedAt(null);
    setTouched1(new Set());
    setTouched2(new Set());
  }

  // Step 1 validation — only checks step 1 fields
  const step1Errors = {
    email: !draft.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) ? "Valid email required" : "",
    password: draft.password.length < 6 ? "Minimum 6 characters" : "",
    confirm_password: draft.confirm_password !== draft.password ? "Passwords do not match" : "",
  };
  const step1Valid = !step1Errors.email && !step1Errors.password && !step1Errors.confirm_password;

  // Step 2 validation — only checks step 2 fields
  const step2Errors = {
    full_name: draft.full_name.trim().length < 2 ? "Name required (min 2 chars)" : "",
  };
  const step2Valid = !step2Errors.full_name;

  const createUser = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        email: draft.email,
        password: draft.password,
        full_name: draft.full_name,
        role: draft.role,
      };
      if (draft.phone) body.phone = draft.phone;
      if (draft.country) body.country = draft.country;
      if (draft.state) body.state = draft.state;
      if (draft.city) body.city = draft.city;
      return api.post("/admin/users", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      localStorage.removeItem(DRAFT_KEY);
      navigate("/admin/users");
    },
    onError: (e: unknown) => setSubmitError(humanizeError(e)),
  });

  function goNext() {
    setDraft((d) => ({ ...d, step: 1 }));
    setTouched1(new Set()); // clear touched so step 2 starts fresh
    window.scrollTo(0, 0);
  }

  function goBack() {
    setDraft((d) => ({ ...d, step: 0 }));
    setTouched2(new Set());
    window.scrollTo(0, 0);
  }

  const canProceedStep1 = step1Valid;
  const canProceedStep2 = step2Valid;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <button className="btn-secondary btn-sm" onClick={() => navigate("/admin/users")}>← Back to users</button>
        <PageHeader title="Create User" subtitle="Add a new account to the platform" />
      </div>

      <Wizard
        steps={STEPS}
        currentStep={draft.step}
        canProceed={draft.step === 0 ? canProceedStep1 : canProceedStep2}
        isLastStep={draft.step === STEPS.length - 1}
        isSubmitting={createUser.isPending}
        submitLabel="Create user"
        error={submitError}
        draftSavedAt={draftSavedAt}
        onDiscardDraft={discardDraft}
        onBack={goBack}
        onNext={goNext}
        onSubmit={() => createUser.mutate()}
      >
        {draft.step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" required>
              <input
                className="input min-h-[44px]"
                type="email"
                inputMode="email"
                value={draft.email}
                onChange={(e) => setF("email", e.target.value)}
                onBlur={() => touch1("email")}
                placeholder="user@example.com"
              />
              {touched1.has("email") && step1Errors.email && (
                <p className="text-xs text-red-600 mt-0.5">{step1Errors.email}</p>
              )}
            </Field>

            <Field label="Role" required>
              <select
                className="input"
                value={draft.role}
                onChange={(e) => setF("role", e.target.value)}
              >
                <option value="athlete">Athlete</option>
                <option value="club">Club</option>
                <option value="scout">Scout</option>
                <option value="organizer">Organizer</option>
                <option value="admin">Admin</option>
                <option value="scorer">Scorer</option>
              </select>
            </Field>

            <Field label="Password" required>
              <input
                className="input"
                type="password"
                value={draft.password}
                onChange={(e) => setF("password", e.target.value)}
                onBlur={() => touch1("password")}
                placeholder="Min 6 characters"
              />
              {touched1.has("password") && step1Errors.password && (
                <p className="text-xs text-red-600 mt-0.5">{step1Errors.password}</p>
              )}
            </Field>

            <Field label="Confirm password" required>
              <input
                className="input"
                type="password"
                value={draft.confirm_password}
                onChange={(e) => setF("confirm_password", e.target.value)}
                onBlur={() => touch1("confirm_password")}
                placeholder="Repeat password"
              />
              {touched1.has("confirm_password") && step1Errors.confirm_password && (
                <p className="text-xs text-red-600 mt-0.5">{step1Errors.confirm_password}</p>
              )}
            </Field>
          </div>
        )}

        {draft.step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" required>
              <input
                className="input"
                value={draft.full_name}
                onChange={(e) => setF("full_name", e.target.value)}
                onBlur={() => touch2("full_name")}
                placeholder="Jane Smith"
              />
              {touched2.has("full_name") && step2Errors.full_name && (
                <p className="text-xs text-red-600 mt-0.5">{step2Errors.full_name}</p>
              )}
            </Field>

            <Field label="Phone">
              <input
                className="input"
                value={draft.phone}
                onChange={(e) => setF("phone", e.target.value)}
                placeholder="+91 9876543210"
              />
            </Field>

            <Field label="Country">
              <input
                className="input"
                value={draft.country}
                onChange={(e) => setF("country", e.target.value)}
                placeholder="India"
              />
            </Field>

            <Field label="State">
              <input
                className="input"
                value={draft.state}
                onChange={(e) => setF("state", e.target.value)}
                placeholder="Maharashtra"
              />
            </Field>

            <Field label="City">
              <input
                className="input"
                value={draft.city}
                onChange={(e) => setF("city", e.target.value)}
                placeholder="Mumbai"
              />
            </Field>
          </div>
        )}
      </Wizard>
    </div>
  );
}
