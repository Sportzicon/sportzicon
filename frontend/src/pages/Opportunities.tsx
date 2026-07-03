import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useInfiniteOpportunities } from "../hooks";
import { hasRole, isAdmin } from "../utils/roles";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, EmptyState, StatusPill, SectionHead } from "../components/UI";
import { MobileDrawer } from "../components/MobileDrawer";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { SPORTS_LIST } from "../data/sportPositions";
import { SlidersHorizontal, Trash2, Pencil, MoreVertical, Bookmark } from "lucide-react";
import type { Opportunity, OpportunityFilters } from "../models";
import { useSavedOpportunities } from "../store/savedOpportunities";

const TYPE_LABELS: Record<string, string> = {
  trial: "Trial", recruitment: "Recruitment", scholarship: "Scholarship",
  tournament: "Tournament", coaching_job: "Coaching Job"
};
const TYPES = ["", "trial", "recruitment", "scholarship", "tournament", "coaching_job"];

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
    <div className="flex items-center gap-2 py-[5px] cursor-pointer min-h-[44px]" onClick={onClick}>
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
    <div className="flex items-center justify-between cursor-pointer py-2 min-h-[44px]" onClick={() => onChange(!on)}>
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
  if (d < 0) return { text: "Deadline passed", urgent: false, closed: true };
  if (d === 0) return { text: "Closes today", urgent: true, closed: false };
  if (d <= 5) return { text: `${d}d left`, urgent: true, closed: false };
  return { text: `${d}d left`, urgent: false, closed: false };
}

function FilterContent({
  type, setType, sport, setSport, verifiedOnly, setVerifiedOnly, q, setQ, sort, setSort,
  onReset
}: {
  type: string; setType: (v: string) => void;
  sport: string; setSport: (v: string) => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  q: string; setQ: (v: string) => void;
  sort: "deadline" | "newest"; setSort: (v: "deadline" | "newest") => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-0">
      <FilterGroup label="Search">
        <input className="input font-mononum" style={{ fontSize: 13, height: 40 }}
          placeholder="Title or club…" value={q} onChange={(e) => setQ(e.target.value)} />
      </FilterGroup>

      <FilterGroup label="Sport">
        <select className="input font-mononum min-h-[40px]"
          value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="">All sports</option>
          {SPORTS_LIST.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </FilterGroup>

      <FilterGroup label="Sort by">
        <select className="input font-mononum min-h-[40px]"
          value={sort} onChange={(e) => setSort(e.target.value as "deadline" | "newest")}>
          <option value="deadline">Deadline soonest</option>
          <option value="newest">Newest first</option>
        </select>
      </FilterGroup>

      <FilterGroup label="Type">
        {TYPES.map((t) => (
          <RadioItem key={t || "all"} label={t ? TYPE_LABELS[t] : "All types"} on={type === t} onClick={() => setType(t)} />
        ))}
      </FilterGroup>

      <Toggle on={verifiedOnly} onChange={setVerifiedOnly} label="Verified clubs only" />

      <div className="pt-4 mt-2">
        <button onClick={onReset} className="btn-ghost w-full min-h-[44px]">Clear all filters</button>
      </div>
    </div>
  );
}

export default function Opportunities() {
  const user = useAuthStore((s) => s.user);
  const [type, setType] = useState("");
  const [sport, setSport] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"deadline" | "newest">("deadline");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filters: OpportunityFilters = { status: "open", sort };
  if (type) filters.type = type;
  if (sport) filters.sport = sport;
  if (q) filters.q = q;
  if (verifiedOnly) filters.verified_org = true;

  const { list: oppsQuery, remove: deleteOpp } = useInfiniteOpportunities(filters);
  const { toggle: toggleSave, isSaved } = useSavedOpportunities();
  const canPost = hasRole(user?.role ?? "", "club", "organizer");

  const results = oppsQuery.data?.pages.flatMap((p) => p.data) ?? [];

  const activeFilterCount = [type, sport, verifiedOnly, q].filter(Boolean).length;

  function resetFilters() {
    setType(""); setSport(""); setVerifiedOnly(false); setQ("");
  }

  return (
    <div>
      {/* ── Mobile header row ─────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between mb-4 gap-3">
        <div className="flex-1">
          <h1 className="font-disp text-2xl leading-tight">Opportunities</h1>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="btn-secondary flex items-center gap-2 min-h-[44px] flex-shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-brand-500 text-white text-[10px] font-mononum rounded-full w-4 h-4 flex items-center justify-center leading-none flex-shrink-0">
              {activeFilterCount}
            </span>
          )}
        </button>
        {canPost && (
          <Link to="/opportunities/new" className="btn-accent min-h-[44px]">+ Post</Link>
        )}
      </div>

      {/* ── Mobile filter drawer ───────────────────────────────────── */}
      <div className="lg:hidden">
        <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filter opportunities">
          <FilterContent
            type={type} setType={setType}
            sport={sport} setSport={setSport}
            verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
            q={q} setQ={setQ}
            sort={sort} setSort={setSort}
            onReset={() => { resetFilters(); setDrawerOpen(false); }}
          />
        </MobileDrawer>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
        {/* ── Desktop filter rail ────────────────────────────────────── */}
        <div className="hidden lg:block panel p-[18px] sticky top-4">
          <SectionHead title="Filters" />
          <FilterContent
            type={type} setType={setType}
            sport={sport} setSport={setSport}
            verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
            q={q} setQ={setQ}
            sort={sort} setSort={setSort}
            onReset={resetFilters}
          />
        </div>

        {/* ── Results ────────────────────────────────────────────────── */}
        <ErrorBoundary>
        <div>
          <PageHeader
            title="Opportunities"
            subtitle={oppsQuery.data ? `${oppsQuery.data.pages[0]?.total ?? 0} total` : "Opportunity index"}
            action={canPost && <Link to="/opportunities/new" className="btn-accent min-h-[44px] flex items-center">+ Post opportunity</Link>}
            sticky
            className="hidden lg:flex"
          />

          {oppsQuery.isLoading ? (
            <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
          ) : !results.length ? (
            <EmptyState
              title="No opportunities match"
              hint="Try widening your filters — clear the type, sport, or search term."
              action={<button onClick={resetFilters} className="btn-ghost min-h-[44px]">Clear filters</button>}
            />
          ) : (
            <>
              {/* Desktop: 3-column grid / Mobile: single column */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {results.map((o: Opportunity) => {
                  const isPoster = hasRole(user?.role ?? "", "club", "organizer") && user?.id === o.posted_by_user_id;
                  const deadline = deadlineDays(o.application_deadline);
                  const spotsLeft = o.vacancies != null ? o.vacancies - (o.vacancies_filled ?? 0) : null;

                  return (
                    <div key={o.id} className="panel overflow-hidden flex flex-col">
                      {/* ── Card body ── */}
                      <Link to={`/opportunities/${o.id}`} className="block p-4 hover:bg-fill transition flex-1">
                        {/* Mobile: stacked layout / Desktop: stacked within grid cell */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded bg-fill border border-hairsoft flex-shrink-0 flex items-center justify-center">
                            <span className="font-disp text-lg text-ink-sub">{(o.org_name ?? "?")[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              <span className="badge text-[10px]">{TYPE_LABELS[o.type] ?? o.type}</span>
                              <span className="badge text-[10px] capitalize">{o.sport}</span>
                              <StatusPill status={o.status} />
                            </div>
                            {deadline.closed && (
                              <span className="inline-block bg-red-100 text-red-700 font-mononum text-[9px] uppercase tracking-widest px-2 py-0.5 rounded mb-1.5">
                                Deadline passed
                              </span>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-mononum text-[10px]" style={{ color: deadline.urgent && !deadline.closed ? "#FA4D14" : "#9A9286" }}>
                              {deadline.text}
                            </div>
                          </div>
                        </div>

                        <h3 className="font-disp text-base leading-snug mb-1">{o.title}</h3>
                        <div className="text-[12px] text-ink-70 mb-2">{o.org_name} · {o.city}</div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {spotsLeft !== null && (
                            <div className="font-mononum text-[11px] text-ink-70">
                              <span style={{ color: spotsLeft === 0 ? "#B83232" : spotsLeft <= 3 ? "#FA4D14" : undefined }}>
                                {spotsLeft === 0 ? "Full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
                              </span>
                            </div>
                          )}
                          <div className="font-mononum text-[11px] text-ink-70">{o.application_count} applicants</div>
                          <div className="font-mononum text-[11px] text-ink-70">Age {o.age_min}–{o.age_max}</div>
                        </div>
                      </Link>

                      {/* ── Card footer ── */}
                      <div className="px-4 py-2.5 border-t border-hairsoft flex items-center justify-between relative">
                        <button
                          onClick={() => toggleSave(o)}
                          className={`font-mononum text-[10.5px] flex items-center gap-1.5 transition min-h-[44px] ${isSaved(o.id) ? "text-brand-500" : "text-ink-faint hover:text-ink"}`}
                          title={isSaved(o.id) ? "Remove from saved" : "Save opportunity"}
                        >
                          <Bookmark className="h-3.5 w-3.5" fill={isSaved(o.id) ? "currentColor" : "none"} />
                          {isSaved(o.id) ? "Saved" : "Save"}
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Apply link (disabled if closed or no spots) */}
                          {!isAdmin(user?.role ?? "") && hasRole(user?.role ?? "", "athlete") && !deadline.closed && spotsLeft !== 0 && (
                            <Link
                              to={`/opportunities/${o.id}`}
                              className="btn-accent text-[11px] px-3 min-h-[44px] flex items-center"
                            >
                              Apply
                            </Link>
                          )}
                          {!isAdmin(user?.role ?? "") && hasRole(user?.role ?? "", "athlete") && (deadline.closed || spotsLeft === 0) && (
                            <span className="font-mononum text-[10px] text-ink-faint px-2">
                              {deadline.closed ? "Closed" : "Full"}
                            </span>
                          )}

                          {isPoster && (
                            <div className="relative">
                              <button data-menu-button onClick={() => setMenuOpenId(menuOpenId === o.id ? null : o.id)}
                                className="btn-ghost p-1.5 min-h-[44px]">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {menuOpenId === o.id && (
                                <div data-menu-content className="absolute right-0 bottom-12 panel shadow-pop z-10 min-w-36">
                                  <Link to={`/opportunities/${o.id}/edit`} onClick={() => setMenuOpenId(null)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft min-h-[44px]">
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </Link>
                                  <button onClick={() => { setPendingDeleteId(o.id); setMenuOpenId(null); }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 min-h-[44px]">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </button>
                                </div>
                              )}
                              {pendingDeleteId === o.id && (
                                <div className="absolute right-0 bottom-14 panel shadow-pop z-10 p-3 flex items-center gap-2 min-w-56">
                                  <span className="text-[12.5px] text-ink flex-1">Delete this opportunity?</span>
                                  <button onClick={() => deleteOpp.mutate(o.id, { onSuccess: () => setPendingDeleteId(null) })}
                                    disabled={deleteOpp.isPending} className="btn-danger min-h-[44px]">Confirm</button>
                                  <button onClick={() => setPendingDeleteId(null)} className="btn-secondary min-h-[44px]">Cancel</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {oppsQuery.hasNextPage && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => oppsQuery.fetchNextPage()}
                    disabled={oppsQuery.isFetchingNextPage}
                    className="btn-secondary min-h-[44px] px-8"
                  >
                    {oppsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
