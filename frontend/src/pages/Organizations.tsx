import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, EmptyState } from "../components/UI";
import { Building2 } from "lucide-react";

export default function Organizations() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  const res = useQuery({
    queryKey: ["browse-orgs", q, city],
    queryFn: async () =>
      (await api.get("/search/clubs", { params: { q: q || undefined, city: city || undefined } })).data.items as any[],
    placeholderData: (prev) => prev,
  });

  const results: any[] = res.data ?? [];

  function reset() {
    setQ("");
    setCity("");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Organizations" subtitle="Browse clubs, academies & sport organizations" />

      {/* Search bar */}
      <div className="panel p-4 flex flex-wrap gap-3">
        <input
          className="input font-mononum flex-1 min-w-[160px]"
          style={{ fontSize: 12, height: 34 }}
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input font-mononum w-36"
          style={{ fontSize: 12, height: 34 }}
          placeholder="City…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        {(q || city) && (
          <button onClick={reset} className="btn-secondary text-[12px]">
            Clear
          </button>
        )}
      </div>

      {res.isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner className="text-brand-500" />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No organizations found"
          hint="Try different keywords or clear the filters."
          action={<button onClick={reset} className="btn-secondary">Clear filters</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((org: any) => (
            <Link
              key={org.id}
              to={`/organizations/${org.id}`}
              className="card card-body flex items-start gap-4 hover:shadow-pop transition"
            >
              <div className="h-12 w-12 flex-shrink-0 rounded border border-hairsoft bg-fill overflow-hidden flex items-center justify-center">
                {org.logo_url ? (
                  <img src={org.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-ink-faint" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13.5px] text-ink truncate">{org.name}</div>
                {org.sport && (
                  <div className="lab text-[11px] mt-0.5 truncate">{org.sport}</div>
                )}
                {org.city && (
                  <div className="lab text-[11px] mt-0.5 truncate">
                    {org.city}{org.country ? `, ${org.country}` : ""}
                  </div>
                )}
                {org.description && (
                  <p className="text-[11.5px] text-ink-sub mt-1.5 line-clamp-2">{org.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
