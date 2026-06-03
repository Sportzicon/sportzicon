import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, EmptyState, Avatar, StatusPill, SectionHead, Pagination } from "../components/UI";
import { ChevronDown } from "lucide-react";

type Mode = "players" | "clubs" | "opportunities";
type ViewMode = "table" | "grid";

const SPORTS = ["Cricket", "Football", "Athletics", "Basketball", "Hockey", "Tennis", "Badminton", "Kabaddi"];
const ROLES = ["Batter", "Bowler", "All-rounder", "Wicket-keeper", "Winger", "Goalkeeper", "Striker", "Defender", "Midfielder", "Sprinter", "Raider", "Point Guard"];
const LEVELS = [
  { label: "Any level", value: "" },
  { label: "Beginner", value: "beginner" },
  { label: "Amateur", value: "amateur" },
  { label: "Semi-pro", value: "semi_pro" },
  { label: "Professional", value: "professional" },
];

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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-4 mb-4 border-b border-hairsoft last:border-0 last:mb-0 last:pb-0">
      <div className="lab mb-2">{label}</div>
      {children}
    </div>
  );
}

const PAGE_SIZE = 10;

export default function Search() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => {
    const tab = searchParams.get("tab");
    if (tab === "clubs" || tab === "opportunities") return tab;
    return "players";
  });
  const [view, setView] = useState<ViewMode>("table");
  const [filtersOpen, setFiltersOpen] = useState(window.innerWidth >= 1024);
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [playRole, setPlayRole] = useState("");
  const [level, setLevel] = useState("");
  const [city, setCity] = useState("");
  const [ageMax, setAgeMax] = useState(40);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availOnly, setAvailOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setFiltersOpen(true);
      else setFiltersOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Reset to page 1 whenever filters or mode change
  useEffect(() => { setPage(1); }, [mode, q, sport, playRole, level, city, ageMax, verifiedOnly, availOnly, savedOnly, view]);

  function toggleShortlist(id: string) {
    setShortlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const params: any = {
    q: q || undefined,
    sport: sport || undefined,
    city: city || undefined,
    verified: verifiedOnly || undefined,
    available: availOnly || undefined,
    position: playRole || undefined,
    experience_level: level || undefined,
    age_max: ageMax < 40 ? ageMax : undefined
  };

  const res = useQuery({
    queryKey: ["search", mode, params],
    queryFn: async () => (await api.get(`/search/${mode}`, { params })).data.items as any[],
    placeholderData: (prev) => prev
  });

  const results: any[] = savedOnly && mode === "players"
    ? (res.data ?? []).filter((a: any) => shortlist.has(a.id))
    : (res.data ?? []);

  const paginatedResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setQ(""); setSport(""); setPlayRole(""); setLevel("");
    setCity(""); setAgeMax(40); setVerifiedOnly(false); setAvailOnly(false); setSavedOnly(false);
    setPage(1);
  }

  const savedCount = shortlist.size;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr] items-start">
        {/* Filter rail — always visible on desktop, toggled on mobile */}
        <div className={`panel p-[18px] sticky top-4 ${filtersOpen ? "" : "hidden lg:block"}`}>
          <SectionHead title="Filters" />

          <FilterGroup label="Keyword">
            <input className="input font-mononum" style={{ fontSize: 12, height: 34 }}
              placeholder="Name or city…" value={q} onChange={(e) => setQ(e.target.value)} />
          </FilterGroup>

          {mode === "players" && (
            <>
              <FilterGroup label="Sport">
                <select className="input font-mononum" style={{ fontSize: 12, height: 34 }}
                  value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="">All sports</option>
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterGroup>
              <FilterGroup label="Playing role / position">
                <select className="input font-mononum" style={{ fontSize: 12, height: 34 }}
                  value={playRole} onChange={(e) => setPlayRole(e.target.value)}>
                  <option value="">Select role</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FilterGroup>
              <FilterGroup label={`Max age — ${ageMax}`}>
                <input type="range" min={16} max={40} value={ageMax}
                  onChange={(e) => setAgeMax(Number(e.target.value))}
                  className="w-full mt-1" style={{ accentColor: "#FA4D14" }} />
                <div className="flex justify-between mt-1">
                  <span className="lab">16</span><span className="lab">40</span>
                </div>
              </FilterGroup>
              <FilterGroup label="Experience level">
                <select className="input font-mononum" style={{ fontSize: 12, height: 34 }}
                  value={level} onChange={(e) => setLevel(e.target.value)}>
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </FilterGroup>
              <div className="flex flex-col gap-3">
                <Toggle on={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
                <Toggle on={availOnly} onChange={setAvailOnly} label="Available / open to offers" />
              </div>
            </>
          )}

          {mode === "clubs" && (
            <FilterGroup label="City">
              <input className="input font-mononum" style={{ fontSize: 12, height: 34 }}
                placeholder="e.g. Pune" value={city} onChange={(e) => setCity(e.target.value)} />
            </FilterGroup>
          )}

          {mode === "opportunities" && (
            <>
              <FilterGroup label="Sport">
                <select className="input font-mononum" style={{ fontSize: 12, height: 34 }}
                  value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="">All sports</option>
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterGroup>
              <FilterGroup label="City">
                <input className="input font-mononum" style={{ fontSize: 12, height: 34 }}
                  placeholder="e.g. Mumbai" value={city} onChange={(e) => setCity(e.target.value)} />
              </FilterGroup>
            </>
          )}

          <button onClick={resetFilters} className="mt-4 w-full btn-secondary text-[12px]">
            Reset filters
          </button>
        </div>

        {/* Results */}
        <div>
          <PageHeader
            title="Search players"
            subtitle="Talent search"
            action={
              <div className="flex items-center gap-2">
                {mode === "players" && (
                  <>
                    <button
                      onClick={() => setSavedOnly((s) => !s)}
                      className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-2 rounded border transition ${savedOnly ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink"}`}>
                      ★ Shortlist · {savedCount}
                    </button>
                    <div className="flex border border-hair rounded overflow-hidden">
                      {([["table", "≣"], ["grid", "▦"]] as const).map(([v, icon]) => (
                        <button key={v} onClick={() => setView(v)}
                          className="font-mononum px-3 py-2 text-[13px] transition"
                          style={{ background: view === v ? "#14110D" : undefined, color: view === v ? "#F7F5EF" : "#726B60" }}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            }
          />

          {/* Mode tabs */}
          <div className="flex gap-0 border-b border-hair mb-4">
            {(["players", "clubs", "opportunities"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`font-mononum capitalize text-[11.5px] tracking-[0.06em] px-4 py-2.5 border-b-2 -mb-px transition ${
                  mode === m ? "border-brand-500 text-ink font-semibold" : "border-transparent text-ink-sub hover:text-ink"
                }`}>
                {m}
              </button>
            ))}
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="lg:hidden flex items-center justify-between w-full panel p-3 text-sm font-medium mb-4"
          >
            <span>Filters</span>
            <ChevronDown className="h-4 w-4" style={{ transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
          </button>

          {mode === "players" && (
            <div className="flex justify-end mb-3">
              <span className="lab">Verified ranked first</span>
            </div>
          )}

          {res.isLoading ? (
            <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
          ) : !results.length ? (
            <EmptyState
              title={savedOnly ? "Shortlist is empty" : "No results"}
              hint={savedOnly ? "Star players in the table to add them here." : "Try different keywords, loosen filters, or reset."}
              action={
                <button onClick={resetFilters} className="btn-secondary">Reset filters</button>
              }
            />
          ) : mode === "players" && view === "table" ? (
            <>
              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr className="border-b border-hair">
                      {["Player", "Role", "Level", "Age", "Key stat", "Avail.", ""].map((h, i) => (
                        <th key={h} className={`lab px-[14px] py-[11px] font-normal ${i >= 2 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((a: any) => {
                      const saved = shortlist.has(a.id);
                      const avail = a.athlete_data?.availability ?? a.availability;
                      return (
                        <tr key={a.id} className="border-b border-hairsoft hover:bg-fill transition">
                          <td className="px-[14px] py-[10px]">
                            <Link to={`/profile/${a.id}`} className="flex items-center gap-2.5">
                              <Avatar name={a.full_name} size={32} />
                              <div>
                                <div className="font-semibold text-ink flex items-center gap-1.5">
                                  {a.full_name}
                                  {a.verification?.status === "approved" && <span className="text-brand-500 text-[10px]">✓</span>}
                                </div>
                                <div className="lab mt-0.5">{a.athlete_data?.primary_sport ?? a.sport} · {a.city}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-[14px] py-[10px] text-ink-70">
                            {a.athlete_data?.position ?? a.role ?? "—"}
                          </td>
                          <td className="px-[14px] py-[10px] text-right font-mononum text-[12px] text-ink-sub">
                            {a.athlete_data?.experience_level?.replace(/_/g, " ") ?? "—"}
                          </td>
                          <td className="px-[14px] py-[10px] text-right font-mononum text-[12px]">
                            {a.dob ? Math.floor((Date.now() - new Date(a.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : "—"}
                          </td>
                          <td className="px-[14px] py-[10px] text-right font-mononum text-[12px] text-ink-sub">
                            {a.athlete_data?.primary_sport ?? "—"}
                          </td>
                          <td className="px-[14px] py-[10px] text-right">
                            <span className="font-mononum text-[10px] uppercase tracking-[0.06em]"
                              style={{ color: avail === "not_available" ? "#9A9286" : avail === "open_to_offers" ? "#2E7D52" : "#2B66C9" }}>
                              {avail === "open_to_offers" ? "Open" : avail === "available" ? "Avail" : "—"}
                            </span>
                          </td>
                          <td className="px-[14px] py-[10px] text-right">
                            <button onClick={() => toggleShortlist(a.id)}
                              className="text-[16px] transition hover:scale-110"
                              style={{ color: saved ? "#FA4D14" : "#9A9286" }}
                              title={saved ? "Remove from shortlist" : "Add to shortlist"}>
                              {saved ? "★" : "☆"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={results.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          ) : mode === "players" && view === "grid" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {paginatedResults.map((a: any) => {
                  const saved = shortlist.has(a.id);
                  const avail = a.athlete_data?.availability ?? a.availability;
                  return (
                    <div key={a.id} className="panel p-4">
                      <div className="flex gap-3">
                        <Avatar name={a.full_name} size={48} />
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${a.id}`} className="flex items-center gap-1.5">
                            <span className="font-disp text-lg leading-tight">{a.full_name}</span>
                            {a.verification?.status === "approved" && <span className="text-brand-500 text-[10px]">✓</span>}
                          </Link>
                          <div className="lab mt-1">{a.athlete_data?.position ?? "—"} · {a.athlete_data?.primary_sport ?? a.sport} · {a.city}</div>
                        </div>
                        <button onClick={() => toggleShortlist(a.id)}
                          className="text-[17px] flex-shrink-0 transition hover:scale-110"
                          style={{ color: saved ? "#FA4D14" : "#9A9286" }}>
                          {saved ? "★" : "☆"}
                        </button>
                      </div>
                      <div className="mt-4 pt-3 border-t border-hairsoft grid grid-cols-3 gap-2">
                        <div>
                          <div className="lab">Sport</div>
                          <div className="font-mononum text-[12px] text-ink mt-0.5">{a.athlete_data?.primary_sport ?? "—"}</div>
                        </div>
                        <div>
                          <div className="lab">Level</div>
                          <div className="font-mononum text-[12px] text-ink mt-0.5 capitalize">{a.athlete_data?.experience_level?.replace(/_/g, " ") ?? "—"}</div>
                        </div>
                        <div>
                          <div className="lab">Avail.</div>
                          <div className="font-mononum text-[10px] mt-0.5 uppercase tracking-[0.06em]"
                            style={{ color: avail === "not_available" ? "#9A9286" : avail === "open_to_offers" ? "#2E7D52" : "#2B66C9" }}>
                            {avail === "open_to_offers" ? "Open" : avail === "available" ? "Avail" : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={page} total={results.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          ) : mode === "opportunities" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {paginatedResults.map((o: any) => (
                  <Link key={o.id} to={`/opportunities/${o.id}`} className="panel p-4 hover:bg-fill transition">
                    <div className="kicker">{o.type} · {o.sport}</div>
                    <div className="font-disp text-xl mt-1.5">{o.title}</div>
                    <div className="lab mt-1">{o.org_name} · {o.city}, {o.country}</div>
                    <div className="mt-3 pt-3 border-t border-hairsoft flex items-center gap-3">
                      <StatusPill status={o.status} />
                      <span className="lab">Deadline {o.application_deadline}</span>
                    </div>
                  </Link>
                ))}
              </div>
              <Pagination page={page} total={results.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          ) : (
            /* clubs */
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {paginatedResults.map((item: any) => (
                  <Link key={item.id} to={`/organizations/${item.id}`} className="panel p-4 hover:bg-fill transition flex items-center gap-3">
                    <Avatar name={item.org_name} size={40} />
                    <div>
                      <div className="font-semibold text-ink flex items-center gap-1.5">
                        {item.org_name}
                        {item.verification_status === "approved" && <span className="text-brand-500 text-[10px]">✓</span>}
                      </div>
                      <div className="lab mt-1">{item.org_type} · {item.city}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <Pagination page={page} total={results.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>
    </div>
  );
}
