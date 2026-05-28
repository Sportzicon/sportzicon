import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, VerifiedBadge, Badge } from "../components/UI";

type Mode = "players" | "clubs" | "opportunities";

const UNIT_LABELS = { km: "km", miles: "miles" };

export default function Search() {
  const [mode, setMode] = useState<Mode>("players");
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [verified, setVerified] = useState(false);
  const [radius, setRadius] = useState("");
  const [unit, setUnit] = useState<"km" | "miles">("km");

  const radiusKm = radius ? (unit === "miles" ? Math.round(Number(radius) * 1.60934) : Number(radius)) : undefined;

  const params: any = { q: q || undefined, sport: sport || undefined, city: city || undefined };
  if (mode === "players" && verified) params.verified = true;
  if (radiusKm && city) params.radius_km = radiusKm;

  const res = useQuery({
    queryKey: ["search", mode, params],
    queryFn: async () => (await api.get(`/search/${mode}`, { params })).data.items
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Search" subtitle="Find athletes, clubs, and opportunities." />
      <div className="card card-body">
        <div className="flex gap-2">
          {(["players", "clubs", "opportunities"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`btn ${mode === m ? "btn-primary" : "btn-secondary"}`}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className="input sm:col-span-2" placeholder="Search keyword..." value={q} onChange={(e) => setQ(e.target.value)} />
          <input className="input" placeholder="Sport (e.g. Football)" value={sport} onChange={(e) => setSport(e.target.value)} />
          <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <div className="flex gap-2 items-center sm:col-span-4">
            <input
              className="input w-28"
              type="number"
              min="1"
              max="10000"
              placeholder="Radius"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              disabled={!city}
              title={city ? undefined : "Enter a city first"}
            />
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(["km", "miles"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-3 py-2 transition ${unit === u ? "bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {UNIT_LABELS[u]}
                </button>
              ))}
            </div>
            {!city && radius && <span className="text-xs text-slate-500">Enter a city to use radius filter</span>}
          </div>
          {mode === "players" && (
            <label className="flex items-center gap-2 text-sm sm:col-span-4">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified only
            </label>
          )}
        </div>
      </div>

      {res.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {res.data?.length ? (
            res.data.map((item: any) =>
              mode === "opportunities" ? (
                <Link key={item.id} to={`/opportunities/${item.id}`} className="card card-body hover:shadow">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.org_name} · {item.city}, {item.country}</div>
                  <div className="mt-2 flex gap-2"><Badge color="blue">{item.type}</Badge><Badge>{item.sport}</Badge></div>
                </Link>
              ) : (
                <Link key={item.id} to={mode === "players" ? `/profile/${item.id}` : `/organizations/${item.id}`} className="card card-body hover:shadow">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{item.full_name ?? item.org_name}</div>
                    <VerifiedBadge verification={item.verification} />
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.city ?? ""}{item.city ? ", " : ""}{item.country ?? ""}
                  </div>
                  {item.athlete?.primary_sport && <div className="text-xs text-slate-600 mt-1">{item.athlete.primary_sport} · {item.athlete.position ?? "—"}</div>}
                </Link>
              )
            )
          ) : (
            <div className="card card-body text-sm text-slate-600">No results.</div>
          )}
        </div>
      )}
    </div>
  );
}
