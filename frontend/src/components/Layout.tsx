import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAuthStore } from "../store/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services";
import { api } from "../api/client";
import { queryKeys } from "../hooks/queryKeys";
import { useNotificationCount, useNotifications } from "../hooks";
import { useNotificationStore } from "../store/notifications";
import { hasRole, isAdmin } from "../utils/roles";
import {
  Bell, Home, Search, Briefcase, FileText, MessageCircle, LogOut,
  User as UserIcon, Menu, X, Trophy, ChevronDown, Building2, Target, Activity,
  Video, Plus, Flag, Users,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { Notification } from "../models";
import type { User } from "../types";

function GlobalSearch({ user, inputRef, mobileOpen, onMobileClose }: {
  user: User;
  inputRef: React.RefObject<HTMLInputElement>;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const isRecruiter = hasRole(user.role, "club", "scout", "organizer");

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && q.trim()) {
      navigate(isRecruiter ? `/search?q=${encodeURIComponent(q.trim())}` : `/opportunities?q=${encodeURIComponent(q.trim())}`);
      setQ(""); inputRef.current?.blur(); onMobileClose();
    }
    if (e.key === "Escape") { setQ(""); inputRef.current?.blur(); onMobileClose(); }
  }

  return (
    <>
      {/* Desktop search bar */}
      <div className="relative flex-1 max-w-xs hidden sm:block">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none" />
        <input ref={inputRef} className="input w-full pl-8 text-[12px]" style={{ height: 34 }}
          placeholder={isRecruiter ? "Search players, clubs… (⌘K)" : "Search opportunities… (⌘K)"}
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={handleKey} />
      </div>

      {/* Mobile expanded search overlay */}
      {mobileOpen && (
        <div className="absolute inset-0 z-50 flex items-center bg-panel px-3 gap-2 sm:hidden">
          <Search className="h-4 w-4 text-ink-faint flex-shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-ink-faint min-h-[44px]"
            placeholder={isRecruiter ? "Search players, clubs…" : "Search opportunities…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            className="p-2 min-h-[44px] flex items-center text-ink-sub"
            onClick={() => { setQ(""); onMobileClose(); }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}

function NavItem({ to, icon, label, onClick, isCollapsed, badge }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void; isCollapsed?: boolean; badge?: number }) {
  return (
    <NavLink to={to} onClick={onClick} title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded px-3 py-2.5 font-mononum text-[12px] tracking-[0.04em] transition ${
          isActive ? "bg-ink text-paper" : "text-ink-70 hover:bg-fill"}`}>
      {({ isActive }: { isActive: boolean }) => (
        <>
          <span className={`relative w-4 flex-shrink-0 text-center ${isActive ? "text-brand-500" : "text-ink-faint"}`}>
            {icon}
            {badge != null && badge > 0 && isCollapsed && (
              <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center px-0.5">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </span>
          {!isCollapsed && (
            <span className="flex-1 flex items-center gap-2 truncate">
              <span className="truncate">{label}</span>
              {badge != null && badge > 0 && (
                <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationDropdown({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { list, markAllRead, markOneRead } = useNotifications();
  const allItems: Notification[] = list.data?.pages.flatMap((p) => p.data) ?? [];
  const unread = allItems.filter((n) => !n.read).length;

  // Auto-mark all read when dropdown opens
  useEffect(() => {
    if (unread > 0) markAllRead.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleItem = (n: Notification) => {
    if (!n.read) markOneRead.mutate(n.id);
    if (n.link) onNavigate(n.link);
    onClose();
  };

  return (
    <div className="absolute right-0 mt-1 w-80 panel shadow-pop z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairsoft">
        <span className="text-[13px] font-semibold text-ink">Notifications</span>
        {unread > 0 && (
          <button
            className="text-[11px] text-brand-500 hover:underline font-mononum"
            onClick={() => { markAllRead.mutate(); }}
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-hairsoft">
        {list.isLoading ? (
          <div className="py-8 flex justify-center text-ink-sub text-sm">Loading…</div>
        ) : allItems.length === 0 ? (
          <div className="py-8 text-center text-ink-sub text-sm">All caught up!</div>
        ) : (
          allItems.slice(0, 15).map((n) => (
            <button
              key={n.id}
              onClick={() => handleItem(n)}
              className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-fill/60 transition min-h-[64px] items-start
                ${!n.read ? "border-l-2 border-brand-500 bg-fill/20" : "border-l-2 border-transparent"}`}
            >
              {n.actor?.profile_photo_url ? (
                <img src={n.actor.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-fill border border-hair flex items-center justify-center text-[11px] font-semibold text-ink-70 flex-shrink-0">
                  {n.actor?.full_name ? n.actor.full_name[0].toUpperCase() : "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-[12.5px] leading-snug line-clamp-1 ${!n.read ? "font-semibold text-ink" : "text-ink-70"}`}>
                  {n.title}
                </div>
                {n.body && (
                  <div className="text-[11.5px] text-ink-sub mt-0.5 line-clamp-2 leading-snug">{n.body}</div>
                )}
                <div className="text-[10px] text-ink-faint mt-0.5 font-mononum">{relativeTime(n.created_at)}</div>
              </div>
              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />}
            </button>
          ))
        )}
      </div>
      <div className="border-t border-hairsoft px-4 py-2.5">
        <button
          className="w-full text-center text-[12px] text-brand-500 hover:underline font-mononum"
          onClick={() => { onNavigate("/notifications"); onClose(); }}
        >
          View all notifications →
        </button>
      </div>
    </div>
  );
}

/** Role-based bottom nav items (mobile only, 5 per role). */
function getMobileNavItems(user: { id: string; role: string }) {
  const profileTo = `/profile/${user.id}`;
  const base = [
    { to: "/dashboard",   icon: <Home className="h-5 w-5" />,          label: "Home" },
  ];

  if (user.role === "admin") {
    return [
      { to: "/admin",         icon: <Home className="h-5 w-5" />,          label: "Home" },
      { to: "/admin/users",   icon: <Users className="h-5 w-5" />,         label: "Users" },
      { to: "/admin/reports", icon: <Flag className="h-5 w-5" />,          label: "Reports" },
      { to: "/messages",      icon: <MessageCircle className="h-5 w-5" />, label: "Messages" },
      { to: profileTo,        icon: <UserIcon className="h-5 w-5" />,      label: "Profile" },
    ];
  }
  if (user.role === "club") {
    return [
      ...base,
      { to: "/opportunities/new",  icon: <Plus className="h-5 w-5" />,         label: "Post Opp" },
      { to: "/my-organizations",   icon: <Briefcase className="h-5 w-5" />,    label: "Applications" },
      { to: "/messages",           icon: <MessageCircle className="h-5 w-5" />,label: "Messages" },
      { to: profileTo,             icon: <UserIcon className="h-5 w-5" />,     label: "Profile" },
    ];
  }
  if (user.role === "scout") {
    return [
      ...base,
      { to: "/search", icon: <Search className="h-5 w-5" />,           label: "Search" },
      { to: "/feed",   icon: <FileText className="h-5 w-5" />,         label: "Feed" },
      { to: "/messages", icon: <MessageCircle className="h-5 w-5" />,  label: "Messages" },
      { to: profileTo,  icon: <UserIcon className="h-5 w-5" />,        label: "Profile" },
    ];
  }
  if (user.role === "organizer") {
    return [
      ...base,
      { to: "/opportunities/new", icon: <Plus className="h-5 w-5" />,         label: "Post Opp" },
      { to: "/tournaments",       icon: <Trophy className="h-5 w-5" />,       label: "Tournaments" },
      { to: "/messages",          icon: <MessageCircle className="h-5 w-5" />,label: "Messages" },
      { to: profileTo,            icon: <UserIcon className="h-5 w-5" />,     label: "Profile" },
    ];
  }
  // athlete (default)
  return [
    ...base,
    { to: "/opportunities", icon: <Briefcase className="h-5 w-5" />,    label: "Trials" },
    { to: "/feed",          icon: <FileText className="h-5 w-5" />,     label: "Feed" },
    { to: "/messages",      icon: <MessageCircle className="h-5 w-5" />,label: "Messages" },
    { to: profileTo,        icon: <UserIcon className="h-5 w-5" />,     label: "Profile" },
  ];
}

export function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const qc = useQueryClient();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useNotificationCount(!!user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const pendingVerifCount = useQuery({
    queryKey: queryKeys.adminAnalytics(),
    queryFn: async () => {
      const r = await api.get("/admin/analytics");
      return (r.data.pending_verifications as number) ?? 0;
    },
    enabled: isAdmin(user?.role ?? ""),
    staleTime: 60_000,
    refetchInterval: 120_000
  });

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node))
        setProfileMenuOpen(false);
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node))
        setNotifDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!user) return <Outlet />;

  const logout = async () => {
    try { await authService.logout(useAuthStore.getState().refreshToken ?? ""); } catch { /* ignore */ }
    clear(); qc.clear(); navigate("/login", { replace: true });
  };

  const navItems = [
    { to: isAdmin(user.role) ? "/admin" : "/dashboard", icon: <Home className="h-4 w-4" />, label: "Dashboard" },
    { to: "/live-scores",  icon: <Activity className="h-4 w-4" />,      label: "Live Scores" },
    { to: "/feed",         icon: <FileText className="h-4 w-4" />,      label: "Feed" },
    { to: "/reels",        icon: <Video className="h-4 w-4" />,         label: "Reels" },
    { to: "/blogs",        icon: <FileText className="h-4 w-4" />,      label: "Blogs" },
    { to: "/search",       icon: <Search className="h-4 w-4" />,        label: "Search" },
    { to: "/opportunities",icon: <Briefcase className="h-4 w-4" />,     label: "Opportunities" },
    { to: "/tournaments",  icon: <Trophy className="h-4 w-4" />,        label: "Tournaments" },
    { to: "/messages",     icon: <MessageCircle className="h-4 w-4" />, label: "Messages" },
    ...(user.role === "athlete" ? [{ to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "My Applications" }] : []),
    ...(hasRole(user.role, "club", "organizer")
      ? [{ to: "/my-organizations", icon: <Building2 className="h-4 w-4" />, label: "Organizations" }]
      : [{ to: "/organizations", icon: <Building2 className="h-4 w-4" />, label: "Organizations" }]),
    ...(hasRole(user.role, "organizer", "scorer")
      ? [{ to: "/scoring", icon: <Target className="h-4 w-4" />, label: "Scoring" }] : [])
  ];

  const mobileNavItems = getMobileNavItems(user);

  const isLiveScoring = /^\/scoring\/matches\/[^/]+\/score(\/|$)/.test(location.pathname);

  return (
    <div className="flex h-screen flex-col bg-paper">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 sticky top-0 z-40 border-b border-hair bg-panel" style={{ height: 56 }}>
        <div className="flex items-center justify-between gap-4 px-4 h-full relative">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden rounded p-2 text-ink-70 hover:bg-fill min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link to="/dashboard" aria-label="Sportzicon" className="flex items-center flex-shrink-0">
            <div style={{ width: 140, height: 44, backgroundImage: 'url(/logo.png)', backgroundSize: 'auto 425%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', flexShrink: 0 }} />
            <span className="lab hidden sm:inline" style={{ fontSize: 8, marginTop: 39, marginLeft: -59, letterSpacing: '0.12em' }}>EST. 2026</span>
          </Link>

          {/* Desktop search (hidden on mobile) */}
          <div className="hidden sm:flex flex-1 max-w-xs">
            <GlobalSearch
              user={user}
              inputRef={searchInputRef}
              mobileOpen={false}
              onMobileClose={() => {}}
            />
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1">
            {/* Mobile search icon */}
            {!mobileSearchOpen && (
              <button
                className="sm:hidden rounded p-2 text-ink-70 hover:bg-fill min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Search"
                onClick={() => setMobileSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            {/* Mobile search overlay */}
            {mobileSearchOpen && (
              <div className="absolute inset-0 z-50 flex items-center bg-panel px-3 gap-2 sm:hidden">
                <Search className="h-4 w-4 text-ink-faint flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-ink-faint min-h-[44px]"
                  placeholder={hasRole(user.role, "club", "scout", "organizer") ? "Search players, clubs…" : "Search opportunities…"}
                  onKeyDown={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    if (e.key === "Enter" && val.trim()) {
                      navigate(hasRole(user.role, "club", "scout", "organizer")
                        ? `/search?q=${encodeURIComponent(val.trim())}`
                        : `/opportunities?q=${encodeURIComponent(val.trim())}`);
                      setMobileSearchOpen(false);
                    }
                    if (e.key === "Escape") setMobileSearchOpen(false);
                  }}
                />
                <button
                  className="p-2 min-h-[44px] flex items-center text-ink-sub"
                  onClick={() => setMobileSearchOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Notification bell */}
            <div ref={notifDropdownRef} className="relative">
              <button
                className="relative rounded p-2 text-ink-70 hover:bg-fill min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Notifications"
                onClick={() => {
                  if (!isDesktop) {
                    navigate("/notifications");
                  } else {
                    setNotifDropdownOpen((o) => !o);
                  }
                }}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="font-mononum absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {isDesktop && notifDropdownOpen && (
                <NotificationDropdown
                  onClose={() => setNotifDropdownOpen(false)}
                  onNavigate={navigate}
                />
              )}
            </div>

            {/* Profile menu (all screen sizes) */}
            <div ref={profileMenuRef} className="relative">
              <button onClick={() => setProfileMenuOpen((o) => !o)} className="btn-ghost !px-2">
                {user.profile_photo_url ? (
                  <img src={user.profile_photo_url} alt={user.full_name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0">
                    {user.full_name?.[0]?.toUpperCase() ?? <UserIcon className="h-4 w-4" />}
                  </div>
                )}
                <span className="hidden sm:inline normal-case tracking-normal">{user.full_name}</span>
                <ChevronDown className="h-3 w-3 hidden sm:block" />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-1 panel shadow-pop z-50 min-w-[160px]">
                  <NavLink to={`/profile/${user.id}`} onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                    <UserIcon className="h-3.5 w-3.5" /> View profile
                  </NavLink>
                  <button onClick={() => { setProfileMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                    <LogOut className="h-3.5 w-3.5" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Desktop sidebar (lg+ only) ──────────────────────────────────── */}
        <aside
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
          className="hidden lg:flex h-full shrink-0 overflow-x-hidden border-r border-hair bg-panel transition-all duration-200 flex-col z-20"
          style={{ width: sidebarHovered ? 240 : 64, overflowY: sidebarHovered ? "auto" : "hidden" }}
        >
          <nav className="flex flex-col h-full">
            <div className="space-y-0.5 p-3 flex-1">
              {navItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isCollapsed={!sidebarHovered}
                  badge={"badge" in item ? (item as any).badge : undefined}
                />
              ))}
            </div>
          </nav>
        </aside>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <main
          ref={mainRef}
          className={`min-w-0 flex-1 relative ${
            isLiveScoring
              ? "overflow-hidden p-0"
              : "overflow-y-auto px-3 py-4 sm:px-6 sm:py-7 pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-7"
          }`}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Mobile full-menu drawer (< lg only) ─────────────────────────── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Slide-in panel */}
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-panel border-r border-hair flex flex-col shadow-xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 border-b border-hair" style={{ height: 56 }}>
              <div style={{ width: 140, height: 44, backgroundImage: 'url(/logo.png)', backgroundSize: 'auto 450%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', flexShrink: 0 }} />
              <span className="lab hidden sm:inline" style={{ fontSize: 9, marginTop: -4, marginLeft: 86, letterSpacing: '0.12em' }}>EST. 2026</span>
              <button
                className="rounded p-2 text-ink-70 hover:bg-fill min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {navItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isCollapsed={false}
                  badge={"badge" in item ? (item as any).badge : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
            </nav>
            {/* User info + logout at bottom */}
            <div className="p-3 border-t border-hairsoft">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-fill border border-hair flex items-center justify-center text-[11px] font-semibold text-ink flex-shrink-0">
                  {user.full_name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink truncate">{user.full_name}</div>
                  <div className="text-[11px] text-ink-sub capitalize">{user.role}</div>
                </div>
              </div>
              <button
                onClick={() => { setMobileMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 rounded min-h-[44px]"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile bottom navigation (< lg only) ────────────────────────── */}
      {!isLiveScoring && (
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-panel border-t border-hair flex"
          style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "calc(56px + env(safe-area-inset-bottom))" }}
        >
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] transition-colors ${
                  isActive ? "text-brand-500" : "text-ink-faint"
                }`
              }
            >
              {item.icon}
              <span className="text-[10px] font-mononum leading-none">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
