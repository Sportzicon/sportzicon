import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, StatusPill, Spinner, EmptyState, Kicker, SectionHead, Avatar } from "../components/UI";
import type { Application, Opportunity, Post } from "../types";

function Metric({ k, v, accent = false }: { k: string; v: React.ReactNode; accent?: boolean }) {
  return (
    <div className="panel px-4 py-4">
      <div className="lab">{k}</div>
      <div className={`font-disp mt-2 text-4xl ${accent ? "text-brand-500" : "text-ink"}`}>{v}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
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
  // Gap 9 — matched opportunities (filtered by athlete's sport)
  const sport = user?.athlete?.primary_sport;
  const matchedOpps = useQuery({
    queryKey: ["matched-opps", sport],
    enabled: role === "athlete",
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", {
      params: { limit: 4, status: "open", sport: sport || undefined }
    })).data.items
  });
  const opportunities = useQuery({
    queryKey: ["opp-recent"],
    queryFn: async () => (await api.get<{ items: Opportunity[] }>("/opportunities", { params: { limit: 5, status: "open" } })).data.items
  });

  // Gap 8 — availability dropdown mutation
  const updateAvail = useMutation({
    mutationFn: async (availability: string) => (await api.put("/users/me/athlete", { availability })).data.user,
    onSuccess: (updated) => { setUser(updated); qc.invalidateQueries({ queryKey: ["feed"] }); }
  });

  const activeApps = myApps.data?.filter((a) => ["pending", "shortlisted", "selected"].includes(a.status)) ?? [];
  const avail = user?.athlete?.availability ?? "available";

  return (
    <div className="space-y-6">
      {/* Gap 8 — availability in page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="lab text-brand-500">Your Sportivox desk</div>
          <h1 className="font-disp text-4xl mt-1">Good morning, {user?.full_name?.split(" ")[0] ?? "there"}</h1>
        </div>
        {role === "athlete" && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="lab">Availability</span>
            <select
              className="input font-mononum text-[11px]"
              style={{ width: "auto", height: 34, padding: "0 28px 0 10px" }}
              value={avail}
              onChange={(e) => updateAvail.mutate(e.target.value)}
            >
              <option value="open_to_offers">Open to offers</option>
              <option value="available">Available</option>
              <option value="not_available">Not available</option>
            </select>
          </div>
        )}
        {(role === "club" || role === "organizer") && (
          <div className="flex gap-2">
            <Link to="/search" className="btn-secondary">Search players</Link>
            <Link to="/opportunities/new" className="btn-accent">+ Post opportunity</Link>
          </div>
        )}
      </div>

      {/* metric ledger */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Metric k="Open opportunities" v={opportunities.data?.length ?? "—"} />
        {role === "athlete" ? (
          <>
            <Metric k="Active applications" v={activeApps.length} accent />
            <Metric k="Feed updates" v={feed.data?.length ?? "—"} />
            <Metric k="Profile strength" v="86%" />
          </>
        ) : (
          <>
            <Metric k="Feed updates" v={feed.data?.length ?? "—"} accent />
            <Metric k="Your role" v={<span className="text-2xl capitalize">{role}</span>} />
            <Metric k="Network" v="Live" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {/* feed */}
          <div>
            <SectionHead n="01" title="Your feed" sub="Recent posts from people you follow"
              right={<Link to="/feed" className="btn-secondary">Open feed →</Link>} />
            {feed.isLoading ? (
              <div className="panel p-6"><Spinner className="text-brand-500" /></div>
            ) : feed.data && feed.data.length > 0 ? (
              <ul className="panel divide-y divide-hairsoft">
                {feed.data.map((p) => (
                  <li key={p.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.author_name} size={36} />
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <Link to={`/profile/${p.author_id}`} className="text-sm font-semibold text-ink">{p.author_name}</Link>
                        <span className="lab">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-70 line-clamp-3">{p.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing here yet" hint="Follow people, or post your first training log."
                action={<Link className="btn-accent" to="/feed">Open feed</Link>} />
            )}
          </div>

          {/* Gap 9 — matched opportunities for athletes */}
          {role === "athlete" && (
            <div>
              <SectionHead n="02" title="Matched for you"
                sub={sport ? `Based on ${sport} · role · level` : "Based on your profile"}
                right={<Link to="/opportunities" className="btn-secondary">See all →</Link>} />
              {matchedOpps.isLoading ? (
                <div className="panel p-4 flex justify-center"><Spinner className="text-brand-500" /></div>
              ) : matchedOpps.data?.length ? (
                <ul className="panel divide-y divide-hairsoft">
                  {matchedOpps.data.map((o) => {
                    const days = Math.ceil((new Date(o.application_deadline).getTime() - Date.now()) / 86400_000);
                    const urgent = days >= 0 && days <= 5;
                    return (
                      <li key={o.id}>
                        <Link to={`/opportunities/${o.id}`}
                          className="flex items-center gap-3 p-3.5 transition hover:bg-fill">
                          <Avatar name={o.org_name} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-[13.5px] font-semibold text-ink">{o.title}</div>
                            <div className="lab mt-1">{o.org_name} · {o.city}</div>
                          </div>
                          <span className="font-mononum text-[10px] flex-shrink-0"
                            style={{ color: urgent ? "#FA4D14" : "#9A9286" }}>
                            {days < 0 ? "closed" : `${days}d left`}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title="No matches yet" hint="Complete your sport profile to get matched." />
              )}
            </div>
          )}

          {/* athlete applications */}
          {role === "athlete" && (
            <div>
              <SectionHead n="03" title="Your applications" sub={`${activeApps.length} active`}
                right={<Link to="/applications" className="btn-secondary">View tracker →</Link>} />
              {myApps.data?.length ? (
                <ul className="panel divide-y divide-hairsoft">
                  {myApps.data.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 p-4">
                      <Avatar name={a.opportunity_title} size={36} />
                      <Link to={`/opportunities/${a.opportunity_id}`}
                        className="flex-1 text-sm font-semibold text-ink">{a.opportunity_title}</Link>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No applications yet" hint="Find an opportunity and apply to get started."
                  action={<Link className="btn-accent" to="/opportunities">Browse opportunities</Link>} />
              )}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div>
            <SectionHead title="Open opportunities" />
            <ul className="panel divide-y divide-hairsoft">
              {opportunities.data?.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link to={`/opportunities/${o.id}`}
                    className="flex items-center gap-3 p-3.5 transition hover:bg-fill">
                    <Avatar name={o.org_name} size={34} />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{o.title}</div>
                      <div className="lab mt-1">{o.org_name} · {o.city}</div>
                    </div>
                  </Link>
                </li>
              ))}
              {!opportunities.data?.length && <li className="lab p-4">No opportunities right now.</li>}
            </ul>
          </div>

          {role === "athlete" && (
            <div className="panel p-5">
              <Kicker>AI performance tips</Kicker>
              <p className="mt-3 text-sm leading-snug text-ink-sub">
                Get personalised training recommendations from your latest stats.
              </p>
              <Link to="/ai-tips" className="btn-primary mt-3.5 block w-full text-center">◆ Get tips</Link>
              <div className="lab mt-2 text-ink-faint text-[10px]">Rate-limited · 20 / day</div>
            </div>
          )}

          {(role === "club" || role === "organizer") && (
            <div className="panel p-5">
              <Kicker>Post an opportunity</Kicker>
              <p className="mt-3 text-sm leading-snug text-ink-sub">
                Trial, recruitment, tournament — get applicants in minutes.
              </p>
              <Link to="/opportunities/new" className="btn-accent mt-3.5 block w-full text-center">+ Post now</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
