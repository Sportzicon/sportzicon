import { useState, useRef, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Badge, StatusPill } from "../components/UI";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
import type { Opportunity } from "../types";

export default function OpportunityDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [applyState, setApplyState] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["opp", id],
    queryFn: async () => (await api.get<{ opportunity: Opportunity }>(`/opportunities/${id}`)).data.opportunity
  });

  const deleteOpp = useMutation({
    mutationFn: async (oppId: string) => api.delete(`/opportunities/${oppId}`),
    onSuccess: () => navigate("/opportunities")
  });

  async function apply() {
    setApplyState("idle");
    try {
      await api.post(`/opportunities/${id}/apply`, { cover_note: note });
      setApplyState("ok");
      qc.invalidateQueries({ queryKey: ["my-apps"] });
    } catch (e) {
      setApplyState("err");
      setErrMsg(getApiError(e).message);
    }
  }

  if (q.isLoading) return <Spinner />;
  const o = q.data;
  if (!o) return <div className="card card-body">Opportunity not found.</div>;

  const isPoster = user?.id === o.posted_by_user_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.title}
        subtitle={`${o.org_name} · ${o.city}, ${o.country}`}
        action={
          <div className="flex gap-2 items-center">
            <StatusPill status={o.status} />
            {isPoster && (
              <>
                <Link to={`/opportunities/${o.id}/applicants`} className="btn-secondary">View applicants</Link>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                    title="More options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                      <Link
                        to={`/opportunities/${o.id}/edit`}
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 rounded-t-lg"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                      <button
                        onClick={() => {
                          setPendingDelete(true);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        }
      />
      {pendingDelete && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-4 items-center">
          <div>
            <p className="font-medium text-red-900">Delete this opportunity?</p>
            <p className="text-sm text-red-700 mt-1">This action cannot be undone.</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => deleteOpp.mutate(o.id)}
              disabled={deleteOpp.isPending}
              className="btn-danger"
            >
              Confirm delete
            </button>
            <button onClick={() => setPendingDelete(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card card-body">
            <h2 className="text-base font-semibold">About this opportunity</h2>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{o.description}</p>
            {o.eligibility && (<><h3 className="mt-4 text-sm font-semibold">Eligibility</h3><p className="text-sm text-slate-700">{o.eligibility}</p></>)}
          </div>
          {user?.role === "athlete" && o.status === "open" && (
            <div className="card card-body">
              <h3 className="text-base font-semibold">Apply</h3>
              <textarea
                className="input mt-2"
                rows={4}
                placeholder="Cover note — why are you a good fit?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn-primary mt-3" onClick={apply}>Submit application</button>
              {applyState === "ok" && <div className="mt-2 text-sm text-emerald-700">Application submitted.</div>}
              {applyState === "err" && <div className="mt-2 text-sm text-red-700">{errMsg}</div>}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card card-body text-sm space-y-2">
            <h3 className="text-base font-semibold mb-2">Details</h3>
            <Row k="Type" v={o.type} />
            <Row k="Sport" v={o.sport} />
            <Row k="Age" v={`${o.age_min}-${o.age_max}`} />
            <Row k="Gender" v={o.gender_eligibility} />
            <Row k="Experience" v={o.experience_level_required} />
            <Row k="Starts" v={o.start_date} />
            <Row k="Ends" v={o.end_date} />
            <Row k="Apply by" v={o.application_deadline} />
            {o.vacancies != null && <Row k="Vacancies" v={`${o.vacancies_filled}/${o.vacancies}`} />}
            <Row k="Applicants" v={String(o.application_count)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-900 text-right">{v}</span>
    </div>
  );
}
