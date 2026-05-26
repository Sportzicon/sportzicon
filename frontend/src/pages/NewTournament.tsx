import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner } from "../components/UI";

export default function NewTournament() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const orgsQ = useQuery({
    queryKey: ["my-orgs"],
    queryFn: async () => (await api.get("/organizations/mine")).data.items as any[]
  });

  const oppQ = useQuery({
    queryKey: ["opp", id],
    queryFn: async () => (await api.get(`/opportunities/${id}`)).data.opportunity,
    enabled: !!id
  });

  const [form, setForm] = useState({
    org_id: "",
    title: "",
    type: "tournament",
    sport: "",
    description: "",
    eligibility: "",
    age_min: 14,
    age_max: 35,
    gender_eligibility: "all",
    experience_level_required: "any",
    country: "India",
    state: "",
    city: "",
    start_date: "",
    end_date: "",
    application_deadline: "",
    vacancies: undefined as number | undefined
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
        org_id: opp.org_id || "",
        title: opp.title || "",
        type: "tournament",
        sport: opp.sport || "",
        description: opp.description || "",
        eligibility: opp.eligibility || "",
        age_min: opp.age_min || 14,
        age_max: opp.age_max || 35,
        gender_eligibility: opp.gender_eligibility || "all",
        experience_level_required: opp.experience_level_required || "any",
        country: opp.country || "India",
        state: opp.state || "",
        city: opp.city || "",
        start_date: opp.start_date || "",
        end_date: opp.end_date || "",
        application_deadline: opp.application_deadline || "",
        vacancies: opp.vacancies || undefined
      });
    }
  }, [oppQ.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const payload: any = { ...form };
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] == null) && delete payload[k]);
      if (payload.vacancies) payload.vacancies = Number(payload.vacancies);
      payload.age_min = Number(payload.age_min);
      payload.age_max = Number(payload.age_max);

      const r = isEdit
        ? await api.put(`/opportunities/${id}`, payload)
        : await api.post("/opportunities", payload);

      await qc.invalidateQueries({ queryKey: ["opp"] });
      await qc.invalidateQueries({ queryKey: ["tournaments"] });

      navigate(`/opportunities/${r.data.opportunity.id}`);
    } catch (e) {
      const er = getApiError(e);
      setErr(er.message + (er.details ? ` — ${JSON.stringify(er.details)}` : ""));
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && oppQ.isPending) return <Spinner />;

  if (!isEdit && !isAdmin && !orgsQ.data?.length) {
    return (
      <div className="card card-body">
        <h2 className="font-semibold">Create an organization first</h2>
        <p className="text-sm text-slate-600 mt-1">You need an organization profile before posting tournaments.</p>
        <button className="btn-primary mt-3" onClick={() => navigate("/organizations/new")}>Create organization</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl">
      <PageHeader title={isEdit ? "Edit tournament" : "Post a tournament"} subtitle="Organize competitive tournaments and sporting events." />
      <section className="card card-body grid gap-3 sm:grid-cols-2">
        {!isAdmin && (
          <label className="sm:col-span-2"><span className="label">Organization</span>
            <select className="input" value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
              {orgsQ.data!.map((o) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
            </select>
          </label>
        )}
        {isAdmin && (
          <label className="sm:col-span-2"><span className="label">Organization (Optional)</span>
            <select className="input" value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
              <option value="">No organization</option>
              {orgsQ.data?.map((o) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
            </select>
          </label>
        )}
        <label className="sm:col-span-2"><span className="label">Title</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label><span className="label">Sport</span>
          <input className="input" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} required />
        </label>
        <label><span className="label">Format</span>
          <input className="input" placeholder="E.g., League, Knockout, Round-robin" value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
        </label>
        <label className="sm:col-span-2"><span className="label">Description</span>
          <textarea className="input" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <label><span className="label">Age min</span>
          <input className="input" type="number" value={form.age_min} onChange={(e) => setForm({ ...form, age_min: Number(e.target.value) })} />
        </label>
        <label><span className="label">Age max</span>
          <input className="input" type="number" value={form.age_max} onChange={(e) => setForm({ ...form, age_max: Number(e.target.value) })} />
        </label>
        <label><span className="label">Gender eligibility</span>
          <select className="input" value={form.gender_eligibility} onChange={(e) => setForm({ ...form, gender_eligibility: e.target.value })}>
            <option>all</option><option>male</option><option>female</option><option>other</option>
          </select>
        </label>
        <label><span className="label">Experience required</span>
          <select className="input" value={form.experience_level_required} onChange={(e) => setForm({ ...form, experience_level_required: e.target.value })}>
            <option>any</option><option>beginner</option><option>amateur</option><option>semi_pro</option><option>professional</option>
          </select>
        </label>
        <label><span className="label">Country</span><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
        <label><span className="label">State</span><input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required /></label>
        <label><span className="label">City</span><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
        <label><span className="label">Max participants</span>
          <input className="input" type="number" value={form.vacancies ?? ""} onChange={(e) => setForm({ ...form, vacancies: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label><span className="label">Start date</span><input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></label>
        <label><span className="label">End date</span><input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></label>
        <label className="sm:col-span-2"><span className="label">Registration deadline</span><input className="input" type="date" value={form.application_deadline} onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} required /></label>
      </section>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
      <button className="btn-primary" disabled={busy}>
        {busy ? (isEdit ? "Saving..." : "Posting...") : isEdit ? "Save changes" : "Post tournament"}
      </button>
    </form>
  );
}
