import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { humanizeError } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { PageHeader, Spinner } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { clearSportSpecific, validateAthleteSportProfile } from "../../../data/sportProfile";
import { Save } from "lucide-react";
import { ALL_ROLES } from "../../../utils/roles";
const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
const EXPERIENCE = ["beginner", "amateur", "semi_pro", "professional"] as const;
const AVAILABILITY = ["available", "not_available", "open_to_offers"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const q = useQuery({
    queryKey: queryKeys.adminUserDetail(id ?? ""),
    queryFn: async () => (await api.get(`/admin/users/${id}`)).data as Record<string, any>
  });

  const user = q.data;

  const [profile, setProfile] = useState<Record<string, any>>({});
  const [athleteData, setAthleteData] = useState<Record<string, any>>({});
  const [coachData, setCoachData] = useState<Record<string, any>>({});
  const [role, setRole] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (user && !initialized) {
    setProfile({
      full_name: user.full_name ?? "",
      bio: user.bio ?? "",
      phone: user.phone ?? "",
      country: user.country ?? "",
      state: user.state ?? "",
      city: user.city ?? "",
      dob: user.dob ?? "",
      gender: user.gender ?? "",
      preferred_language: user.preferred_language ?? "",
      profile_photo_url: user.profile_photo_url ?? "",
      cover_photo_url: user.cover_photo_url ?? ""
    });
    setAthleteData(user.athlete_data ?? {});
    setCoachData(user.coach_data ?? {});
    setRole(user.role ?? "athlete");
    setInitialized(true);
  }

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (user?.role === "athlete") {
        const sportErrors = validateAthleteSportProfile(athleteData);
        if (sportErrors.length) throw new Error(sportErrors[0]);
      }
      const body: Record<string, any> = {};
      for (const [k, v] of Object.entries(profile)) {
        if (v !== "" && v !== null) body[k] = v;
      }
      if (Object.keys(athleteData).length) body.athlete_data = athleteData;
      if (Object.keys(coachData).length) body.coach_data = coachData;
      await api.patch(`/admin/users/${id}/profile`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUserDetail(id ?? "") });
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      setSuccess("Profile saved."); setError("");
    },
    onError: (e: unknown) => { setError(humanizeError(e)); setSuccess(""); }
  });

  const saveRole = useMutation({
    mutationFn: async () => api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUserDetail(id ?? "") });
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      setSuccess("Role updated."); setError("");
    },
    onError: (e: unknown) => { setError(humanizeError(e)); setSuccess(""); }
  });

  const p = (key: string) => profile[key] ?? "";
  const setP = (key: string, val: string) => setProfile((prev) => ({ ...prev, [key]: val }));
  const ad = (key: string) => athleteData[key] ?? "";
  const setAd = (key: string, val: string | number | boolean) => setAthleteData((prev) => ({ ...prev, [key]: val }));
  const cd = (key: string) => coachData[key] ?? "";
  const setCd = (key: string, val: string | number | boolean) => setCoachData((prev) => ({ ...prev, [key]: val }));

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <div className="p-6 text-red-700">Failed to load user.</div>;

  const isAthlete = user?.role === "athlete";
  const isCoachOrScout = user?.role === "scout" || user?.role === "club";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <BackButton to="/admin/users" label="Users" />
        <PageHeader title={`Edit user: ${user?.full_name ?? id}`} subtitle={user?.email} />
      </div>

      {error && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      {/* Role change */}
      <div className="card card-body space-y-3">
        <h3 className="font-semibold text-slate-800">Account Role</h3>
        <div className="flex gap-3 items-end">
          <Field label="Role">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <button
            className="btn-primary"
            onClick={() => saveRole.mutate()}
            disabled={saveRole.isPending || role === user?.role}
          >
            {saveRole.isPending ? "Saving…" : "Change role"}
          </button>
        </div>
        <p className="text-xs text-slate-500">Current role: <strong>{user?.role}</strong> · Status: <strong>{user?.status}</strong></p>
      </div>

      {/* Basic profile */}
      <div className="card card-body space-y-4">
        <h3 className="font-semibold text-slate-800">Basic Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name">
            <input className="input" value={p("full_name")} onChange={(e) => setP("full_name", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="input" value={p("phone")} onChange={(e) => setP("phone", e.target.value)} />
          </Field>
          <Field label="Date of birth (YYYY-MM-DD)">
            <input className="input" value={p("dob")} onChange={(e) => setP("dob", e.target.value)} placeholder="1995-06-15" />
          </Field>
          <Field label="Gender">
            <select className="input" value={p("gender")} onChange={(e) => setP("gender", e.target.value)}>
              <option value="">— select —</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Country">
            <input className="input" value={p("country")} onChange={(e) => setP("country", e.target.value)} />
          </Field>
          <Field label="State">
            <input className="input" value={p("state")} onChange={(e) => setP("state", e.target.value)} />
          </Field>
          <Field label="City">
            <input className="input" value={p("city")} onChange={(e) => setP("city", e.target.value)} />
          </Field>
          <Field label="Preferred language">
            <input className="input" value={p("preferred_language")} onChange={(e) => setP("preferred_language", e.target.value)} />
          </Field>
          <Field label="Profile photo URL">
            <input className="input" value={p("profile_photo_url")} onChange={(e) => setP("profile_photo_url", e.target.value)} />
          </Field>
          <Field label="Cover photo URL">
            <input className="input" value={p("cover_photo_url")} onChange={(e) => setP("cover_photo_url", e.target.value)} />
          </Field>
        </div>
        <Field label="Bio">
          <textarea className="input" rows={3} value={p("bio")} onChange={(e) => setP("bio", e.target.value)} />
        </Field>
      </div>

      {/* Athlete data */}
      {isAthlete && (
        <div className="card card-body space-y-4">
          <h3 className="font-semibold text-slate-800">Athlete Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Primary sport">
              <input className="input" value={ad("primary_sport")}
                onChange={(e) => setAthleteData((prev) => clearSportSpecific({ ...prev, primary_sport: e.target.value }) as Record<string, any>)} />
            </Field>
            <Field label="Playing role / position">
              <input className="input" value={ad("playing_role")} onChange={(e) => setAd("playing_role", e.target.value)} />
            </Field>
            <Field label="Experience level">
              <select className="input" value={ad("experience_level")} onChange={(e) => setAd("experience_level", e.target.value)}>
                <option value="">— select —</option>
                {EXPERIENCE.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Availability">
              <select className="input" value={ad("availability")} onChange={(e) => setAd("availability", e.target.value)}>
                <option value="">— select —</option>
                {AVAILABILITY.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Current team">
              <input className="input" value={ad("current_team")} onChange={(e) => setAd("current_team", e.target.value)} />
            </Field>
            <Field label="Height (cm)">
              <input className="input min-h-[44px]" type="number" inputMode="numeric" value={ad("height_cm")} onChange={(e) => setAd("height_cm", Number(e.target.value))} />
            </Field>
            <Field label="Weight (kg)">
              <input className="input min-h-[44px]" type="number" inputMode="numeric" value={ad("weight_kg")} onChange={(e) => setAd("weight_kg", Number(e.target.value))} />
            </Field>
            <Field label="CV URL">
              <input className="input" value={ad("cv_url")} onChange={(e) => setAd("cv_url", e.target.value)} />
            </Field>
          </div>
          <Field label="Career summary">
            <textarea className="input" rows={3} value={ad("career_summary")} onChange={(e) => setAd("career_summary", e.target.value)} />
          </Field>
        </div>
      )}

      {/* Coach/Scout data */}
      {isCoachOrScout && (
        <div className="card card-body space-y-4">
          <h3 className="font-semibold text-slate-800">Coach / Scout Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Specialization">
              <input className="input" value={cd("specialization")} onChange={(e) => setCd("specialization", e.target.value)} />
            </Field>
            <Field label="Sport">
              <input className="input" value={cd("sport")} onChange={(e) => setCd("sport", e.target.value)} />
            </Field>
            <Field label="Years of experience">
              <input className="input min-h-[44px]" type="number" inputMode="numeric" value={cd("experience_years")} onChange={(e) => setCd("experience_years", Number(e.target.value))} />
            </Field>
            <Field label="Hiring status">
              <select className="input" value={cd("hiring_status")} onChange={(e) => setCd("hiring_status", e.target.value)}>
                <option value="">— select —</option>
                <option value="available">available</option>
                <option value="not_available">not_available</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      <div className="flex justify-end pb-8">
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => saveProfile.mutate()}
          disabled={saveProfile.isPending}
        >
          <Save className="h-4 w-4" />
          {saveProfile.isPending ? "Saving…" : "Save all changes"}
        </button>
      </div>
    </div>
  );
}
