import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { userService } from "../services";
import { useFeed, useOpportunities, useMyApplications } from "../hooks";
import { useAuthStore } from "../store/auth";
import { StatusPill, Spinner, EmptyState, Kicker, SectionHead, Avatar } from "../components/UI";
import type { Application, Opportunity, Post } from "../models";

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
  const role = user?.role;

  const sport = user?.athlete?.primary_sport;
  const { feedQuery, posts: feedPosts } = useFeed();
  const { list: myApps } = useMyApplications();
  const { list: matchedOpps } = useOpportunities(role === "athlete" ? { limit: 4, status: "open", sport: sport || undefined } : {});
  const { list: opportunities } = useOpportunities({ limit: 5, status: "open" });

  const updateAvail = useMutation({
    mutationFn: (availability: string) => userService.updateAthleteProfile({ availability }),
    onSuccess: (updated) => { setUser(updated); },
  });

  const activeApps = myApps.data?.filter((a: Application) => ["pending", "shortlisted", "selected"].includes(a.status)) ?? [];
  const avail = user?.athlete?.availability ?? "available";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="lab text-brand-500">Your Sportzicon desk</div>
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
            <Metric k="Feed updates" v={feedPosts.length > 0 ? feedPosts.length : "—"} />
            <Metric k="Profile strength" v="86%" />
          </>
        ) : (
          <>
            <Metric k="Feed updates" v={feedPosts.length > 0 ? feedPosts.length : "—"} accent />
            <Metric k="Your role" v={<span className="text-2xl capitalize">{role}</span>} />
            <Metric k="Network" v="Live" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-6">
          {/* feed */}
          <div>
            <SectionHead n="01" title="Your feed" sub="Recent posts from people you follow"
              right={<Link to="/feed" className="btn-secondary">Open feed →</Link>} />
            {feedQuery.isLoading ? (
              <div className="panel p-6"><Spinner className="text-brand-500" /></div>
            ) : feedPosts.length > 0 ? (
              <ul className="panel divide-y divide-hairsoft">
                {feedPosts.slice(0, 10).map((p: Post) => (
                  <li key={p.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.author_name} src={p.author?.profile_photo_url} size={36} />
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

          {role === "athlete" && (
            <div>
              <SectionHead n="02" title="Matched for you"
                sub={sport ? `Based on ${sport} · role · level` : "Based on your profile"}
                right={<Link to="/opportunities" className="btn-secondary">See all →</Link>} />
              {matchedOpps.isLoading ? (
                <div className="panel p-4 flex justify-center"><Spinner className="text-brand-500" /></div>
              ) : matchedOpps.data?.length ? (
                <ul className="panel divide-y divide-hairsoft">
                  {matchedOpps.data.map((o: Opportunity) => {
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

          {role === "athlete" && (
            <div>
              <SectionHead n="03" title="Your applications" sub={`${activeApps.length} active`}
                right={<Link to="/applications" className="btn-secondary">View tracker →</Link>} />
              {myApps.data?.length ? (
                <ul className="panel divide-y divide-hairsoft">
                  {myApps.data.slice(0, 5).map((a: Application) => (
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
              {opportunities.data?.slice(0, 5).map((o: Opportunity) => (
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
