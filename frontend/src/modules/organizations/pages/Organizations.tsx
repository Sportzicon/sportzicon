import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { PageHeader, Spinner, EmptyState } from "../../../components/UI";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { Building2, SlidersHorizontal, X, Search } from "lucide-react";
import { SPORTS_LIST } from "../../../data/sportPositions";
import { queryKeys } from "../../../hooks/queryKeys";

interface OrgRow {
  id: string;
  org_name: string;
  org_type: string;
  logo_url: string | null;
  sport_categories: string[];
  city: string | null;
  country: string | null;
  verification_status: string;
}

const ORG_TYPES = [
  { value: "club",    label: "Club" },
  { value: "academy", label: "Academy" },
  { value: "both",    label: "Both" },
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

function OrgFilterContent({
  sport, setSport, orgType, setOrgType, city, setCity, verifiedOnly, setVerifiedOnly, onReset,
}: {
  sport: string; setSport: (v: string) => void;
  orgType: string; setOrgType: (v: string) => void;
  city: string; setCity: (v: string) => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-0">
      <div className="pb-2 mb-2 border-b border-hairsoft">
        <div className="lab mb-1">Sport</div>
        <select
          className="input w-full text-sm min-h-[38px]"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          <option value="">All sports</option>
          {SPORTS_LIST.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="pb-2 mb-2 border-b border-hairsoft">
        <div className="lab mb-1">Type</div>
        <select
          className="input w-full text-sm min-h-[38px]"
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
        >
          <option value="">All types</option>
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="pb-2 mb-2 border-b border-hairsoft">
        <div className="lab mb-1">City</div>
        <input
          className="input w-full text-sm min-h-[38px]"
          placeholder="e.g. Mumbai"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      <div className="pb-2 mb-2 border-b border-hairsoft">
        <Toggle on={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
      </div>

      <button onClick={onReset} className="mt-2 w-full btn-ghost min-h-[38px] text-sm">
        Clear filters
      </button>
    </div>
  );
}

export default function Organizations() {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [orgType, setOrgType] = useState("");
  const [city, setCity] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters = {
    q: q || undefined,
    sport: sport || undefined,
    org_type: orgType || undefined,
    city: city || undefined,
    verified: verifiedOnly || undefined,
  };

  const activeCount = [sport, orgType, city, verifiedOnly && "v"].filter(Boolean).length;

  const res = useQuery({
    queryKey: queryKeys.organizations(filters),
    queryFn: async () => {
      const r = await api.get<{ data: OrgRow[]; total: number }>("/search/clubs", { params: filters });
      return r.data.data ?? [];
    },
    placeholderData: (prev) => prev,
  });

  const results: OrgRow[] = res.data ?? [];

  const reset = useCallback(() => {
    setSport("");
    setOrgType("");
    setCity("");
    setVerifiedOnly(false);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organizations"
        subtitle="Browse clubs, academies & sport organizations"
      />

      {/* Mobile filter bar */}
      <div className="lg:hidden flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
          <input
            className="input w-full pl-9 min-h-[44px]"
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink min-h-[44px] flex items-center"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="btn-secondary min-h-[44px] flex items-center gap-1.5 relative flex-shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-brand-500 text-white text-[9px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Main layout */}
      <div className="flex gap-6 items-start">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 sticky top-4 self-start">
          <div className="panel p-5 space-y-0">
            <div className="lab mb-3 font-semibold text-ink">Filters</div>

            {/* Search */}
            <div className="pb-2 mb-2 border-b border-hairsoft">
              <div className="lab mb-1">Search</div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none" />
                <input
                  className="input w-full pl-8 text-sm min-h-[38px]"
                  placeholder="Search by name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <OrgFilterContent
              sport={sport} setSport={setSport}
              orgType={orgType} setOrgType={setOrgType}
              city={city} setCity={setCity}
              verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
              onReset={() => { setQ(""); reset(); }}
            />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {res.isLoading ? (
            <div className="flex justify-center p-12">
              <Spinner className="text-brand-500" />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="No organizations found"
              hint={q || activeCount > 0 ? "Try different keywords or clear the filters." : "No organizations have been added yet."}
              action={
                (q || activeCount > 0) ? (
                  <button onClick={() => { setQ(""); reset(); }} className="btn-secondary min-h-[44px]">
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((org) => (
                <Link
                  key={org.id}
                  to={`/organizations/${org.id}`}
                  className="panel p-4 flex items-start gap-3 hover:bg-fill transition min-h-[72px]"
                >
                  <div className="h-11 w-11 flex-shrink-0 rounded border border-hairsoft bg-fill overflow-hidden flex items-center justify-center">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5 text-ink-faint" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <div className="font-semibold text-[13.5px] text-ink truncate">{org.org_name}</div>
                      {org.verification_status === "approved" && (
                        <span className="text-brand-500 text-[10px] flex-shrink-0">✓ Verified</span>
                      )}
                    </div>
                    {org.org_type && (
                      <div className="lab text-[11px] capitalize">{org.org_type}</div>
                    )}
                    {org.sport_categories?.length > 0 && (
                      <div className="mt-1 flex gap-1 overflow-x-auto no-scrollbar">
                        {org.sport_categories.slice(0, 3).map((s: string) => (
                          <span key={s} className="badge text-[10px] flex-shrink-0 capitalize">{s}</span>
                        ))}
                        {org.sport_categories.length > 3 && (
                          <span className="badge text-[10px] flex-shrink-0">+{org.sport_categories.length - 3}</span>
                        )}
                      </div>
                    )}
                    {(org.city || org.country) && (
                      <div className="lab text-[11px] mt-0.5 truncate">
                        {[org.city, org.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Mobile drawer */}
      <div className="lg:hidden">
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Filters${activeCount > 0 ? ` (${activeCount})` : ""}`}
          footer={
            <div className="p-3 flex gap-2">
              <button onClick={() => { reset(); setDrawerOpen(false); }} className="btn-secondary flex-1 min-h-[44px]">Clear</button>
              <button onClick={() => setDrawerOpen(false)} className="btn-accent flex-1 min-h-[44px]">Apply</button>
            </div>
          }
        >
          <OrgFilterContent
            sport={sport} setSport={setSport}
            orgType={orgType} setOrgType={setOrgType}
            city={city} setCity={setCity}
            verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
            onReset={() => { reset(); setDrawerOpen(false); }}
          />
        </MobileDrawer>
      </div>
    </div>
  );
}
