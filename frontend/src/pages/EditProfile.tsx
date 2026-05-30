import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, SectionHead } from "../components/UI";
import { Camera } from "lucide-react";

// ============================================================================
// Edit profile — "Editorial Workstation" skin. Photo-upload flow, both form
// state objects, the submit/PUT logic and athlete branch are preserved exactly.
// ============================================================================

export default function EditProfile() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: user?.full_name ?? "",
    bio: user?.bio ?? "",
    country: user?.country ?? "",
    state: user?.state ?? "",
    city: user?.city ?? "",
    dob: user?.dob ?? "",
    gender: user?.gender ?? "prefer_not_to_say",
    phone: user?.phone ?? ""
  });
  const [athlete, setAthlete] = useState({
    primary_sport: user?.athlete?.primary_sport ?? "",
    position: user?.athlete?.position ?? "",
    batting_style: user?.athlete?.batting_style ?? "",
    bowling_style: user?.athlete?.bowling_style ?? "",
    experience_level: user?.athlete?.experience_level ?? "amateur",
    height_cm: user?.athlete?.height_cm ?? "",
    weight_kg: user?.athlete?.weight_kg ?? "",
    availability: user?.athlete?.availability ?? "available",
    looking_for_club: user?.athlete?.looking_for_club ?? false
  });
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(user?.profile_photo_url);
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>(user?.cover_photo_url);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"profile" | "cover" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  async function uploadPhoto(file: File, field: "profile" | "cover") {
    setUploading(field);
    setErr(null);
    try {
      const urlRes = await api.post("/media/upload-url", {
        category: "image",
        filename: file.name,
        content_type: file.type,
        content_length: file.size
      });
      const { upload_url, headers, public_url } = urlRes.data;
      await fetch(upload_url, { method: "PUT", headers, body: file });
      if (field === "profile") {
        setProfilePhoto(public_url);
        const r = await api.put("/users/me", { profile_photo_url: public_url });
        setUser(r.data.user);
      } else {
        setCoverPhoto(public_url);
        const r = await api.put("/users/me", { cover_photo_url: public_url });
        setUser(r.data.user);
      }
    } catch (e) {
      setErr(getApiError(e).message);
    } finally {
      setUploading(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const profilePatch: any = { ...form };
      Object.keys(profilePatch).forEach((k) => profilePatch[k] === "" && delete profilePatch[k]);
      const r1 = await api.put("/users/me", profilePatch);
      let updated = r1.data.user;
      if (user!.role === "athlete") {
        const ath: any = { ...athlete };
        if (ath.height_cm) ath.height_cm = Number(ath.height_cm);
        if (ath.weight_kg) ath.weight_kg = Number(ath.weight_kg);
        Object.keys(ath).forEach((k) => (ath[k] === "" || ath[k] == null) && delete ath[k]);
        const r2 = await api.put("/users/me/athlete", ath);
        updated = r2.data.user;
      }
      setUser(updated);
      navigate(`/profile/${user!.id}`);
    } catch (e) {
      setErr(getApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8">
      <PageHeader
        title="Edit profile"
        subtitle="Editing your profile"
        action={
          <div className="flex gap-2.5">
            <button type="button" className="btn-secondary" onClick={() => navigate(`/profile/${user!.id}`)}>Cancel</button>
            <button className="btn-accent" disabled={busy}>{busy ? "Saving…" : "✓ Save changes"}</button>
          </div>
        }
      />

      {/* photos */}
      <section>
        <SectionHead n="01" title="Photos" sub="Cover band & portrait" />
        <div className="card overflow-hidden">
          <div className="relative h-32 bg-ink">
            <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 11px)" }} />
            {coverPhoto && <img src={coverPhoto} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === "cover"}
              className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
              title="Change cover photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "cover"); }} />
          </div>
          <div className="card-body -mt-10 pb-4">
            <div className="relative inline-block">
              <div className="h-20 w-20 overflow-hidden rounded border-4 border-panel bg-fill">
                {profilePhoto && <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />}
              </div>
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                disabled={uploading === "profile"}
                className="absolute bottom-0 right-0 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/70"
                title="Change profile photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={profileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "profile"); }} />
            </div>
            {uploading && <p className="lab mt-2">Uploading {uploading} photo…</p>}
          </div>
        </div>
      </section>

      {/* basics */}
      <section>
        <SectionHead n="02" title="Basics" sub="Identity & contact" />
        <div className="card card-body space-y-4">
          <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Bio"><textarea className="input" rows={3} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Date of birth"><input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          </div>
          <Field label="Gender">
            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Country"><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            <Field label="State"><input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            <Field label="City"><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          </div>
        </div>
      </section>

      {/* athlete */}
      {user.role === "athlete" && (
        <section>
          <SectionHead n="03" title="Athlete details" sub="Sport, role & availability" />
          <div className="card card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary sport">
                <input className="input" list="sport-list" value={athlete.primary_sport}
                  onChange={(e) => setAthlete({ ...athlete, primary_sport: e.target.value })} />
                <datalist id="sport-list">
                  {["Cricket","Football","Basketball","Hockey","Athletics","Tennis","Badminton","Kabaddi","Volleyball","Boxing","Wrestling","Swimming"].map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
              <Field label="Position / Role">
                <input className="input" value={athlete.position} onChange={(e) => setAthlete({ ...athlete, position: e.target.value })}
                  placeholder={
                    athlete.primary_sport?.toLowerCase() === "cricket" ? "e.g. All-rounder, Opener, Fast bowler" :
                    athlete.primary_sport?.toLowerCase() === "football" ? "e.g. Striker, Right Back, Goalkeeper" :
                    athlete.primary_sport?.toLowerCase() === "basketball" ? "e.g. Point Guard, Centre, Power Forward" :
                    "e.g. Position or playing role"
                  }
                />
              </Field>
            </div>

            {/* Cricket-specific fields */}
            {athlete.primary_sport?.toLowerCase() === "cricket" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Batting style">
                  <select className="input" value={athlete.batting_style} onChange={(e) => setAthlete({ ...athlete, batting_style: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="Right-hand bat">Right-hand bat</option>
                    <option value="Left-hand bat">Left-hand bat</option>
                  </select>
                </Field>
                <Field label="Bowling style">
                  <select className="input" value={athlete.bowling_style} onChange={(e) => setAthlete({ ...athlete, bowling_style: e.target.value })}>
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

            {/* Tennis / Badminton — preferred hand */}
            {["tennis","badminton"].includes(athlete.primary_sport?.toLowerCase() ?? "") && (
              <Field label="Preferred hand">
                <select className="input" value={athlete.batting_style} onChange={(e) => setAthlete({ ...athlete, batting_style: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="Right-handed">Right-handed</option>
                  <option value="Left-handed">Left-handed</option>
                  <option value="Ambidextrous">Ambidextrous</option>
                </select>
              </Field>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Field label="Experience level">
                <select className="input" value={athlete.experience_level} onChange={(e) => setAthlete({ ...athlete, experience_level: e.target.value })}>
                  <option value="beginner">Beginner</option>
                  <option value="amateur">Amateur</option>
                  <option value="semi_pro">Semi-pro</option>
                  <option value="professional">Professional</option>
                </select>
              </Field>
              <Field label="Height (cm)">
                <input className="input font-mononum" type="number" value={athlete.height_cm as any}
                  onChange={(e) => setAthlete({ ...athlete, height_cm: e.target.value as any })} />
              </Field>
              <Field label="Weight (kg)">
                <input className="input font-mononum" type="number" value={athlete.weight_kg as any}
                  onChange={(e) => setAthlete({ ...athlete, weight_kg: e.target.value as any })} />
              </Field>
            </div>
            <Field label="Availability">
              <select className="input" value={athlete.availability} onChange={(e) => setAthlete({ ...athlete, availability: e.target.value })}>
                <option value="available">Available</option>
                <option value="open_to_offers">Open to offers</option>
                <option value="not_available">Not available</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-70 cursor-pointer">
              <input type="checkbox" className="accent-brand-500" checked={athlete.looking_for_club}
                onChange={(e) => setAthlete({ ...athlete, looking_for_club: e.target.checked })} />
              Currently looking for a club / academy / trial
            </label>
          </div>
        </section>
      )}

      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      <div className="flex justify-end gap-2.5 border-t border-hair pt-5">
        <button type="button" className="btn-secondary" onClick={() => navigate(`/profile/${user!.id}`)}>Cancel</button>
        <button className="btn-accent" disabled={busy}>{busy ? "Saving…" : "✓ Save changes"}</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
