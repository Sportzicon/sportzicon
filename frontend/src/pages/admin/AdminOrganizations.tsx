import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, humanizeError } from "../../api/client";
import { PageHeader, Spinner, Badge, Pagination } from "../../components/UI";
import { Pencil, Plus } from "lucide-react";

const PAGE_SIZE = 15;

type EditForm = {
  org_name: string; org_type: string; description: string;
  country: string; state: string; city: string; address: string;
  website: string; contact_name: string; contact_email: string; contact_phone: string;
  subscription_plan: string;
};

function emptyForm(org?: Record<string, any>): EditForm {
  return {
    org_name: org?.org_name ?? "",
    org_type: org?.org_type ?? "",
    description: org?.description ?? "",
    country: org?.country ?? "",
    state: org?.state ?? "",
    city: org?.city ?? "",
    address: org?.address ?? "",
    website: org?.website ?? "",
    contact_name: org?.contact_name ?? "",
    contact_email: org?.contact_email ?? "",
    contact_phone: org?.contact_phone ?? "",
    subscription_plan: org?.subscription_plan ?? "free"
  };
}

function buildPatch(form: EditForm): Record<string, any> {
  const patch: Record<string, any> = {};
  const keys: (keyof EditForm)[] = [
    "org_name", "org_type", "description", "country", "state", "city",
    "address", "website", "contact_name", "contact_email", "contact_phone", "subscription_plan"
  ];
  for (const k of keys) {
    if (form[k] !== "") patch[k] = form[k];
  }
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

export default function AdminOrganizations() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const params: any = { limit: 200 };
  if (search) params.q = search;

  const q = useQuery({
    queryKey: ["admin-organizations", params],
    queryFn: async () => (await api.get("/admin/organizations", { params })).data.items as any[]
  });

  const updateOrg = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) =>
      api.patch(`/admin/organizations/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      setEditId(null); setFormError(""); setFormSuccess("Saved.");
    },
    onError: (e: any) => { setFormError(humanizeError(e)); setFormSuccess(""); }
  });

  const allItems = q.data ?? [];
  const paged = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function startEdit(org: Record<string, any>) {
    setEditId(org.id);
    setEditForm(emptyForm(org));
    setFormError(""); setFormSuccess("");
  }

  function setF(key: keyof EditForm, val: string) {
    setEditForm((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Organizations" subtitle="View and edit all organizations" />

      <div className="card card-body flex flex-wrap gap-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <button
          className="btn-primary ml-auto flex items-center gap-2"
          onClick={() => navigate("/admin/organizations/create")}
        >
          <Plus className="h-4 w-4" /> Create organization
        </button>
      </div>

      {formSuccess && <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700">{formSuccess}</div>}

      {q.isLoading ? <Spinner /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Name</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Plan</th>
                  <th>Verification</th>
                  <th>Opps</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((org) => (
                  <Fragment key={org.id}>
                    <tr className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium">{org.org_name}</td>
                      <td className="text-slate-500">{org.org_type}</td>
                      <td className="text-slate-500 text-xs">{[org.city, org.country].filter(Boolean).join(", ")}</td>
                      <td><Badge color="blue">{org.subscription_plan ?? "free"}</Badge></td>
                      <td><Badge color={org.verification_status === "approved" ? "emerald" : "amber"}>{org.verification_status}</Badge></td>
                      <td className="text-center">{org.opportunity_count}</td>
                      <td className="p-3">
                        <button className="btn-secondary btn-sm" onClick={() => startEdit(org)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {editId === org.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="p-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-slate-700">Edit: {org.org_name}</h4>
                            {formError && <div className="text-sm text-red-700 bg-red-50 p-2 rounded">{formError}</div>}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <Field label="Organization name">
                                <input className="input" value={editForm.org_name} onChange={(e) => setF("org_name", e.target.value)} />
                              </Field>
                              <Field label="Org type">
                                <input className="input" value={editForm.org_type} onChange={(e) => setF("org_type", e.target.value)} placeholder="club, academy, federation…" />
                              </Field>
                              <Field label="Subscription plan">
                                <select className="input" value={editForm.subscription_plan} onChange={(e) => setF("subscription_plan", e.target.value)}>
                                  <option value="free">free</option>
                                  <option value="basic">basic</option>
                                  <option value="pro">pro</option>
                                  <option value="enterprise">enterprise</option>
                                </select>
                              </Field>
                              <Field label="Country">
                                <input className="input" value={editForm.country} onChange={(e) => setF("country", e.target.value)} />
                              </Field>
                              <Field label="State">
                                <input className="input" value={editForm.state} onChange={(e) => setF("state", e.target.value)} />
                              </Field>
                              <Field label="City">
                                <input className="input" value={editForm.city} onChange={(e) => setF("city", e.target.value)} />
                              </Field>
                              <Field label="Address">
                                <input className="input" value={editForm.address} onChange={(e) => setF("address", e.target.value)} />
                              </Field>
                              <Field label="Website">
                                <input className="input" value={editForm.website} onChange={(e) => setF("website", e.target.value)} />
                              </Field>
                              <Field label="Contact name">
                                <input className="input" value={editForm.contact_name} onChange={(e) => setF("contact_name", e.target.value)} />
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
                            <div className="flex gap-2 pt-1">
                              <button
                                className="btn-primary"
                                disabled={updateOrg.isPending}
                                onClick={() => updateOrg.mutate({ id: org.id, patch: buildPatch(editForm) })}
                              >
                                {updateOrg.isPending ? "Saving…" : "Save changes"}
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
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500 text-sm">No organizations found.</td></tr>
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
