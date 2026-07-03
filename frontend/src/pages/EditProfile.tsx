import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, getApiError, humanizeError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { queryKeys } from "../hooks/queryKeys";
import { uploadToGCS } from "../hooks/useUpload";
import { PageHeader, SectionHead } from "../components/UI";
import { BackButton } from "../components/BackButton";
import { SportPositionSelect } from "../components/SportPositionSelect";
import { Camera, Plus, X } from "lucide-react";
import { COUNTRIES, statesForCountry } from "../data/geo";

export default function EditProfile() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    full_name: user?.full_name ?? "",
    bio: user?.bio ?? "",
    country: user?.country ?? "",
    state: user?.state ?? "",
    city: user?.city ?? "",
    dob: user?.dob ?? "",
    gender: user?.gender ?? "prefer_not_to_say",
    phone: user?.phone ?? "",
  });

  // Sport/position for athlete profile
  const [sport, setSport] = useState<string>(user?.athlete?.primary_sport ?? "");
  const [position, setPosition] = useState<string>(user?.athlete?.position ?? "");
  const [positionError, setPositionError] = useState<string>("");

  const [athlete, setAthlete] = useState({
    batting_style: user?.athlete?.batting_style ?? "",
    bowling_style: user?.athlete?.bowling_style ?? "",
    experience_level: user?.athlete?.experience_level ?? "amateur",
    height_cm: user?.athlete?.height_cm ?? "",
    weight_kg: user?.athlete?.weight_kg ?? "",
    availability: user?.athlete?.availability ?? "available",
    looking_for_club: user?.athlete?.looking_for_club ?? false,
    current_team: user?.athlete?.current_team ?? "",
    career_summary: user?.athlete?.career_summary ?? "",
  });

  // Achievements as simple string array per PROMPT 2 spec
  const [achievements, setAchievements] = useState<string[]>(() => {
    const raw = user?.athlete?.achievements ?? [];
    // Coerce legacy objects to strings
    return raw.map((a: unknown) =>
      typeof a === "string" ? a : typeof a === "object" && a !== null ? (a as { title?: string }).title ?? "" : ""
    ).filter(Boolean);
  });
  const [newAchievement, setNewAchievement] = useState("");

  const [stats, setStats] = useState<Record<string, string>>(
    (user?.athlete?.stats as Record<string, string>) ?? {}
  );
  const [newStatKey, setNewStatKey] = useState("");
  const [newStatValue, setNewStatValue] = useState("");

  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(user?.profile_photo_url);
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>(user?.cover_photo_url);
  const [uploading, setUploading] = useState<"profile" | "cover" | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  const isAthlete = user.role === "athlete";

  async function uploadPhoto(file: File, field: "profile" | "cover") {
    setUploading(field);
    setErr(null);
    try {
      const { url } = await uploadToGCS(file, "avatar");
      const key = field === "profile" ? "profile_photo_url" : "cover_photo_url";
      const r = await api.put("/users/me", { [key]: url });
      const updated = r.data.user;
      setUser(updated);
      qc.invalidateQueries({ queryKey: queryKeys.user(user!.id) });
      if (field === "profile") setProfilePhoto(url ?? undefined);
      else setCoverPhoto(url ?? undefined);
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setUploading(null);
    }
  }

  function handleSportChange(next: string) {
    setSport(next);
    setPosition("");
    setPositionError("");
  }

  function handlePositionChange(next: string) {
    setPosition(next);
    if (next) setPositionError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Validate sport+position cascade
    if (isAthlete && sport && !position) {
      setPositionError("Position is required when sport is selected");
      return;
    }
    setBusy(true);
    setErr(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const profilePatch: Record<string, unknown> = { ...form };
      // Strip empty strings so optional fields don't overwrite with ""
      Object.keys(profilePatch).forEach((k) => {
        if (profilePatch[k] === "") delete profilePatch[k];
      });
      const r1 = await api.put("/users/me", profilePatch);
      let updated = r1.data.user;

      if (isAthlete) {
        const athPayload: Record<string, unknown> = { ...athlete };
        if (athPayload.height_cm) athPayload.height_cm = Number(athPayload.height_cm);
        if (athPayload.weight_kg) athPayload.weight_kg = Number(athPayload.weight_kg);
        if (sport) athPayload.primary_sport = sport;
        if (position) athPayload.position = position;
        athPayload.achievements = achievements;
        athPayload.stats = stats;
        // Remove empty/falsy optional fields
        Object.keys(athPayload).forEach((k) => {
          const v = athPayload[k];
          if (
            v === "" || v == null ||
            (Array.isArray(v) && v.length === 0) ||
            (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
          ) {
            delete athPayload[k];
          }
        });
        const r2 = await api.put("/users/me/athlete", athPayload);
        updated = r2.data.user;
      }

      setUser(updated);
      // Invalidate cache — do NOT reset form (show saved values)
      qc.invalidateQueries({ queryKey: queryKeys.user(user!.id) });
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const apiErr = getApiError(e);
      if (apiErr.details?.fieldErrors) {
        setFieldErrors(apiErr.details.fieldErrors as Record<string, string[]>);
      } else {
        setErr(humanizeError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl pb-28">
      <BackButton className="mb-2" />
      <PageHeader
        title="Edit profile"
        subtitle="Update your public profile"
        sticky
      />

      {/* Success banner */}
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>✓</span>
          <span>Profile saved successfully.</span>
        </div>
      )}

      {/* ── Section 01: Photos ── */}
      <section className="mb-8">
        <SectionHead n="01" title="Photos" sub="Cover band & portrait" />
        <div className="card overflow-hidden">
          <div className="relative h-32 bg-ink">
            <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 11px)" }} />
            {coverPhoto && <img src={coverPhoto} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />}
            {uploading === "cover" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="font-mononum text-[11px] text-white tracking-[0.06em] uppercase">Uploading…</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === "cover"}
              className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Change cover photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "cover"); }}
            />
          </div>
          <div className="card-body -mt-10 pb-4">
            {/* Avatar with tap-to-change overlay */}
            <div className="relative inline-block group/avatar">
              <div className="h-20 w-20 overflow-hidden rounded border-4 border-panel bg-fill">
                {uploading === "profile" ? (
                  <div className="h-full w-full flex items-center justify-center bg-ink/80">
                    <span className="font-mononum text-[9px] text-white text-center leading-tight tracking-[0.04em] uppercase px-1">Uploading…</span>
                  </div>
                ) : profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-fill text-ink-faint">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
              </div>
              {/* Tap to change — visible on mobile, hover on desktop */}
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                disabled={uploading === "profile"}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded opacity-100 lg:opacity-0 lg:group-hover/avatar:opacity-100 transition-opacity disabled:opacity-40"
                title="Change profile photo"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "profile"); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 02: Basics ── */}
      <section className="mb-8">
        <SectionHead n="02" title="Basics" sub="Identity & contact" />
        <div className="card card-body space-y-4">
          <Field label="Full name">
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field label="Bio">
            <textarea
              className="input"
              rows={3}
              maxLength={500}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-faint text-right">{form.bio.length}/500</p>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                className="input"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Date of birth">
              <input
                className="input"
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Gender">
            <select
              className="input"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Country">
              <select
                className="input"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value, state: "" })}
              >
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="State">
              {statesForCountry(form.country) ? (
                <select
                  className="input"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                >
                  <option value="">Select state…</option>
                  {statesForCountry(form.country)!.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder="e.g. Maharashtra"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              )}
            </Field>
            <Field label="City">
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ── Section 03: Sport & Role (athlete only) ── */}
      {isAthlete && (
        <section className="mb-8">
          <SectionHead n="03" title="Sport & Role" sub="Sport, position & availability" />
          <div className="card card-body space-y-5">
            {/* Sport + Position via SportPositionSelect — cascade enforced */}
            <SportPositionSelect
              sportValue={sport}
              positionValue={position}
              onSportChange={handleSportChange}
              onPositionChange={handlePositionChange}
              positionError={positionError}
              required={false}
              layout="row"
            />

            {/* Cricket-specific fields */}
            {sport.toLowerCase() === "cricket" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Batting style">
                  <select
                    className="input min-h-[44px]"
                    value={athlete.batting_style}
                    onChange={(e) => setAthlete({ ...athlete, batting_style: e.target.value })}
                  >
                    <option value="">Select…</option>
                    <option value="Right-hand bat">Right-hand bat</option>
                    <option value="Left-hand bat">Left-hand bat</option>
                  </select>
                </Field>
                <Field label="Bowling style">
                  <select
                    className="input min-h-[44px]"
                    value={athlete.bowling_style}
                    onChange={(e) => setAthlete({ ...athlete, bowling_style: e.target.value })}
                  >
                    <option value="">Select / Not applicable</option>
                    <option value="Right-arm fast">Right-arm fast</option>
                    <option value="Right-arm fast-medium">Right-arm fast-medium</option>
                    <option value="Right-arm medium">Right-arm medium</option>
                    <option value="Right-arm off-break">Right-arm off-break</option>
                    <option value="Right-arm leg-break">Right-arm leg-break</option>
                    <option value="Left-arm fast">Left-arm fast</option>
                    <option value="Left-arm fast-medium">Left-arm fast-medium</option>
                    <option value="Left-arm orthodox">Left-arm orthodox</option>
                    <option value="Left-arm chinaman">Left-arm chinaman</option>
                    <option value="Does not bowl">Does not bowl</option>
                  </select>
                </Field>
              </div>
            )}

            {/* Tennis/Badminton hand */}
            {["tennis", "badminton"].includes(sport.toLowerCase()) && (
              <Field label="Preferred hand">
                <select
                  className="input min-h-[44px]"
                  value={athlete.batting_style}
                  onChange={(e) => setAthlete({ ...athlete, batting_style: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option value="Right-handed">Right-handed</option>
                  <option value="Left-handed">Left-handed</option>
                  <option value="Ambidextrous">Ambidextrous</option>
                </select>
              </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Experience level">
                <select
                  className="input min-h-[44px]"
                  value={athlete.experience_level}
                  onChange={(e) => setAthlete({ ...athlete, experience_level: e.target.value })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="amateur">Amateur</option>
                  <option value="semi_pro">Semi-pro</option>
                  <option value="professional">Professional</option>
                </select>
              </Field>
              <Field label="Current team">
                <input
                  className="input min-h-[44px]"
                  value={athlete.current_team}
                  onChange={(e) => setAthlete({ ...athlete, current_team: e.target.value })}
                  placeholder="e.g. Delhi Capitals"
                />
              </Field>
            </div>

            {/* Physical stats */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height">
                <div className="relative">
                  <input
                    className="input min-h-[44px] pr-10"
                    type="number"
                    inputMode="numeric"
                    min={100}
                    max={250}
                    value={athlete.height_cm as string | number}
                    onChange={(e) => setAthlete({ ...athlete, height_cm: e.target.value as any })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">cm</span>
                </div>
              </Field>
              <Field label="Weight">
                <div className="relative">
                  <input
                    className="input min-h-[44px] pr-10"
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={200}
                    value={athlete.weight_kg as string | number}
                    onChange={(e) => setAthlete({ ...athlete, weight_kg: e.target.value as any })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">kg</span>
                </div>
              </Field>
            </div>

            {/* Availability — segmented control style */}
            <div>
              <span className="label block mb-2">Availability</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: "available", label: "Available" },
                  { value: "open_to_offers", label: "Open to offers" },
                  { value: "not_available", label: "Not available" },
                ].map(({ value, label }) => (
                  <label
                    key={value}
                    className={`flex items-center justify-center gap-2 rounded border-2 px-3 min-h-[44px] cursor-pointer transition font-medium text-sm ${
                      athlete.availability === value
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-hairsoft bg-paper text-ink-sub hover:border-ink-sub"
                    }`}
                  >
                    <input
                      type="radio"
                      name="availability"
                      value={value}
                      checked={athlete.availability === value}
                      onChange={() => setAthlete({ ...athlete, availability: value })}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-70 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                className="accent-brand-500 h-4 w-4"
                checked={athlete.looking_for_club}
                onChange={(e) => setAthlete({ ...athlete, looking_for_club: e.target.checked })}
              />
              Currently looking for a club / academy / trial
            </label>
          </div>
        </section>
      )}

      {/* ── Section 04: Career Summary ── */}
      {isAthlete && (
        <section className="mb-8">
          <SectionHead n="04" title="Career Summary" sub="Overview of your career" />
          <div className="card card-body">
            <textarea
              className="input w-full"
              rows={4}
              maxLength={1000}
              placeholder="Describe your career highlights, achievements, and journey…"
              value={athlete.career_summary}
              onChange={(e) => setAthlete({ ...athlete, career_summary: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-faint text-right">{athlete.career_summary.length}/1000</p>
          </div>
        </section>
      )}

      {/* ── Section 05: Achievements ── */}
      {isAthlete && (
        <section className="mb-8">
          <SectionHead n="05" title="Achievements" sub="Awards, titles & records (max 20)" />
          <div className="card card-body space-y-3">
            {achievements.map((ach, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  className="input flex-1 min-h-[44px]"
                  value={ach}
                  maxLength={200}
                  placeholder="e.g. Man of the Match, Regional Champion"
                  onChange={(e) => {
                    const next = [...achievements];
                    next[idx] = e.target.value;
                    setAchievements(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAchievements(achievements.filter((_, i) => i !== idx))}
                  className="flex-shrink-0 rounded border border-hairsoft bg-paper p-2 text-ink-sub hover:text-red-500 hover:border-red-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {achievements.length < 20 && (
              <div className="flex gap-2 items-center pt-1">
                <input
                  className="input flex-1 min-h-[44px]"
                  value={newAchievement}
                  maxLength={200}
                  placeholder="Add an achievement…"
                  onChange={(e) => setNewAchievement(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newAchievement.trim()) {
                        setAchievements([...achievements, newAchievement.trim()]);
                        setNewAchievement("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newAchievement.trim()) {
                      setAchievements([...achievements, newAchievement.trim()]);
                      setNewAchievement("");
                    }
                  }}
                  className="flex-shrink-0 rounded border border-brand-500 bg-brand-50 text-brand-600 p-2 hover:bg-brand-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Add"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-xs text-ink-faint">Press Enter or click + to add. {achievements.length}/20 items.</p>
          </div>
        </section>
      )}

      {/* ── Section 06: Statistics ── */}
      {isAthlete && (
        <section className="mb-8">
          <SectionHead n="06" title="Statistics" sub="Career statistics & records" />
          <div className="card card-body space-y-3">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="flex gap-2 items-center">
                <span className="flex-1 rounded bg-fill px-3 py-2 text-sm min-h-[44px] flex items-center">
                  <span className="font-medium text-ink">{key}:</span>
                  <span className="ml-2 text-ink-sub">{value}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...stats };
                    delete next[key];
                    setStats(next);
                  }}
                  className="flex-shrink-0 rounded border border-hairsoft bg-paper p-2 text-ink-sub hover:text-red-500 hover:border-red-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="input flex-1 min-h-[44px]"
                placeholder="e.g. Runs scored, Wickets"
                value={newStatKey}
                onChange={(e) => setNewStatKey(e.target.value)}
              />
              <input
                className="input flex-1 min-h-[44px]"
                placeholder="Value"
                value={newStatValue}
                onChange={(e) => setNewStatValue(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  if (newStatKey.trim() && newStatValue.trim()) {
                    setStats({ ...stats, [newStatKey.trim()]: newStatValue.trim() });
                    setNewStatKey("");
                    setNewStatValue("");
                  }
                }}
                className="btn-secondary min-h-[44px]"
              >
                Add
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Error display */}
      {err && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>
      )}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 p-3">
          <div className="text-sm font-semibold text-red-800 mb-2">Please fix the following errors:</div>
          <ul className="text-sm text-red-700 space-y-1">
            {Object.entries(fieldErrors).map(([field, msgs]) => (
              <li key={field}>• <span className="font-medium">{formatFieldName(field)}:</span> {(msgs as string[]).join(", ")}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Desktop save row */}
      <div className="hidden lg:flex justify-end gap-2.5 border-t border-hair pt-5">
        <button type="button" className="btn-secondary" onClick={() => navigate(`/profile/${user.id}`)}>
          Cancel
        </button>
        <button className="btn-accent" disabled={busy}>
          {busy ? "Saving…" : "✓ Save changes"}
        </button>
      </div>

      {/* Mobile sticky bottom save bar */}
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-40 lg:hidden bg-paper border-t border-hair px-4 py-3 flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1 min-h-[44px]"
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          Cancel
        </button>
        <button className="btn-accent flex-1 min-h-[44px]" disabled={busy}>
          {busy ? "Saving…" : "✓ Save"}
        </button>
      </div>
    </form>
  );
}

function formatFieldName(field: string): string {
  return field
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
