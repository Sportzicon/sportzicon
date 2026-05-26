import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PageHeader, Spinner, StatusPill, Badge } from "../../components/UI";

export default function AdminUsers() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const params: any = {};
  if (statusFilter) params.status = statusFilter;
  if (roleFilter) params.role = roleFilter;

  const q = useQuery({
    queryKey: ["admin-users", params],
    queryFn: async () => (await api.get("/admin/users", { params })).data.items as any[]
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: string }) =>
      api.patch(`/admin/users/${vars.id}/status`, { status: vars.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] })
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Users" subtitle="Manage account status and verification" />
      <div className="card card-body flex flex-wrap gap-3">
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option>active</option><option>suspended</option><option>pending</option>
        </select>
        <select className="input max-w-xs" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option>athlete</option><option>club</option><option>scout</option><option>organizer</option><option>admin</option>
        </select>
      </div>
      {q.isLoading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-slate-50 text-slate-600"><tr>
              <th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {q.data?.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><Badge color="blue">{u.role}</Badge></td>
                  <td><StatusPill status={u.status} /></td>
                  <td className="space-x-2 p-3">
                    {u.status !== "suspended" && <button className="btn-danger" onClick={() => setStatus.mutate({ id: u.id, status: "suspended" })}>Suspend</button>}
                    {u.status !== "active" && <button className="btn-primary" onClick={() => setStatus.mutate({ id: u.id, status: "active" })}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
