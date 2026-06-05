import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, EmptyState, StatusPill, Kicker, SectionHead, Pagination } from "../components/UI";

const PAGE_SIZE = 10;
import { Trash2, Pencil, MoreVertical, Bookmark } from "lucide-react";
import type { Opportunity } from "../types";
import { useSavedOpportunities } from "../store/savedOpportunities";

const TYPE_LABELS: Record<string, string> = {
  trial: "Trial", recruitment: "Recruitment", scholarship: "Scholarship",
  tournament: "Tournament", coaching_job: "Coaching Job"
};
const TYPES = ["", "trial", "recruitment", "scholarship", "tournament", "coaching_job"];
const SPORTS = ["All sports", "Cricket", "Football", "Athletics", "Basketball", "Hockey", "Tennis", "Badminton", "Kabaddi", "Multi-sport"];

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-4 mb-4 border-b border-hairsoft last:border-0 last:pb-0 last:mb-0">
      <div className="lab mb-2.5">{label}</div>
      {children}
    </div>
  );
}

function RadioItem({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 py-[5px] cursor-pointer" onClick={onClick}>
      <span className="w-3.5 h-3.5 rounded-full border flex-shrink-0 inline-flex items-center justify-center text-white text-[8px]"
        style={{ borderColor: on ? "#FA4D14" : "rgba(20,17,13,0.2)", background: on ? "#FA4D14" : "transparent" }}>
        {on ? "✓" : ""}
      </span>
      <span className="text-[13px]" style={{ color: on ? "#14110D" : "#726B60" }}>{label}</span>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between cursor-pointer py-1" onClick={() => onChange(!on)}>
      <span className="text-[13px] text-ink">{label}</span>
      <span className="relative inline-block w-[34px] h-[19px] rounded-full flex-shrink-0 transition-colors"
        style={{ background: on ? "#FA4D14" : "rgba(20,17,13,0.15)" }}>
        <span className="absolute top-[2px] w-[15px] h-[15px] rounded-full bg-white transition-all"
          style={{ left: on ? 17 : 2 }} />
      </span>
    </div>
  );
}

function deadlineDays(deadline: string) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400_000);
  if (d < 0) return { text: "Closed", urgent: false, closed: true };
  if (d === 0) return { text: "Closes today", urgent: true, closed: false };
  if (d <= 5) return { text: `${d}d left`, urgent: true, closed: false };
  return { text: `${d}d left`, urgent: false, closed: false };
}

export default function Opportunities() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [type, setType] = useState("");
  const [sport, setSport] = useState("All sports");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("deadline");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [type, sport, verifiedOnly, q, sort]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const params: any = { status: "open" };
  if (type) params.type = type;
  if (sport !== "All sports") params.sport = sport;
  if (verifiedOnly) params.verified_org = true;
  if (q) params.q = q;

  const q2 = useQuery({
    queryKey: ["opportunities", params],
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", { params })).data.items
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => api.delete(`/opportunities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); setPendingDeleteId(null); }
  });

  const { toggle: toggleSave, isSaved } = useSavedOpportunities();
  const canPost = user?.role === "club" || user?.role === "organizer" || user?.role === "admin";

  const results = (q2.data ?? [])
    .filter((o) => !q || o.title.toLowerCase().includes(q.toLowerCase()) || (o.org_name ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sort === "deadline") return new Date(a.application_deadline).getTime() - new Date(b.application_deadline).getTime();
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return (b.application_count ?? 0) - (a.application_count ?? 0);
    });

  const isFiltered = type || sport !== "All sports" || verifiedOnly || q;

  function resetFilters() {
    setType(""); setSport("All sports"); setVerifiedOnly(false); setQ(""); setPage(1);
  }

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[232px_1fr] items-start">
        {/* ── filter rail ─────────────────────────────────────── */}
        <div className="panel p-[18px] lg:sticky lg:top-4">
          <SectionHead title="Filters" />

          <FilterGroup label="Search">
            <input className="input font-mononum" style={{ fontSize: 12, height: 34 }}
              placeholder="Title or club…" value={q} onChange={(e) => setQ(e.target.value)} />
          </FilterGroup>

          <FilterGroup label="Type">
            {TYPES.map((t) => (
              <RadioItem key={t || "all"} label={t ? TYPE_LABELS[t] : "All types"} on={type === t} onClick={() => setType(t)} />
            ))}
          </FilterGroup>

          <FilterGroup label="Sport">
            <select className="input font-mononum" style={{ fontSize: 12, height: 34 }}
              value={sport} onChange={(e) => setSport(e.target.value)}>
              {SPORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </FilterGroup>

          <Toggle on={verifiedOnly} onChange={setVerifiedOnly} label="Verified clubs only" />
        </div>

        {/* ── results ──────────────────────────────────────────── */}
        <div>
          <PageHeader
            title="Opportunities"
            subtitle="Opportunity index"
            action={canPost && <Link to="/opportunities/new" className="btn-accent">+ Post opportunity</Link>}
          />
          <div className="flex justify-end mb-4">
            <select className="input font-mononum" style={{ width: "auto", fontSize: 11, height: 32, padding: "0 28px 0 10px" }}
              value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="deadline">Sort: Deadline soonest</option>
              <option value="newest">Sort: Newest</option>
              <option value="popular">Sort: Most applicants</option>
            </select>
          </div>

          {q2.isLoading ? (
            <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
          ) : !results.length ? (
            <EmptyState
              title="No opportunities match"
              hint="Try widening your filters — clear the type or sport, or remove 'verified only'."
              action={<button onClick={resetFilters} className="btn-ghost">Clear filters</button>}
            />
          ) : (
            <>
            <div className="flex flex-col gap-3">
              {results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o) => {
                const isPoster = user?.id === o.posted_by_user_id;
                const deadline = deadlineDays(o.application_deadline);

                return (
                  <div key={o.id} className="panel overflow-hidden">
                    <Link to={`/opportunities/${o.id}`} className="block p-[18px] hover:bg-fill transition flex gap-4">
                      <div className="w-12 h-12 rounded bg-fill border border-hairsoft flex-shrink-0 flex items-center justify-center">
                        <span className="font-disp text-xl text-ink-sub">{(o.org_name ?? "?")[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="badge">{TYPE_LABELS[o.type] ?? o.type}</span>
                          <span className="badge">{o.sport}</span>
                          <StatusPill status={o.status} />
                        </div>
                        <h3 className="font-disp text-xl leading-tight">{o.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[13px] font-medium text-ink-70">{o.org_name}</span>
                          <span className="lab">· {o.city}, {o.country}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
                          <div><div className="lab">Eligibility</div><div className="font-mononum text-[12px] text-ink-70 mt-0.5">Age {o.age_min}–{o.age_max} · {o.gender_eligibility}</div></div>
                          {o.vacancies && <div><div className="lab">Vacancies</div><div className="font-mononum text-[12px] text-ink-70 mt-0.5">{o.vacancies - (o.vacancies_filled ?? 0)} of {o.vacancies} open</div></div>}
                          <div><div className="lab">Applicants</div><div className="font-mononum text-[12px] text-ink-70 mt-0.5">{o.application_count}</div></div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-between flex-shrink-0">
                        <div className="font-mononum text-[11px]" style={{ color: deadline.urgent ? "#FA4D14" : "#9A9286" }}>
                          {deadline.text}
                        </div>
                      </div>
                    </Link>

                    <div className="px-[18px] py-2.5 border-t border-hairsoft flex items-center justify-between relative">
                      <button
                        onClick={() => toggleSave(o)}
                        className={`font-mononum text-[10.5px] flex items-center gap-1.5 transition ${isSaved(o.id) ? "text-brand-500" : "text-ink-faint hover:text-ink"}`}
                        title={isSaved(o.id) ? "Remove from saved" : "Save opportunity"}
                      >
                        <Bookmark className="h-3.5 w-3.5" fill={isSaved(o.id) ? "currentColor" : "none"} />
                        {isSaved(o.id) ? "Saved" : "Save"}
                      </button>

                      {isPoster && (
                        <div className="flex items-center gap-1">
                          <button data-menu-button onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)} className="btn-ghost p-1.5">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuOpenId === o.id && (
                            <div data-menu-content className="absolute right-4 bottom-10 panel shadow-pop z-10 min-w-36">
                              <Link to={`/opportunities/${o.id}/edit`} onClick={() => setMenuOpenId(null)}
                                className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Link>
                              <button onClick={() => { setPendingDeleteId(o.id); setMenuOpenId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                          {pendingDeleteId === o.id && (
                            <div className="absolute right-4 bottom-12 panel shadow-pop z-10 p-3 flex items-center gap-2 min-w-52">
                              <span className="text-[12.5px] text-ink flex-1">Delete this opportunity?</span>
                              <button onClick={() => deleteOpp.mutate(o.id)} disabled={deleteOpp.isPending} className="btn-danger">Confirm</button>
                              <button onClick={() => setPendingDeleteId(null)} className="btn-secondary">Cancel</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={page} total={results.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
