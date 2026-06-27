import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError, humanizeError } from "../api/client";
import { PageHeader, Spinner, SectionHead } from "../components/UI";
import { COUNTRIES, statesForCountry } from "../data/geo";
import { SPORTS_LIST } from "../data/sportPositions";
import { Camera, Upload, X, FileText } from "lucide-react";
import { queryKeys } from "../hooks/queryKeys";

const ORG_TYPES = [
  { value: "club", label: "Club" },
  { value: "academy", label: "Academy" },
  { value: "school", label: "School" },
  { value: "university", label: "University" },
  { value: "association", label: "Association" }
];

function Field({ label, req, hint, error, children }: {
  label: string; req?: boolean; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}{req && <span className="text-brand-500"> *</span>}</span>
      {children}
      {error && <span className="text-red-600 text-xs mt-1 block">{error}</span>}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
    </label>
  );
}

function SportChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-2 rounded border transition"
      style={{
        background: active ? "#14110D" : undefined,
        color: active ? "#F7F5EF" : undefined,
        borderColor: active ? "#14110D" : undefined
      }}
    >
      {label}
    </button>
  );
}

interface UploadedDoc {
  key: string;
  name: string;
}

export default function NewOrganization() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const orgQ = useQuery({
    queryKey: queryKeys.organization(id ?? ""),
    queryFn: async () => (await api.get(`/organizations/${id}`)).data.organization,
    enabled: !!id
  });

  const existingDocsQ = useQuery({
    queryKey: queryKeys.orgDocuments(id ?? ""),
    queryFn: async () => (await api.get(`/organizations/${id}/documents`)).data.items as UploadedDoc[],
    enabled: !!id
  });

  const [form, setForm] = useState({
    org_name: "",
    org_type: "club" as string,
    description: "",
    country: "India",
    state: "",
    city: "",
    address: "",
    website: "",
    year_established: "",
    contact_name: "",
    contact_email: "",
    contact_phone: ""
  });
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState<"logo" | "cover" | "doc" | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [docProgress, setDocProgress] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (orgQ.data) {
      const org = orgQ.data;
      setForm({
        org_name: org.org_name ?? "",
        org_type: org.org_type ?? "club",
        description: org.description ?? "",
        country: org.country ?? "India",
        state: org.state ?? "",
        city: org.city ?? "",
        address: org.address ?? "",
        website: org.website ?? "",
        year_established: org.year_established ? String(org.year_established) : "",
        contact_name: org.contact_name ?? "",
        contact_email: org.contact_email ?? "",
        contact_phone: org.contact_phone ?? ""
      });
      setSelectedSports(org.sport_categories ?? []);
      setLogoUrl(org.logo_url ?? undefined);
      setCoverUrl(org.cover_url ?? undefined);
    }
  }, [orgQ.data]);

  async function uploadPhoto(file: File, field: "logo" | "cover") {
    setUploading(field);
    setErr(null);
    try {
      const urlRes = await api.post("/media/upload-url", {
        context: "org-logo",
        fileName: file.name,
        contentType: file.type,
      });
      const { upload_url, headers, public_url } = urlRes.data;
      await fetch(upload_url, { method: "PUT", headers, body: file });
      if (field === "logo") {
        setLogoUrl(public_url);
        if (isEdit) {
          await api.put(`/organizations/${id}`, { logo_url: public_url });
          qc.invalidateQueries({ queryKey: queryKeys.organization(id!) });
        }
      } else {
        setCoverUrl(public_url);
        if (isEdit) {
          await api.put(`/organizations/${id}`, { cover_url: public_url });
          qc.invalidateQueries({ queryKey: queryKeys.organization(id!) });
        }
      }
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setUploading(null);
    }
  }

  async function uploadDocument(file: File) {
    setUploading("doc");
    setDocProgress(0);
    setErr(null);
    try {
      // Step 1: get signed URL for private doc
      const urlRes = await api.post("/media/upload-url", {
        context: "org-doc",
        fileName: file.name,
        contentType: file.type,
      });
      const { upload_url, headers, object_name } = urlRes.data;

      // Step 2: upload with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setDocProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", upload_url);
        Object.entries(headers ?? {}).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));
        xhr.send(file);
      });

      // Step 3: if editing, record immediately; otherwise queue for after save
      if (isEdit) {
        await api.post(`/organizations/${id}/documents`, { key: object_name, name: file.name });
        qc.invalidateQueries({ queryKey: queryKeys.orgDocuments(id!) });
      } else {
        setUploadedDocs((prev) => [...prev, { key: object_name, name: file.name }]);
      }
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setUploading(null);
      setDocProgress(0);
    }
  }

  function toggleSport(sport: string) {
    setSelectedSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.org_name.trim()) { setErr("Organization name is required."); return; }
    setBusy(true);
    setErr(null);
    setFieldErrors({});
    try {
      const payload: Record<string, unknown> = {
        ...form,
        sport_categories: selectedSports,
        ...(logoUrl ? { logo_url: logoUrl } : {}),
        ...(coverUrl ? { cover_url: coverUrl } : {})
      };
      if (payload.year_established) payload.year_established = parseInt(payload.year_established as string, 10);
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === null) delete payload[k];
      });

      let newId = id;
      if (isEdit) {
        await api.put(`/organizations/${id}`, payload);
      } else {
        const res = await api.post("/organizations", payload);
        newId = res.data.organization?.id;
      }

      // Record any queued documents after create
      if (!isEdit && newId && uploadedDocs.length > 0) {
        for (const doc of uploadedDocs) {
          await api.post(`/organizations/${newId}/documents`, { key: doc.key, name: doc.name });
        }
      }

      await qc.invalidateQueries({ queryKey: queryKeys.myOrganizations() });
      if (newId) await qc.invalidateQueries({ queryKey: queryKeys.organization(newId) });
      navigate("/my-organizations");
    } catch (e) {
      const apiErr = getApiError(e);
      if (apiErr.details?.fieldErrors) {
        const errors: Record<string, string> = {};
        for (const [field, messages] of Object.entries(apiErr.details.fieldErrors)) {
          errors[field] = (messages as string[])[0] || "Invalid value";
        }
        setFieldErrors(errors);
        setErr(apiErr.message || "Please fix the errors below");
        const firstErrorField = Object.keys(errors)[0];
        setTimeout(() => {
          document.querySelector(`[name="${firstErrorField}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      } else {
        setErr(humanizeError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && orgQ.isPending) {
    return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const stateOptions = statesForCountry(form.country);

  return (
    <form onSubmit={submit} noValidate className="space-y-4 max-w-3xl pb-24 sm:pb-6">
      <PageHeader
        title={isEdit ? "Edit organization" : "Create an organization"}
        subtitle={isEdit ? `Editing ${orgQ.data?.org_name ?? "…"}` : "Build your presence"}
        sticky
        action={
          <div className="hidden sm:flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-accent" disabled={busy || !!uploading}>
              {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create →"}
            </button>
          </div>
        }
      />

      {/* Photos */}
      <div className="panel overflow-hidden">
        <div className="px-4 sm:px-6 pt-6">
          <SectionHead n="00" title="Photos" sub="Cover banner and logo" />
        </div>
        <div className="relative h-36 bg-ink mx-4 sm:mx-6 mt-4 rounded overflow-hidden">
          <div className="absolute inset-0"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 11px)" }} />
          {coverUrl && <img src={coverUrl} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />}
          {uploading === "cover" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="font-mononum text-[11px] text-white tracking-[0.06em] uppercase">Uploading…</span>
            </div>
          )}
          <button type="button" onClick={() => coverInputRef.current?.click()} disabled={!!uploading}
            className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Camera className="h-4 w-4" />
          </button>
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "cover"); e.target.value = ""; }} />
        </div>
        <div className="px-4 sm:px-6 pb-6 -mt-8">
          <div className="relative inline-block">
            <div className="h-20 w-20 overflow-hidden rounded border-4 border-panel bg-fill flex items-center justify-center">
              {uploading === "logo" ? (
                <span className="font-mononum text-[9px] text-white text-center leading-tight tracking-[0.04em] uppercase px-1">Uploading…</span>
              ) : logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="font-disp text-2xl text-ink-sub">{form.org_name?.[0] ?? "?"}</span>
              )}
            </div>
            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={!!uploading}
              className="absolute bottom-0 right-0 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/70 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "logo"); e.target.value = ""; }} />
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="panel p-4 sm:p-6 space-y-4">
        <SectionHead n="01" title="Identity" sub="Name, type and description" />
        <Field label="Organization name" req error={fieldErrors.org_name}>
          <input className="input min-h-[44px]" value={form.org_name} name="org_name"
            onChange={(e) => set("org_name", e.target.value)} autoFocus />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Type" req error={fieldErrors.org_type}>
            <select className="input min-h-[44px]" value={form.org_type} name="org_type"
              onChange={(e) => set("org_type", e.target.value)}>
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Year established" error={fieldErrors.year_established}>
            <input className="input min-h-[44px] font-mononum" type="number" min="1800" max={new Date().getFullYear()}
              placeholder="e.g. 2005" value={form.year_established} name="year_established"
              onChange={(e) => set("year_established", e.target.value)} />
          </Field>
        </div>
        <Field label="Description" hint="Brief overview of your organization (shown publicly)" error={fieldErrors.description}>
          <textarea className="input" rows={3} maxLength={2000} value={form.description} name="description"
            onChange={(e) => set("description", e.target.value)} />
        </Field>
      </div>

      {/* Sport categories */}
      <div className="panel p-4 sm:p-6 space-y-4">
        <SectionHead n="02" title="Sport categories" sub="Select up to 5 sports" />
        <div className="flex flex-wrap gap-2">
          {SPORTS_LIST.map((s) => (
            <SportChip
              key={s.value}
              label={s.label}
              active={selectedSports.includes(s.value)}
              onClick={() => {
                if (!selectedSports.includes(s.value) && selectedSports.length >= 5) {
                  setErr("Maximum 5 sport categories allowed.");
                  return;
                }
                setErr(null);
                toggleSport(s.value);
              }}
            />
          ))}
        </div>
        {selectedSports.length > 0 && (
          <div className="lab text-ink-faint text-[10.5px]">
            Selected: {selectedSports.join(", ")} ({selectedSports.length}/5)
          </div>
        )}
        {fieldErrors.sport_categories && (
          <div className="text-red-600 text-xs">{fieldErrors.sport_categories}</div>
        )}
      </div>

      {/* Location */}
      <div className="panel p-4 sm:p-6 space-y-4">
        <SectionHead n="03" title="Location" />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Country" error={fieldErrors.country}>
            <select className="input min-h-[44px]" value={form.country} name="country"
              onChange={(e) => { set("country", e.target.value); set("state", ""); }}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="State / Province" error={fieldErrors.state}>
            {stateOptions ? (
              <select className="input min-h-[44px]" value={form.state} name="state"
                onChange={(e) => set("state", e.target.value)}>
                <option value="">Select state…</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input className="input min-h-[44px]" placeholder="e.g. Maharashtra" value={form.state} name="state"
                onChange={(e) => set("state", e.target.value)} />
            )}
          </Field>
          <Field label="City" error={fieldErrors.city}>
            <input className="input min-h-[44px]" placeholder="e.g. Pune" value={form.city} name="city"
              onChange={(e) => set("city", e.target.value)} />
          </Field>
        </div>
        <Field label="Street address" error={fieldErrors.address}>
          <input className="input min-h-[44px]" placeholder="e.g. 12 Stadium Road" value={form.address} name="address"
            onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Website" error={fieldErrors.website}>
          <input className="input min-h-[44px]" type="url" placeholder="https://www.example.com" value={form.website}
            name="website" onChange={(e) => set("website", e.target.value)} />
        </Field>
      </div>

      {/* Contact */}
      <div className="panel p-4 sm:p-6 space-y-4">
        <SectionHead n="04" title="Contact details" sub="Visible to applicants and scouts" />
        <Field label="Contact person" error={fieldErrors.contact_name}>
          <input className="input min-h-[44px]" placeholder="e.g. Ravi Kumar" value={form.contact_name}
            name="contact_name" onChange={(e) => set("contact_name", e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email" error={fieldErrors.contact_email}>
            <input className="input min-h-[44px]" type="email" inputMode="email" value={form.contact_email}
              name="contact_email" onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label="Phone" error={fieldErrors.contact_phone}>
            <input className="input min-h-[44px]" type="tel" placeholder="+91 98XXX XXXXX" value={form.contact_phone}
              name="contact_phone" onChange={(e) => set("contact_phone", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Documents */}
      <div className="panel p-4 sm:p-6 space-y-4">
        <SectionHead n="05" title="Documents" sub="Registration certificates, licenses (PDF only, private)" />
        <button
          type="button"
          onClick={() => docInputRef.current?.click()}
          disabled={uploading === "doc"}
          className="btn-secondary min-h-[44px] flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploading === "doc" ? `Uploading… ${docProgress}%` : "Upload document"}
        </button>
        {uploading === "doc" && (
          <div className="h-2 rounded-full bg-fill overflow-hidden">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${docProgress}%` }} />
          </div>
        )}
        <input ref={docInputRef} type="file" accept="application/pdf" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(f); e.target.value = ""; }} />
        {isEdit && existingDocsQ.data && existingDocsQ.data.length > 0 && (
          <div>
            <p className="text-xs text-ink-faint mb-2 font-mononum uppercase tracking-[0.06em]">Uploaded documents</p>
            <ul className="space-y-2">
              {existingDocsQ.data.map((d) => (
                <li key={d.key} className="flex items-center gap-2 text-sm text-ink-70">
                  <FileText className="h-4 w-4 flex-shrink-0 text-ink-faint" />
                  <span className="flex-1 truncate">{d.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {uploadedDocs.length > 0 && (
          <ul className="space-y-2">
            {uploadedDocs.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink-70">
                <FileText className="h-4 w-4 flex-shrink-0 text-ink-faint" />
                <span className="flex-1 truncate">{d.name}</span>
                <button type="button" onClick={() => setUploadedDocs((prev) => prev.filter((_, j) => j !== i))}
                  className="text-ink-faint hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

      {/* Sticky bottom bar on mobile */}
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 sm:hidden bg-panel border-t border-hair px-4 py-3 flex gap-2 z-40">
        <button type="button" className="btn-ghost flex-1 min-h-[44px]" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent flex-1 min-h-[44px]" disabled={busy || !!uploading}>
          {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create →"}
        </button>
      </div>

      {/* Desktop footer */}
      <div className="hidden sm:flex justify-end gap-2.5 border-t border-hair pt-5">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent" disabled={busy || !!uploading}>
          {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create organization →"}
        </button>
      </div>
    </form>
  );
}
