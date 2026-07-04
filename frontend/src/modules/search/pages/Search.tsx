import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Filter, X, ChevronDown } from "lucide-react";
import { useSearchPlayers, useSearchClubs, useSearchOpportunities } from "../../../hooks";
import { Avatar, StatusPill, Spinner, EmptyState } from "../../../components/UI";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { useDebounce } from "../../../hooks/useDebounce";

type Mode = "players" | "clubs" | "opportunities";

const SPORTS = [
  "Cricket", "Football", "Athletics", "Basketball", "Hockey",
  "Tennis", "Badminton", "Volleyball", "Kabaddi", "Wrestling", "Boxing",
];

const LEVELS = [
  { label: "Any level", value: "" },
  { label: "Beginner", value: "beginner" },
  { label: "Amateur", value: "amateur" },
  { label: "Semi-pro", value: "semi_pro" },
  { label: "Professional", value: "professional" },
];

const OPP_TYPES = [
  { label: "Any type", value: "" },
  { label: "Trial", value: "trial" },
  { label: "Recruitment", value: "recruitment" },
  { label: "Scholarship", value: "scholarship" },
  { label: "Tournament", value: "tournament" },
  { label: "Coaching Job", value: "coaching_job" },
];

const OPP_SORTS = [
  { label: "Newest first", value: "newest" },
  { label: "Deadline soon", value: "deadline" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center justify-between w-full cursor-pointer py-1 min-h-[38px]"
      onClick={() => onChange(!on)}
    >
      <span className="text-sm text-ink">{label}</span>
      <span
        className="relative inline-block w-9 h-5 rounded-full flex-shrink-0 transition-colors"
        style={{ background: on ? "#FA4D14" : "rgba(20,17,13,0.15)" }}
      >
        <span
          className="absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all"
          style={{ left: on ? 18 : 3 }}
        />
      </span>
    </button>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-2 mb-2 border-b border-hairsoft last:border-0 last:mb-0 last:pb-0">
      <div className="lab mb-1">{label}</div>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="panel p-4 animate-pulse">
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 rounded-full bg-fill flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-fill rounded w-2/3" />
          <div className="h-3 bg-fill rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [mode, setMode] = useState<Mode>(() => {
    const tab = searchParams.get("tab");
    if (tab === "clubs" || tab === "opportunities") return tab;
    return "players";
  });

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Shared filters
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");

  // Player filters
  const [playRole, setPlayRole] = useState("");
  const [level, setLevel] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availOnly, setAvailOnly] = useState(false);

  // Club filters
  const [orgType, setOrgType] = useState("");

  // Opportunity filters
  const [oppType, setOppType] = useState("");
  const [oppSort, setOppSort] = useState<"newest" | "deadline">("newest");

  const debouncedQ = useDebounce(q, 300);

  // sync URL tab
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (mode !== "players") next.set("tab", mode);
      else next.delete("tab");
      return next;
    }, { replace: true });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const playerParams = {
    q: debouncedQ || undefined,
    sport: sport || undefined,
    position: playRole || undefined,
    experience_level: level || undefined,
    city: city || undefined,
    verified: verifiedOnly || undefined,
    available: availOnly || undefined,
    limit: 20,
  };

  const clubParams = {
    q: debouncedQ || undefined,
    sport: sport || undefined,
    city: city || undefined,
    org_type: orgType || undefined,
    limit: 20,
  };

  const oppParams = {
    q: debouncedQ || undefined,
    sport: sport || undefined,
    city: city || undefined,
    type: oppType || undefined,
    sort: oppSort,
    limit: 20,
  };

  const playersQuery = useSearchPlayers(playerParams, mode === "players");
  const clubsQuery = useSearchClubs(clubParams, mode === "clubs");
  const oppsQuery = useSearchOpportunities(oppParams, mode === "opportunities");

  const activeQuery = mode === "players" ? playersQuery : mode === "clubs" ? clubsQuery : oppsQuery;
  const allItems = activeQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const total = activeQuery.data?.pages[0]?.total ?? 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
          activeQuery.fetchNextPage();
        }
      },
      { rootMargin: "100px" }
    );
    obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [activeQuery]);

  function resetFilters() {
    setQ(""); setSport(""); setCity(""); setPlayRole(""); setLevel("");
    setVerifiedOnly(false); setAvailOnly(false); setOrgType(""); setOppType("");
    setOppSort("newest");
  }

  const activeFilterCount = [
    sport, city, playRole, level, orgType, oppType,
    verifiedOnly && "v", availOnly && "a",
  ].filter(Boolean).length;

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setFiltersOpen(false);
  }, []);

  const filterContent = (
    <>
      <FilterSection label="Keyword / Name">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none" />
          <input
            className="input w-full pl-8 text-sm min-h-[38px]"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              onClick={() => setQ("")}
            >
              <X className="h-3.5 w-3.5 text-ink-faint" />
            </button>
          )}
        </div>
      </FilterSection>

      {(mode === "players" || mode === "opportunities" || mode === "clubs") && (
        <FilterSection label="Sport">
          <select className="input w-full text-sm min-h-[38px]" value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="">All sports</option>
            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterSection>
      )}

      <FilterSection label="City">
        <input
          className="input w-full text-sm min-h-[38px]"
          placeholder="e.g. Mumbai"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </FilterSection>

      {mode === "players" && (
        <>
          <FilterSection label="Position / Role">
            <input
              className="input w-full text-sm min-h-[38px]"
              placeholder="e.g. Striker"
              value={playRole}
              onChange={(e) => setPlayRole(e.target.value)}
            />
          </FilterSection>
          <FilterSection label="Experience level">
            <select className="input w-full text-sm min-h-[38px]" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </FilterSection>
          <div className="flex flex-col gap-0">
            <Toggle on={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
            <Toggle on={availOnly} onChange={setAvailOnly} label="Available / open to offers" />
          </div>
        </>
      )}

      {mode === "clubs" && (
        <FilterSection label="Organisation type">
          <select className="input w-full text-sm min-h-[38px]" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
            <option value="">Any type</option>
            <option value="club">Club</option>
            <option value="academy">Academy</option>
            <option value="both">Both</option>
          </select>
        </FilterSection>
      )}

      {mode === "opportunities" && (
        <>
          <FilterSection label="Opportunity type">
            <select className="input w-full text-sm min-h-[38px]" value={oppType} onChange={(e) => setOppType(e.target.value)}>
              {OPP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FilterSection>
          <FilterSection label="Sort by">
            <select className="input w-full text-sm min-h-[38px]" value={oppSort} onChange={(e) => setOppSort(e.target.value as "newest" | "deadline")}>
              {OPP_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FilterSection>
        </>
      )}

      <button onClick={resetFilters} className="mt-2 w-full btn-secondary text-sm min-h-[38px]">
        Reset filters
      </button>
    </>
  );

  const isLoading = activeQuery.isLoading;
  const isEmpty = !isLoading && allItems.length === 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Mobile tab bar */}
      <div className="flex border-b border-hair mb-4 overflow-x-auto scrollbar-none lg:hidden">
        {(["players", "clubs", "opportunities"] as Mode[]).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={`font-mononum capitalize text-[12px] tracking-[0.05em] px-5 py-3 border-b-2 -mb-px transition whitespace-nowrap min-h-[44px] ${
              mode === m ? "border-brand-500 text-ink font-semibold" : "border-transparent text-ink-sub"
            }`}>
            {m}
          </button>
        ))}
      </div>

      {/* Mobile: search input + filter button row */}
      <div className="flex gap-2 mb-4 lg:hidden">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
          <input
            className="input w-full pl-9 text-sm min-h-[44px]"
            placeholder={`Search ${mode}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] flex items-center" onClick={() => setQ("")}>
              <X className="h-4 w-4 text-ink-faint" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="btn-secondary flex items-center gap-2 min-h-[44px] whitespace-nowrap flex-shrink-0"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile filter drawer */}
      <div className="lg:hidden">
        <MobileDrawer isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
          {filterContent}
        </MobileDrawer>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
        {/* Desktop filter sidebar */}
        <div className="hidden lg:block panel p-5 sticky top-4">
          <div className="lab mb-4 font-semibold text-ink">Filters</div>
          {filterContent}
        </div>

        {/* Results column */}
        <div>
          {/* Desktop tab bar */}
          <div className="hidden lg:flex border-b border-hair mb-5">
            {(["players", "clubs", "opportunities"] as Mode[]).map((m) => (
              <button key={m} onClick={() => switchMode(m)}
                className={`font-mononum capitalize text-[12px] tracking-[0.05em] px-5 py-3 border-b-2 -mb-px transition min-h-[44px] ${
                  mode === m ? "border-brand-500 text-ink font-semibold" : "border-transparent text-ink-sub hover:text-ink"
                }`}>
                {m}
              </button>
            ))}
          </div>

          {!isLoading && !isEmpty && (
            <div className="lab mb-3">
              {total} result{total !== 1 ? "s" : ""}
              {mode === "players" && <span className="ml-1 text-ink-faint">· verified ranked first</span>}
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : isEmpty ? (
            <EmptyState
              title="No results found"
              hint={
                activeFilterCount > 0 || q
                  ? "Try loosening your filters or using a different keyword."
                  : `No ${mode} found yet. Try searching by name, sport, or city.`
              }
              action={
                (activeFilterCount > 0 || q) ? (
                  <button onClick={resetFilters} className="btn-secondary min-h-[44px]">
                    Reset filters
                  </button>
                ) : undefined
              }
            />
          ) : mode === "players" ? (
            <PlayerResults items={allItems} />
          ) : mode === "clubs" ? (
            <ClubResults items={allItems} />
          ) : (
            <OpportunityResults items={allItems} />
          )}

          {/* Infinite scroll sentinel */}
          <div ref={loadMoreRef} className="h-4" />

          {activeQuery.isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Spinner className="text-brand-500" />
            </div>
          )}

          {activeQuery.hasNextPage && !activeQuery.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <button
                className="btn-secondary min-h-[44px]"
                onClick={() => activeQuery.fetchNextPage()}
              >
                Load more
              </button>
            </div>
          )}

          {!activeQuery.hasNextPage && allItems.length > 0 && (
            <p className="text-center lab py-4">All results loaded</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerResults({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((a) => {
        const d = a.athlete_data as Record<string, unknown> | undefined;
        const avail = (d?.availability as string) ?? undefined;
        const verif = a.verification as { status: string } | undefined;
        return (
          <Link
            key={a.id as string}
            to={`/profile/${a.id}`}
            className="panel p-4 hover:bg-fill transition flex gap-3 items-start min-h-[72px]"
          >
            <Avatar name={a.full_name as string} src={a.profile_photo_url as string | undefined} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
                <span className="truncate">{a.full_name as string}</span>
                {verif?.status === "approved" && (
                  <span className="text-brand-500 text-[10px] flex-shrink-0">✓</span>
                )}
              </div>
              <div className="lab mt-0.5 truncate">
                {d?.primary_sport as string ?? "—"} · {d?.position as string ?? "—"}
              </div>
              <div className="lab truncate">{a.city as string ?? ""}</div>
              {avail && avail !== "not_available" && (
                <div className="mt-1">
                  <span
                    className="font-mononum text-[10px] uppercase tracking-[0.06em]"
                    style={{ color: avail === "available" ? "#2B66C9" : "#2E7D52" }}
                  >
                    {avail === "available" ? "Available" : "Open to offers"}
                  </span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ClubResults({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const cats = item.sport_categories as string[] | undefined;
        return (
          <Link
            key={item.id as string}
            to={`/organizations/${item.id}`}
            className="panel p-4 hover:bg-fill transition min-h-[72px]"
          >
            <div className="flex gap-3 items-start">
              <Avatar name={item.org_name as string} size={48} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
                  <span className="truncate">{item.org_name as string}</span>
                  {item.verification_status === "approved" && (
                    <span className="text-brand-500 text-[10px] flex-shrink-0">✓</span>
                  )}
                </div>
                <div className="lab mt-0.5 capitalize">{item.org_type as string} · {item.city as string ?? ""}</div>
              </div>
            </div>
            {cats && cats.length > 0 && (
              <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-none">
                {cats.map((c) => (
                  <span key={c} className="inline-block bg-fill rounded px-2 py-0.5 text-[11px] font-mononum whitespace-nowrap">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function OpportunityResults({ items }: { items: Record<string, unknown>[] }) {
  const now = new Date();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((o) => {
        const deadlinePassed = new Date(o.application_deadline as string) < now;
        return (
          <Link
            key={o.id as string}
            to={`/opportunities/${o.id}`}
            className="panel p-4 hover:bg-fill transition min-h-[72px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="kicker">{(o.type as string).replace(/_/g, " ")} · {o.sport as string}</div>
                <div className="font-disp text-lg mt-1 leading-tight">{o.title as string}</div>
                <div className="lab mt-1 truncate">{o.org_name as string} · {o.city as string}, {o.country as string}</div>
              </div>
              {deadlinePassed && (
                <span className="text-[10px] font-mononum uppercase tracking-wide text-red-500 flex-shrink-0 mt-1">
                  Closed
                </span>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-hairsoft flex items-center gap-3 flex-wrap">
              <StatusPill status={o.status as string} />
              <span className="lab">
                Deadline {o.application_deadline as string}
              </span>
              {o.vacancies != null && (
                <span className="lab ml-auto">
                  {Math.max(0, Number(o.vacancies) - Number(o.application_count ?? 0))} spots left
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
