import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, humanizeError } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { PageHeader, Spinner, Badge, Pagination } from "../../../components/UI";
import { Pencil, Trash2, X, Check, Plus } from "lucide-react";

const PAGE_SIZE = 15;

const OPP_TYPES = ["trial", "recruitment", "scholarship", "tournament", "coaching_job"] as const;
const OPP_STATUSES = ["open", "closed", "filled"] as const;
const GENDERS = ["all", "male", "female", "other"] as const;
const EXPERIENCE = ["any", "beginner", "amateur", "semi_pro", "professional"] as const;

function statusColor(s: string) {
  if (s === "open") return "green";
  if (s === "closed") return "red";
  return "yellow";
}

type EditForm = {
  title: string; type: string; sport: string; description: string; eligibility: string;
  age_min: string; age_max: string; gender_eligibility: string; experience_level_required: string;
  country: string; state: string; city: string;
  start_date: string; end_date: string; application_deadline: string;
  entry_fee: string; vacancies: string; contact_email: string; contact_phone: string; status: string;
};

function emptyForm(opp?: Record<string, any>): EditForm {
  return {
    title: opp?.title ?? "",
    type: opp?.type ?? "tournament",
    sport: opp?.sport ?? "",
    description: opp?.description ?? "",
    eligibility: opp?.eligibility ?? "",
    age_min: String(opp?.age_min ?? ""),
    age_max: String(opp?.age_max ?? ""),
    gender_eligibility: opp?.gender_eligibility ?? "all",
    experience_level_required: opp?.experience_level_required ?? "any",
    country: opp?.country ?? "",
    state: opp?.state ?? "",
    city: opp?.city ?? "",
    start_date: opp?.start_date?.slice(0, 10) ?? "",
    end_date: opp?.end_date?.slice(0, 10) ?? "",
    application_deadline: opp?.application_deadline?.slice(0, 10) ?? "",
    entry_fee: String(opp?.entry_fee ?? ""),
    vacancies: String(opp?.vacancies ?? ""),
    contact_email: opp?.contact_email ?? "",
    contact_phone: opp?.contact_phone ?? "",
    status: opp?.status ?? "open"
  };
}

function buildPatch(form: EditForm): Record<string, any> {
  const patch: Record<string, any> = {};
  if (form.title) patch.title = form.title;
  if (form.type) patch.type = form.type;
  if (form.sport) patch.sport = form.sport;
  if (form.description) patch.description = form.description;
  if (form.eligibility) patch.eligibility = form.eligibility;
  if (form.age_min) patch.age_min = Number(form.age_min);
  if (form.age_max) patch.age_max = Number(form.age_max);
  if (form.gender_eligibility) patch.gender_eligibility = form.gender_eligibility;
  if (form.experience_level_required) patch.experience_level_required = form.experience_level_required;
  if (form.country) patch.country = form.country;
  if (form.state) patch.state = form.state;
  if (form.city) patch.city = form.city;
  if (form.start_date) patch.start_date = form.start_date;
  if (form.end_date) patch.end_date = form.end_date;
  if (form.application_deadline) patch.application_deadline = form.application_deadline;
  if (form.entry_fee) patch.entry_fee = Number(form.entry_fee);
  if (form.vacancies) patch.vacancies = Number(form.vacancies);
  if (form.contact_email) patch.contact_email = form.contact_email;
  if (form.contact_phone) patch.contact_phone = form.contact_phone;
  if (form.status) patch.status = form.status;
  return patch;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export default function AdminOpportunities() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const params: Record<string, string | number | undefined> = {};
  if (typeFilter) params.type = typeFilter;
  if (statusFilter) params.status = statusFilter;
  params.limit = 200;

  const q = useQuery({
    queryKey: queryKeys.adminOpportunities(params),
    queryFn: async () => (await api.get("/admin/opportunities", { params })).data.items as any[]
  });

  const updateOpp = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) =>
      api.patch(`/admin/opportunities/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminOpportunities() });
      setEditId(null); setFormError("");
    },
    onError: (e: unknown) => setFormError(humanizeError(e))
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/opportunities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminOpportunities() });
      setDeletePendingId(null);
    },
    onError: (e: unknown) => setFormError(humanizeError(e))
  });

  const allItems = q.data ?? [];
  const paged = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function startEdit(opp: Record<string, any>) {
    setEditId(opp.id);
    setEditForm(emptyForm(opp));
    setFormError("");
  }

  function setF(key: keyof EditForm, val: string) {
    setEditForm((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Opportunities" subtitle="Manage all tournaments, trials and recruitments" />

      <div className="card card-body flex flex-wrap gap-3 items-center">
        <select className="input max-w-xs" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {OPP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {OPP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          className="btn-primary ml-auto flex items-center gap-2"
          onClick={() => navigate("/admin/opportunities/create")}
        >
          <Plus className="h-4 w-4" /> Create opportunity
        </button>
      </div>

      {q.isLoading ? <Spinner /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Title</th>
                  <th>Org</th>
                  <th>Type</th>
                  <th>Sport</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Apps</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((opp) => (
                  <Fragment key={opp.id}>
                    <tr className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium max-w-[200px] truncate">{opp.title}</td>
                      <td className="text-slate-500 text-xs max-w-[120px] truncate">{opp.org_name ?? "—"}</td>
                      <td><Badge color="blue">{opp.type}</Badge></td>
                      <td>{opp.sport}</td>
                      <td><Badge color={statusColor(opp.status) as any}>{opp.status}</Badge></td>
                      <td className="text-xs text-slate-500">{opp.application_deadline?.slice(0, 10)}</td>
                      <td className="text-center">{opp.application_count}</td>
                      <td className="p-3">
                        {deletePendingId === opp.id ? (
                          <div className="flex gap-2 items-center">
                            <span className="text-xs text-red-700">Delete?</span>
                            <button className="btn-danger btn-sm" onClick={() => deleteOpp.mutate(opp.id)} disabled={deleteOpp.isPending}><Check className="h-3 w-3" /></button>
                            <button className="btn-secondary btn-sm" onClick={() => setDeletePendingId(null)}><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button className="btn-secondary btn-sm" onClick={() => startEdit(opp)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button className="btn-danger btn-sm" onClick={() => setDeletePendingId(opp.id)} title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {editId === opp.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="p-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-slate-700">Edit: {opp.title}</h4>
                            {formError && <div className="text-sm text-red-700 bg-red-50 p-2 rounded">{formError}</div>}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <Field label="Title">
                                <input className="input" value={editForm.title} onChange={(e) => setF("title", e.target.value)} />
                              </Field>
                              <Field label="Type">
                                <select className="input" value={editForm.type} onChange={(e) => setF("type", e.target.value)}>
                                  {OPP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </Field>
                              <Field label="Sport">
                                <input className="input" value={editForm.sport} onChange={(e) => setF("sport", e.target.value)} />
                              </Field>
                              <Field label="Status">
                                <select className="input" value={editForm.status} onChange={(e) => setF("status", e.target.value)}>
                                  {OPP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </Field>
                              <Field label="Country">
                                <input className="input" value={editForm.country} onChange={(e) => setF("country", e.target.value)} />
                              </Field>
                              <Field label="City">
                                <input className="input" value={editForm.city} onChange={(e) => setF("city", e.target.value)} />
                              </Field>
                              <Field label="Age min">
                                <input className="input min-h-[44px]" type="number" inputMode="numeric" value={editForm.age_min} onChange={(e) => setF("age_min", e.target.value)} />
                              </Field>
                              <Field label="Age max">
                                <input className="input min-h-[44px]" type="number" inputMode="numeric" value={editForm.age_max} onChange={(e) => setF("age_max", e.target.value)} />
                              </Field>
                              <Field label="Vacancies">
                                <input className="input min-h-[44px]" type="number" inputMode="numeric" value={editForm.vacancies} onChange={(e) => setF("vacancies", e.target.value)} />
                              </Field>
                              <Field label="Entry fee">
                                <input className="input min-h-[44px]" type="number" inputMode="numeric" value={editForm.entry_fee} onChange={(e) => setF("entry_fee", e.target.value)} />
                              </Field>
                              <Field label="App deadline">
                                <input className="input" type="date" value={editForm.application_deadline} onChange={(e) => setF("application_deadline", e.target.value)} />
                              </Field>
                              <Field label="Start date">
                                <input className="input" type="date" value={editForm.start_date} onChange={(e) => setF("start_date", e.target.value)} />
                              </Field>
                              <Field label="End date">
                                <input className="input" type="date" value={editForm.end_date} onChange={(e) => setF("end_date", e.target.value)} />
                              </Field>
                              <Field label="Gender eligibility">
                                <select className="input" value={editForm.gender_eligibility} onChange={(e) => setF("gender_eligibility", e.target.value)}>
                                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>
                              </Field>
                              <Field label="Experience required">
                                <select className="input" value={editForm.experience_level_required} onChange={(e) => setF("experience_level_required", e.target.value)}>
                                  {EXPERIENCE.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>
                              </Field>
                              <Field label="Contact email">
                                <input className="input" value={editForm.contact_email} onChange={(e) => setF("contact_email", e.target.value)} />
                              </Field>
                              <Field label="Contact phone">
                                <input className="input" value={editForm.contact_phone} onChange={(e) => setF("contact_phone", e.target.value)} />
                              </Field>
                            </div>
                            <Field label="Description">
                              <textarea className="input" rows={3} value={editForm.description} onChange={(e) => setF("description", e.target.value)} />
                            </Field>
                            <Field label="Eligibility notes">
                              <textarea className="input" rows={2} value={editForm.eligibility} onChange={(e) => setF("eligibility", e.target.value)} />
                            </Field>
                            <div className="flex gap-2 pt-1">
                              <button
                                className="btn-primary"
                                disabled={updateOpp.isPending}
                                onClick={() => updateOpp.mutate({ id: opp.id, patch: buildPatch(editForm) })}
                              >
                                {updateOpp.isPending ? "Saving…" : "Save changes"}
                              </button>
                              <button className="btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!paged.length && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500 text-sm">No opportunities found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={allItems.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  );
}
