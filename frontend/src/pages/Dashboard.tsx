import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { userService } from "../services";
import { api } from "../api/client";
import { useFeed, useOpportunities, useMyApplications, useMyOpportunities } from "../hooks";
import { useAuthStore } from "../store/auth";
import { queryKeys } from "../hooks/queryKeys";
import { hasRole, isAdmin } from "../utils/roles";
import { StatusPill, Spinner, EmptyState, Avatar } from "../components/UI";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ChevronDown, ChevronUp, Search, Briefcase, ShieldCheck, Flag, Users } from "lucide-react";
import type { Application, Opportunity, Post, User } from "../models";

// ── Shared helpers ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours(); // uses browser's local time zone automatically
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="panel px-4 py-4 flex-shrink-0">
      <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint">{label}</div>
      <div className={`font-disp mt-1.5 text-3xl ${accent ? "text-brand-500" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold text-ink mb-3 flex items-center gap-2">{children}</h2>
  );
}

// ── Athlete Dashboard ───────────────────────────────────────────────────────

function ProfileCompletion({ user }: { user: User }) {
  const fields = [
    { label: "Avatar", done: !!user.profile_photo_url },
    { label: "Bio", done: !!user.bio },
    { label: "Sport", done: !!user.athlete?.primary_sport },
    { label: "Position", done: !!user.athlete?.position },
    { label: "Location", done: !!user.city },
  ];
  const completed = fields.filter((f) => f.done).length;
  const pct = Math.round((completed / fields.length) * 100);
  if (pct === 100) return null;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-ink">Complete your profile</span>
        <span className="text-[12px] font-mononum text-brand-500">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-fill overflow-hidden mb-3">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {fields.map((f) => (
          <span
            key={f.label}
            className={`text-[11px] px-2 py-0.5 rounded-full font-mononum ${
              f.done ? "bg-green-100 text-green-700" : "bg-fill text-ink-sub"
            }`}
          >
            {f.done ? "✓ " : ""}{f.label}
          </span>
        ))}
      </div>
      <Link to="/profile/edit" className="text-[12px] text-brand-500 hover:underline font-mononum">
        Edit profile →
      </Link>
    </div>
  );
}

function AITipsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel p-4">
      <button
        className="w-full flex items-center justify-between min-h-[44px]"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[13px] font-semibold text-ink">◆ AI Performance Tips</span>
        {open ? <ChevronUp className="h-4 w-4 text-ink-faint" /> : <ChevronDown className="h-4 w-4 text-ink-faint" />}
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-sm text-ink-sub leading-relaxed mb-3">
            Get personalised training recommendations based on your sport profile and activity.
          </p>
          <Link to="/ai-tips" className="btn-primary block w-full text-center min-h-[44px] flex items-center justify-center">
            Get tips →
          </Link>
          <div className="text-[10px] font-mononum text-ink-faint mt-2">Rate-limited · 20/day</div>
        </div>
      )}
    </div>
  );
}

function AthleteDashboard() {
  const { user, setUser } = useAuthStore();
  if (!user) return null;

  const sport = user.athlete?.primary_sport;
  const avail = user.athlete?.availability ?? "available";

  const { list: myApps } = useMyApplications();
  const { list: matchedOpps } = useOpportunities(
    sport ? { limit: 4, status: "open", sport } : { limit: 4, status: "open" }
  );

  const updateAvail = useMutation({
    mutationFn: (availability: string) => userService.updateAthleteProfile({ availability }),
    onSuccess: (updated) => setUser(updated),
  });

  const activeApps = (myApps.data ?? []).filter((a: Application) =>
    ["pending", "shortlisted", "selected"].includes(a.status)
  );
  const recentApps = (myApps.data ?? []).slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-brand-500 mb-1">Your Sportzicon desk</div>
        <h1 className="font-disp text-3xl sm:text-4xl text-ink">
          {getGreeting()}, {user.full_name?.split(" ")[0] ?? "there"}
        </h1>
        {user.verification?.status === "verified" && (
          <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-mononum text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            ✓ Verified athlete
          </span>
        )}
      </div>

      {/* Availability toggle */}
      <div className="panel p-4 flex items-center justify-between gap-3">
        <span className="text-sm text-ink-sub">Availability</span>
        <select
          className="input font-mononum text-[11px] min-h-[44px]"
          style={{ width: "auto", padding: "0 28px 0 10px" }}
          value={avail}
          onChange={(e) => updateAvail.mutate(e.target.value)}
        >
          <option value="open_to_offers">Open to offers</option>
          <option value="available">Available</option>
          <option value="not_available">Not available</option>
        </select>
      </div>

      {/* Profile completion */}
      <ProfileCompletion user={user} />

      {/* Quick stats — horizontal scroll on mobile */}
      <div>
        <SectionTitle>Your stats</SectionTitle>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3">
          <div className="flex-shrink-0 w-36 sm:w-auto">
            <StatCard label="Followers" value={user.follower_count ?? 0} />
          </div>
          <div className="flex-shrink-0 w-36 sm:w-auto">
            <StatCard label="Active apps" value={activeApps.length} accent />
          </div>
          <div className="flex-shrink-0 w-36 sm:w-auto">
            <StatCard label="Following" value={user.following_count ?? 0} />
          </div>
        </div>
      </div>

      {/* Find trials CTA */}
      <Link
        to="/opportunities"
        className="btn-primary block w-full text-center min-h-[44px] flex items-center justify-center text-sm"
      >
        Find Trials →
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          {/* Recent applications */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>Recent applications</SectionTitle>
              <Link to="/applications" className="text-[12px] text-brand-500 hover:underline font-mononum">
                View all →
              </Link>
            </div>
            {myApps.isLoading ? (
              <div className="panel p-6 flex justify-center"><Spinner className="text-brand-500" /></div>
            ) : recentApps.length > 0 ? (
              <ul className="panel divide-y divide-hairsoft">
                {recentApps.map((a: Application) => (
                  <li key={a.id} className="flex items-center gap-3 p-4 min-h-[64px]">
                    <Avatar name={a.opportunity_title} size={36} />
                    <Link to={`/opportunities/${a.opportunity_id}`} className="flex-1 text-sm font-semibold text-ink truncate">
                      {a.opportunity_title}
                    </Link>
                    <StatusPill status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No applications yet"
                hint="Apply to a trial or opportunity to get started."
                action={<Link className="btn-accent" to="/opportunities">Browse opportunities</Link>}
              />
            )}
          </div>

          {/* Matched opportunities */}
          {matchedOpps.data && matchedOpps.data.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Matched for you</SectionTitle>
                <Link to="/opportunities" className="text-[12px] text-brand-500 hover:underline font-mononum">
                  See all →
                </Link>
              </div>
              <ul className="panel divide-y divide-hairsoft">
                {matchedOpps.data.map((o: Opportunity) => {
                  const days = Math.ceil((new Date(o.application_deadline).getTime() - Date.now()) / 86400_000);
                  return (
                    <li key={o.id}>
                      <Link to={`/opportunities/${o.id}`} className="flex items-center gap-3 p-3.5 transition hover:bg-fill min-h-[64px]">
                        <Avatar name={o.org_name} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-[13.5px] font-semibold text-ink">{o.title}</div>
                          <div className="text-[11px] font-mononum text-ink-faint mt-0.5">{o.org_name} · {o.city}</div>
                        </div>
                        <span className={`font-mononum text-[10px] flex-shrink-0 ${days < 0 ? "text-ink-faint" : days <= 5 ? "text-red-500" : "text-ink-sub"}`}>
                          {days < 0 ? "closed" : `${days}d left`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <AITipsPanel />
          <div className="panel p-4">
            <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint mb-2">Profile</div>
            <Link to={`/profile/${user.id}`} className="flex items-center gap-3 min-h-[44px]">
              <Avatar name={user.full_name} src={user.profile_photo_url} size={40} />
              <div>
                <div className="text-sm font-semibold text-ink">{user.full_name}</div>
                <div className="text-[11px] font-mononum text-ink-faint capitalize">{user.role}</div>
              </div>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Club / Organizer Dashboard ──────────────────────────────────────────────

function ClubDashboard() {
  const { user } = useAuthStore();
  if (!user) return null;

  const openOpps = useMyOpportunities();
  const openCount = (openOpps.data ?? []).filter((o: Opportunity) => o.status === "open").length;

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-brand-500 mb-1">Club dashboard</div>
        <h1 className="font-disp text-3xl sm:text-4xl text-ink">
          Welcome, {user.full_name?.split(" ")[0] ?? "there"}
        </h1>
      </div>

      {/* Post new opportunity CTA */}
      <Link
        to="/opportunities/new"
        className="btn-accent block w-full text-center min-h-[44px] flex items-center justify-center text-sm"
      >
        + Post New Opportunity
      </Link>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active opps" value={openOpps.isLoading ? <Spinner className="h-4 w-4" /> : openCount} accent />
        <StatCard label="Organizations" value={<Link to="/my-organizations" className="text-brand-500 underline text-2xl">View</Link>} />
        <StatCard label="Search players" value={<Link to="/search" className="text-brand-500 underline text-2xl">Go</Link>} />
      </div>

      {/* Active opportunities list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Active opportunities</SectionTitle>
          <Link to="/opportunities" className="text-[12px] text-brand-500 hover:underline font-mononum">
            See all →
          </Link>
        </div>
        {openOpps.isLoading ? (
          <div className="panel p-6 flex justify-center"><Spinner className="text-brand-500" /></div>
        ) : openOpps.data && openOpps.data.filter((o: Opportunity) => o.status === "open").length > 0 ? (
          <ul className="panel divide-y divide-hairsoft">
            {openOpps.data.filter((o: Opportunity) => o.status === "open").slice(0, 5).map((o: Opportunity) => {
              const days = Math.ceil((new Date(o.application_deadline).getTime() - Date.now()) / 86400_000);
              return (
                <li key={o.id}>
                  <Link to={`/opportunities/${o.id}`} className="flex items-center gap-3 p-3.5 transition hover:bg-fill min-h-[64px]">
                    <Avatar name={o.org_name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{o.title}</div>
                      <div className="text-[11px] font-mononum text-ink-faint mt-0.5">
                        {o.org_name} · {o.sport}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`font-mononum text-[10px] block ${days < 0 ? "text-ink-faint" : days <= 5 ? "text-red-500" : "text-ink-sub"}`}>
                        {days < 0 ? "closed" : `${days}d left`}
                      </span>
                      <Link
                        to={`/opportunities/${o.id}/applicants`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-brand-500 font-mononum hover:underline mt-0.5 inline-block min-h-[44px] flex items-center"
                      >
                        Applicants →
                      </Link>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No active opportunities"
            hint="Post your first trial or recruitment opportunity."
            action={<Link className="btn-accent" to="/opportunities/new">Post now</Link>}
          />
        )}
      </div>

      {/* Quick actions */}
      <div className="panel p-4 space-y-2">
        <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint mb-3">Quick actions</div>
        <Link to="/search" className="flex items-center gap-3 py-2 min-h-[44px] text-sm text-ink hover:text-brand-500 transition">
          <Search className="h-4 w-4 text-ink-faint" /> Search athletes
        </Link>
        <Link to="/my-organizations" className="flex items-center gap-3 py-2 min-h-[44px] text-sm text-ink hover:text-brand-500 transition">
          <Briefcase className="h-4 w-4 text-ink-faint" /> Manage organizations
        </Link>
      </div>
    </div>
  );
}

// ── Scout Dashboard ─────────────────────────────────────────────────────────

function ScoutDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  if (!user) return null;

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-brand-500 mb-1">Scout dashboard</div>
        <h1 className="font-disp text-3xl sm:text-4xl text-ink">
          Good scouting, {user.full_name?.split(" ")[0] ?? "there"}
        </h1>
      </div>

      {/* Prominent search */}
      <div>
        <label className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint mb-2 block">
          Discover athletes
        </label>
        <div className="flex gap-2">
          <input
            className="input flex-1 min-h-[44px] text-sm"
            placeholder="Search by name, sport, position…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
            inputMode="search"
          />
          <button
            className="btn-primary min-h-[44px] px-4"
            onClick={() => { if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/search"
          className="panel p-4 flex flex-col items-center justify-center min-h-[80px] text-center hover:border-brand-500 transition"
        >
          <Search className="h-6 w-6 text-brand-500 mb-2" />
          <span className="text-sm font-semibold text-ink">Browse athletes</span>
        </Link>
        <Link
          to="/feed"
          className="panel p-4 flex flex-col items-center justify-center min-h-[80px] text-center hover:border-brand-500 transition"
        >
          <Briefcase className="h-6 w-6 text-brand-500 mb-2" />
          <span className="text-sm font-semibold text-ink">Activity feed</span>
        </Link>
      </div>

      {/* Discover CTA */}
      <Link
        to="/search"
        className="btn-accent block w-full text-center min-h-[44px] flex items-center justify-center text-sm"
      >
        Discover Athletes →
      </Link>

      <div className="panel p-4">
        <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint mb-3">Your profile</div>
        <Link to={`/profile/${user.id}`} className="flex items-center gap-3 min-h-[44px]">
          <Avatar name={user.full_name} src={user.profile_photo_url} size={40} />
          <div>
            <div className="text-sm font-semibold text-ink">{user.full_name}</div>
            <div className="text-[11px] font-mononum text-ink-faint capitalize">Scout · Sportzicon</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Admin Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard() {
  const { user } = useAuthStore();
  if (!user) return null;

  const analytics = useQuery({
    queryKey: queryKeys.adminAnalytics(),
    queryFn: async () => {
      const r = await api.get("/admin/analytics");
      return r.data as {
        total_users: number;
        new_today: number;
        pending_verifications: number;
        open_reports: number;
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const data = analytics.data;

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-brand-500 mb-1">Admin panel</div>
        <h1 className="font-disp text-3xl sm:text-4xl text-ink">
          Admin dashboard
        </h1>
      </div>

      {/* Stat cards — stacked on mobile */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total users" value={analytics.isLoading ? <Spinner className="h-4 w-4" /> : (data?.total_users ?? "—")} />
        <StatCard label="New today" value={analytics.isLoading ? <Spinner className="h-4 w-4" /> : (data?.new_today ?? "—")} accent />
        <div className="panel px-4 py-4">
          <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint">Pending verifs</div>
          <div className={`font-disp mt-1.5 text-3xl ${(data?.pending_verifications ?? 0) > 0 ? "text-orange-500" : "text-ink"}`}>
            {analytics.isLoading ? <Spinner className="h-4 w-4" /> : (data?.pending_verifications ?? "—")}
          </div>
          {(data?.pending_verifications ?? 0) > 0 && (
            <Link to="/admin/verifications" className="text-[11px] font-mononum text-brand-500 hover:underline mt-1 inline-block">
              Review →
            </Link>
          )}
        </div>
        <div className="panel px-4 py-4">
          <div className="text-[11px] font-mononum uppercase tracking-[0.06em] text-ink-faint">Open reports</div>
          <div className={`font-disp mt-1.5 text-3xl ${(data?.open_reports ?? 0) > 0 ? "text-red-500" : "text-ink"}`}>
            {analytics.isLoading ? <Spinner className="h-4 w-4" /> : (data?.open_reports ?? "—")}
          </div>
          {(data?.open_reports ?? 0) > 0 && (
            <Link to="/admin/reports" className="text-[11px] font-mononum text-brand-500 hover:underline mt-1 inline-block">
              Review →
            </Link>
          )}
        </div>
      </div>

      {/* Priority CTAs */}
      {(data?.pending_verifications ?? 0) > 0 && (
        <Link
          to="/admin/verifications"
          className="flex items-center justify-between panel p-4 min-h-[64px] hover:border-brand-500 transition"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-ink">{data!.pending_verifications} pending verification{data!.pending_verifications !== 1 ? "s" : ""}</div>
              <div className="text-[11px] text-ink-sub mt-0.5">Review organization documents</div>
            </div>
          </div>
          <span className="text-brand-500 text-sm font-mononum flex-shrink-0">Review →</span>
        </Link>
      )}
      {(data?.open_reports ?? 0) > 0 && (
        <Link
          to="/admin/reports"
          className="flex items-center justify-between panel p-4 min-h-[64px] hover:border-brand-500 transition"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-ink">{data!.open_reports} open report{data!.open_reports !== 1 ? "s" : ""}</div>
              <div className="text-[11px] text-ink-sub mt-0.5">Review flagged content</div>
            </div>
          </div>
          <span className="text-brand-500 text-sm font-mononum flex-shrink-0">Review →</span>
        </Link>
      )}

      {/* Quick links */}
      <div>
        <SectionTitle>Admin sections</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[
            { to: "/admin/users", icon: <Users className="h-5 w-5" />, label: "User management" },
            { to: "/admin/verifications", icon: <ShieldCheck className="h-5 w-5" />, label: "Verifications" },
            { to: "/admin/reports", icon: <Flag className="h-5 w-5" />, label: "Reports" },
            { to: "/admin/audit", icon: <Briefcase className="h-5 w-5" />, label: "Audit log" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="panel p-4 flex items-center gap-3 min-h-[64px] hover:border-brand-500 transition"
            >
              <span className="text-brand-500">{item.icon}</span>
              <span className="text-sm font-semibold text-ink">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore();
  if (!user) return null;

  if (isAdmin(user.role)) return <ErrorBoundary><AdminDashboard /></ErrorBoundary>;
  if (user.role === "scout") return <ErrorBoundary><ScoutDashboard /></ErrorBoundary>;
  if (hasRole(user.role, "club", "organizer")) return <ErrorBoundary><ClubDashboard /></ErrorBoundary>;
  return <ErrorBoundary><AthleteDashboard /></ErrorBoundary>;
}
