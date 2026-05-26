import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, StatusPill, Spinner, EmptyState } from "../components/UI";
import type { Application, Opportunity, Post } from "../types";

export default function Dashboard() {
  const { user } = useAuthStore();
  const role = user?.role;

  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: async () => (await api.get<{ items: Post[] }>("/posts/feed", { params: { limit: 10 } })).data.items
  });
  const myApps = useQuery({
    queryKey: ["my-apps"],
    enabled: role === "athlete",
    queryFn: async () => (await api.get<{ items: Application[] }>("/applications/mine")).data.items
  });
  const opportunities = useQuery({
    queryKey: ["opp-recent"],
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", { params: { limit: 5, status: "open" } })).data.items
  });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.full_name?.split(" ")[0] ?? "there"}`} subtitle="Here's what's happening on Sportivox" />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="card card-body">
            <h2 className="text-lg font-semibold">Your feed</h2>
            <p className="text-sm text-slate-600 mb-3">Recent posts from you and people you follow.</p>
            {feed.isLoading ? (
              <Spinner />
            ) : feed.data && feed.data.length > 0 ? (
              <ul className="space-y-3">
                {feed.data.map((p) => (
                  <li key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/profile/${p.author_id}`} className="text-sm font-medium text-slate-800">
                        {p.author_name}
                      </Link>
                      <span className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{p.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing here yet" hint="Follow people, or post your first training log." action={<Link className="btn-primary" to="/feed">Open feed</Link>} />
            )}
          </div>

          {role === "athlete" && (
            <div className="card card-body">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Your applications</h2>
                <Link to="/applications" className="text-sm text-brand-700">View all</Link>
              </div>
              {myApps.data?.length ? (
                <ul className="divide-y">
                  {myApps.data.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <Link to={`/opportunities/${a.opportunity_id}`} className="font-medium text-slate-800">
                        {a.opportunity_title}
                      </Link>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No applications yet. Find an opportunity and apply.</p>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card card-body">
            <h3 className="text-base font-semibold">Open opportunities</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {opportunities.data?.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link to={`/opportunities/${o.id}`} className="block rounded-md p-2 hover:bg-slate-50">
                    <div className="font-medium text-slate-900">{o.title}</div>
                    <div className="text-xs text-slate-500">{o.org_name} · {o.city}, {o.country}</div>
                  </Link>
                </li>
              ))}
              {!opportunities.data?.length && <li className="text-slate-500">No opportunities right now.</li>}
            </ul>
          </div>

          {role === "athlete" && (
            <div className="card card-body">
              <h3 className="text-base font-semibold">AI Performance Tips</h3>
              <p className="text-sm text-slate-600">Get personalized improvement suggestions from your stats.</p>
              <Link to="/ai-tips" className="btn-primary mt-3 inline-flex">Get tips</Link>
            </div>
          )}

          {(role === "club" || role === "organizer") && (
            <div className="card card-body">
              <h3 className="text-base font-semibold">Post an opportunity</h3>
              <p className="text-sm text-slate-600">Trial, recruitment, tournament — get applicants in minutes.</p>
              <Link to="/opportunities/new" className="btn-primary mt-3 inline-flex">Post now</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
