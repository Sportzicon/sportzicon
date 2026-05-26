import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";

export default function NewOrganization() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const orgQ = useQuery({
    queryKey: ["org", id],
    queryFn: async () => (await api.get(`/organizations/${id}`)).data.organization,
    enabled: !!id
  });

  const [form, setForm] = useState({
    org_name: "",
    org_type: "club" as "club" | "academy" | "both",
    description: "",
    country: "India",
    state: "",
    city: "",
    contact_email: "",
    contact_phone: "",
    sport_categories: ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (orgQ.data) {
      const org = orgQ.data;
      setForm({
        org_name: org.org_name || "",
        org_type: org.org_type || "club",
        description: org.description || "",
        country: org.country || "India",
        state: org.state || "",
        city: org.city || "",
        contact_email: org.contact_email || "",
        contact_phone: org.contact_phone || "",
        sport_categories: (org.sport_categories || []).join(", ")
      });
    }
  }, [orgQ.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload: any = {
        ...form,
        sport_categories: form.sport_categories.split(",").map((s) => s.trim()).filter(Boolean)
      };
      Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);

      isEdit ? await api.put(`/organizations/${id}`, payload) : await api.post("/organizations", payload);

      // Invalidate organization queries to get fresh data
      await qc.invalidateQueries({ queryKey: ["org"] });
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });

      navigate("/my-organizations");
    } catch (e) {
      setErr(getApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && orgQ.isPending) return <Spinner />;

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <PageHeader title={isEdit ? "Edit organization" : "Create an organization"} subtitle="Build your club or academy presence on Sportivox." />
      <section className="card card-body grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Name</span><input className="input" value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} required /></label>
        <label><span className="label">Type</span>
          <select className="input" value={form.org_type} onChange={(e) => setForm({ ...form, org_type: e.target.value as any })}>
            <option value="club">Club</option><option value="academy">Academy</option><option value="both">Both</option>
          </select>
        </label>
        <label><span className="label">Sport categories</span>
          <input className="input" value={form.sport_categories} onChange={(e) => setForm({ ...form, sport_categories: e.target.value })} placeholder="Football, Tennis (comma separated)" />
        </label>
        <label className="sm:col-span-2"><span className="label">Description</span>
          <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label><span className="label">Country</span><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
        <label><span className="label">State</span><input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
        <label><span className="label">City</span><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        <label><span className="label">Contact email</span><input className="input" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
        <label><span className="label">Contact phone</span><input className="input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></label>
      </section>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
      <button className="btn-primary" disabled={busy}>
        {busy ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save changes" : "Create organization"}
      </button>
    </form>
  );
}
