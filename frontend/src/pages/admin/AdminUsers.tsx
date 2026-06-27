import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, humanizeError } from "../../api/client";
import { PageHeader, Spinner, Badge } from "../../components/UI";
import { queryKeys } from "../../hooks/queryKeys";
import { ALL_ROLES } from "../../utils/roles";
import { Trash2, Pencil, Plus, Search, Ban, UserCheck, ShieldCheck } from "lucide-react";

type UserItem = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  is_suspended: boolean;
  suspension_reason?: string;
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [suspendTargetId, setSuspendTargetId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendErr, setSuspendErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  // Inline role edit state
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState("");

  const filters: Record<string, unknown> = {};
  if (statusFilter) filters.status = statusFilter;
  if (roleFilter) filters.role = roleFilter;
  if (search) filters.q = search;

  const q = useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: async () =>
      (await api.get("/admin/users", { params: { ...filters, limit: 100 } })).data.items as UserItem[]
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: string }) =>
      api.patch(`/admin/users/${vars.id}/status`, { status: vars.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.adminUsers() }); setActionErr(null); },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const suspendUser = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) =>
      api.patch(`/admin/users/${vars.id}/suspend`, { reason: vars.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      setSuspendTargetId(null);
      setSuspendReason("");
      setSuspendErr(null);
      setActionErr(null);
    },
    onError: (e) => setSuspendErr(humanizeError(e))
  });

  const unsuspendUser = useMutation({
    mutationFn: async (id: string) => api.patch(`/admin/users/${id}/unsuspend`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.adminUsers() }); setActionErr(null); },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const changeRole = useMutation({
    mutationFn: async (vars: { id: string; role: string }) =>
      api.patch(`/admin/users/${vars.id}/role`, { role: vars.role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      setRoleEditId(null);
      setActionErr(null);
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
      setPendingDeleteId(null);
      setActionErr(null);
    },
    onError: (e) => setActionErr(humanizeError(e))
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function openRoleEdit(u: UserItem) {
    setRoleEditId(u.id);
    setRoleEditValue(u.role);
  }

  const users = q.data ?? [];
  const isActing = setStatus.isPending || suspendUser.isPending || unsuspendUser.isPending || deleteUser.isPending || changeRole.isPending;

  return (
    <div className="space-y-4">
      <PageHeader title="Users" subtitle="Manage accounts, roles and moderation" />

      {actionErr && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{actionErr}</div>
      )}

      {/* Filters */}
      <div className="card card-body space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              className="input w-full pl-9"
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary min-h-[44px] px-4">Search</button>
          {search && (
            <button type="button" className="btn-secondary min-h-[44px] px-3" onClick={() => { setSearch(""); setSearchInput(""); }}>
              Clear
            </button>
          )}
        </form>
        <div className="flex flex-wrap gap-3">
          <select className="input flex-1 min-w-[120px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option>active</option>
            <option>suspended</option>
            <option>pending</option>
          </select>
          <select className="input flex-1 min-w-[120px]" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn-primary min-h-[44px] flex items-center gap-2 whitespace-nowrap" onClick={() => navigate("/admin/users/create")}>
            <Plus className="h-4 w-4" /> Create user
          </button>
        </div>
      </div>

      {/* Suspend reason dialog */}
      {suspendTargetId && (
        <div className="card card-body space-y-3 border-red-200 bg-red-50">
          <div className="font-semibold text-red-900 text-sm">Suspend user — provide reason</div>
          <textarea
            className="input w-full"
            rows={3}
            placeholder="Reason for suspension (required)…"
            value={suspendReason}
            onChange={(e) => { setSuspendReason(e.target.value); setSuspendErr(null); }}
          />
          {suspendErr && <div className="text-red-600 text-xs">{suspendErr}</div>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!suspendReason.trim()) { setSuspendErr("Reason is required."); return; }
                suspendUser.mutate({ id: suspendTargetId, reason: suspendReason.trim() });
              }}
              disabled={isActing}
              className="btn-danger min-h-[44px] flex-1"
            >
              Confirm Suspend
            </button>
            <button onClick={() => { setSuspendTargetId(null); setSuspendReason(""); setSuspendErr(null); }} className="btn-secondary min-h-[44px] flex-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="card card-body text-center py-10 text-sm text-slate-500">No users found.</div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className="card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-ink truncate">{u.full_name}</div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge color="blue">{u.role}</Badge>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.is_suspended ? "bg-red-100 text-red-700" :
                        u.status === "active" ? "bg-green-100 text-green-700" :
                        u.status === "suspended" ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {u.is_suspended ? "suspended" : u.status}
                      </span>
                    </div>
                    {u.is_suspended && u.suspension_reason && (
                      <div className="text-xs text-red-600 mt-1">Reason: {u.suspension_reason}</div>
                    )}
                  </div>
                </div>

                {/* Inline role change (mobile) */}
                {roleEditId === u.id ? (
                  <div className="flex gap-2 items-center">
                    <select
                      className="input flex-1 min-h-[44px]"
                      value={roleEditValue}
                      onChange={(e) => setRoleEditValue(e.target.value)}
                    >
                      {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      onClick={() => changeRole.mutate({ id: u.id, role: roleEditValue })}
                      disabled={isActing || roleEditValue === u.role}
                      className="btn-primary btn-sm min-h-[44px] whitespace-nowrap"
                    >
                      Save
                    </button>
                    <button onClick={() => setRoleEditId(null)} className="btn-secondary btn-sm min-h-[44px]">✕</button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => navigate(`/admin/users/${u.id}`)} className="btn-secondary btn-sm flex items-center gap-1 min-h-[44px]">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => openRoleEdit(u)}
                    disabled={isActing}
                    className="btn-secondary btn-sm flex items-center gap-1 min-h-[44px]"
                    title="Change role"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Role
                  </button>
                  {u.is_suspended ? (
                    <button onClick={() => unsuspendUser.mutate(u.id)} disabled={isActing} className="btn-primary btn-sm flex items-center gap-1 min-h-[44px]">
                      <UserCheck className="h-3.5 w-3.5" /> Unsuspend
                    </button>
                  ) : (
                    <button onClick={() => { setSuspendTargetId(u.id); setSuspendReason(""); setSuspendErr(null); }} disabled={isActing} className="btn-danger btn-sm flex items-center gap-1 min-h-[44px]">
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </button>
                  )}
                  {u.status === "suspended" && !u.is_suspended && (
                    <button onClick={() => setStatus.mutate({ id: u.id, status: "active" })} disabled={isActing} className="btn-primary btn-sm min-h-[44px]">Activate</button>
                  )}
                  {pendingDeleteId === u.id ? (
                    <>
                      <button onClick={() => deleteUser.mutate(u.id)} disabled={isActing} className="btn-danger btn-sm min-h-[44px]">Confirm delete</button>
                      <button onClick={() => setPendingDeleteId(null)} className="btn-secondary btn-sm min-h-[44px]">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setPendingDeleteId(u.id)} className="btn-danger btn-sm flex items-center gap-1 min-h-[44px]">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{u.full_name}</td>
                    <td className="p-3 text-slate-500 text-xs">{u.email}</td>
                    <td className="p-3">
                      {roleEditId === u.id ? (
                        <div className="flex gap-1.5 items-center">
                          <select
                            className="input text-xs py-1 min-h-[36px]"
                            value={roleEditValue}
                            onChange={(e) => setRoleEditValue(e.target.value)}
                          >
                            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button
                            onClick={() => changeRole.mutate({ id: u.id, role: roleEditValue })}
                            disabled={isActing || roleEditValue === u.role}
                            className="btn-primary btn-sm min-h-[36px] whitespace-nowrap text-xs"
                          >
                            Save
                          </button>
                          <button onClick={() => setRoleEditId(null)} className="btn-secondary btn-sm min-h-[36px] text-xs">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openRoleEdit(u)}
                          className="flex items-center gap-1.5 group"
                          title="Click to change role"
                        >
                          <Badge color="blue">{u.role}</Badge>
                          <Pencil className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.is_suspended ? "bg-red-100 text-red-700" :
                        u.status === "active" ? "bg-green-100 text-green-700" :
                        u.status === "suspended" ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {u.is_suspended ? "suspended" : u.status}
                      </span>
                      {u.is_suspended && u.suspension_reason && (
                        <div className="text-xs text-slate-400 mt-0.5 max-w-[160px] truncate" title={u.suspension_reason}>{u.suspension_reason}</div>
                      )}
                    </td>
                    <td className="p-3">
                      {pendingDeleteId === u.id ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-red-700">Delete user?</span>
                          <button onClick={() => deleteUser.mutate(u.id)} disabled={isActing} className="btn-danger btn-sm">Confirm</button>
                          <button onClick={() => setPendingDeleteId(null)} className="btn-secondary btn-sm">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => navigate(`/admin/users/${u.id}`)} className="btn-secondary btn-sm min-h-[44px]" title="Edit profile">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {u.is_suspended ? (
                            <button onClick={() => unsuspendUser.mutate(u.id)} disabled={isActing} className="btn-primary btn-sm min-h-[44px] flex items-center gap-1">
                              <UserCheck className="h-3.5 w-3.5" /> Unsuspend
                            </button>
                          ) : (
                            <button onClick={() => { setSuspendTargetId(u.id); setSuspendReason(""); setSuspendErr(null); }} disabled={isActing} className="btn-danger btn-sm min-h-[44px] flex items-center gap-1">
                              <Ban className="h-3.5 w-3.5" /> Suspend
                            </button>
                          )}
                          {u.status === "suspended" && !u.is_suspended && (
                            <button onClick={() => setStatus.mutate({ id: u.id, status: "active" })} disabled={isActing} className="btn-primary btn-sm min-h-[44px]">Activate</button>
                          )}
                          <button onClick={() => setPendingDeleteId(u.id)} className="btn-danger btn-sm min-h-[44px]" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
