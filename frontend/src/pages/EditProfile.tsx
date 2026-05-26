import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader } from "../components/UI";

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
    experience_level: user?.athlete?.experience_level ?? "amateur",
    height_cm: user?.athlete?.height_cm ?? "",
    weight_kg: user?.athlete?.weight_kg ?? "",
    availability: user?.athlete?.availability ?? "available",
    looking_for_club: user?.athlete?.looking_for_club ?? false
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) return null;

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
    <form onSubmit={submit} className="space-y-6 max-w-2xl">
      <PageHeader title="Edit your profile" subtitle="Make sure your details are complete — verified profiles rank higher in search." />

      <section className="card card-body space-y-4">
        <h2 className="text-base font-semibold">Basics</h2>
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
      </section>

      {user.role === "athlete" && (
        <section className="card card-body space-y-4">
          <h2 className="text-base font-semibold">Athlete details</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary sport"><input className="input" value={athlete.primary_sport} onChange={(e) => setAthlete({ ...athlete, primary_sport: e.target.value })} /></Field>
            <Field label="Position / Role"><input className="input" value={athlete.position} onChange={(e) => setAthlete({ ...athlete, position: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Experience level">
              <select className="input" value={athlete.experience_level} onChange={(e) => setAthlete({ ...athlete, experience_level: e.target.value })}>
                <option>beginner</option><option>amateur</option><option>semi_pro</option><option>professional</option>
              </select>
            </Field>
            <Field label="Height (cm)"><input className="input" type="number" value={athlete.height_cm as any} onChange={(e) => setAthlete({ ...athlete, height_cm: e.target.value as any })} /></Field>
            <Field label="Weight (kg)"><input className="input" type="number" value={athlete.weight_kg as any} onChange={(e) => setAthlete({ ...athlete, weight_kg: e.target.value as any })} /></Field>
          </div>
          <Field label="Availability">
            <select className="input" value={athlete.availability} onChange={(e) => setAthlete({ ...athlete, availability: e.target.value })}>
              <option value="available">Available</option><option value="open_to_offers">Open to offers</option><option value="not_available">Not available</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={athlete.looking_for_club} onChange={(e) => setAthlete({ ...athlete, looking_for_club: e.target.checked })} />
            Currently looking for a club / academy / trial
          </label>
        </section>
      )}

      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
