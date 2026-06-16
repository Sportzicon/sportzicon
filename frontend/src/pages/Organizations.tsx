import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
interface OrganizationSearchResult extends Pick<import("../models").Organization, "id" | "org_name" | "sport_categories" | "logo_url" | "city" | "state" | "country" | "website"> {
  name?: string;
  is_verified?: boolean;
  org_type?: string;
}
import { PageHeader, Spinner, EmptyState } from "../components/UI";
import { Building2, Filter, X } from "lucide-react";
import { SPORTS_LIST } from "../data/sportPositions";
import { queryKeys } from "../hooks/queryKeys";

const ORG_TYPES = [
  { value: "club", label: "Club" },
  { value: "academy", label: "Academy" },
  { value: "school", label: "School" },
  { value: "university", label: "University" },
  { value: "association", label: "Association" }
];

export default function Organizations() {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [orgType, setOrgType] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filters = { q: q || undefined, sport: sport || undefined, org_type: orgType || undefined };
  const activeCount = [sport, orgType].filter(Boolean).length;

  const res = useQuery({
    queryKey: queryKeys.organizations(filters),
    queryFn: async () =>
      (await api.get<{ items: OrganizationSearchResult[] }>("/search/clubs", { params: filters })).data.items,
    placeholderData: (prev) => prev
  });

  const results: OrganizationSearchResult[] = res.data ?? [];

  function reset() {
    setQ("");
    setSport("");
    setOrgType("");
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Organizations" subtitle="Browse clubs, academies & sport organizations" />

      {/* Search + filter bar */}
      <div className="flex gap-2 items-center">
        <input
          className="input flex-1 min-h-[44px]"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowFilters((f) => !f)}
          className="btn-secondary min-h-[44px] flex items-center gap-1.5 relative flex-shrink-0"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
        {(q || sport || orgType) && (
          <button onClick={reset} className="btn-ghost min-h-[44px] flex items-center gap-1.5 flex-shrink-0">
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="panel p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs mb-1 block">Sport</label>
              <select
                className="input min-h-[44px]"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                <option value="">All sports</option>
                {SPORTS_LIST.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs mb-1 block">Type</label>
              <select
                className="input min-h-[44px]"
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
              >
                <option value="">All types</option>
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {(sport || orgType) && (
        <div className="flex flex-wrap gap-2">
          {sport && (
            <span className="badge flex items-center gap-1 capitalize">
              {sport}
              <button onClick={() => setSport("")} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {orgType && (
            <span className="badge flex items-center gap-1 capitalize">
              {orgType}
              <button onClick={() => setOrgType("")} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {res.isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner className="text-brand-500" />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No organizations found"
          hint="Try different keywords or clear the filters."
          action={<button onClick={reset} className="btn-secondary min-h-[44px]">Clear filters</button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((org) => (
            <Link
              key={org.id}
              to={`/organizations/${org.id}`}
              className="card card-body flex items-start gap-4 hover:shadow-pop transition min-h-[72px]"
            >
              <div className="h-12 w-12 flex-shrink-0 rounded border border-hairsoft bg-fill overflow-hidden flex items-center justify-center">
                {org.logo_url ? (
                  <img src={org.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-ink-faint" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <div className="font-semibold text-[13.5px] text-ink truncate">{org.name ?? org.org_name}</div>
                  {org.is_verified && (
                    <span className="badge-verified text-[10px]"><span className="tick">✓</span> Verified</span>
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
  );
}
