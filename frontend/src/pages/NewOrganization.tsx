import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { PageHeader, Spinner, SectionHead } from "../components/UI";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
    </label>
  );
}

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

      await qc.invalidateQueries({ queryKey: ["org"] });
      await qc.invalidateQueries({ queryKey: ["my-orgs"] });

      navigate("/my-organizations");
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && orgQ.isPending) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      <PageHeader
        title={isEdit ? "Edit organization" : "Create an organization"}
        subtitle="Build presence"
        action={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-accent" disabled={busy}>
              {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create organization →"}
            </button>
          </div>
        }
      />

      <div className="panel p-6 space-y-4">
        <SectionHead n="01" title="Organization info" />
        <Field label="Name *">
          <input className="input" value={form.org_name} onChange={(e) => set("org_name", e.target.value)} required />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Type *">
            <select className="input" value={form.org_type} onChange={(e) => set("org_type", e.target.value)}>
              <option value="club">Club</option>
              <option value="academy">Academy</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Sports" hint="Comma-separated: Football, Cricket">
            <input className="input" value={form.sport_categories} onChange={(e) => set("sport_categories", e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </div>

      <div className="panel p-6 space-y-4">
        <SectionHead n="02" title="Location" />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Country">
            <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="State">
            <input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="City">
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="panel p-6 space-y-4">
        <SectionHead n="03" title="Contact details" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email">
            <input className="input" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </Field>
        </div>
      </div>

      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create organization →"}
        </button>
      </div>
    </form>
  );
}
