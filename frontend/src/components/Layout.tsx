import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "../services";
import { useNotificationCount, useNotifications } from "../hooks";
import { useNotificationStore } from "../store/notifications";
import { hasRole, isAdmin } from "../utils/roles";
import { Bell, Home, Search, Briefcase, FileText, MessageCircle, ShieldCheck, LogOut, User as UserIcon, Menu, X, Trophy, ChevronDown, Building2, Target, Activity, Video } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { Notification } from "../models";

function GlobalSearch({ user, inputRef, mobileOpen, onMobileClose }: {
  user: any;
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

function NavItem({ to, icon, label, onClick, isCollapsed }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void; isCollapsed?: boolean }) {
  return (
    <NavLink to={to} onClick={onClick} title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded px-3 py-2.5 font-mononum text-[12px] tracking-[0.04em] transition ${
          isActive ? "bg-ink text-paper" : "text-ink-70 hover:bg-fill"}`}>
      {({ isActive }: { isActive: boolean }) => (
        <>
          <span className={`w-4 flex-shrink-0 text-center ${isActive ? "text-brand-500" : "text-ink-faint"}`}>{icon}</span>
          {!isCollapsed && <span className="truncate">{label}</span>}
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

export function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const qc = useQueryClient();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useNotificationCount(!!user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setSidebarOpen(true);
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
    { to: "/dashboard",    icon: <Home className="h-4 w-4" />,          label: "Dashboard" },
    { to: "/live-scores",  icon: <Activity className="h-4 w-4" />,      label: "Live Scores" },
    { to: "/feed",         icon: <FileText className="h-4 w-4" />,      label: "Feed" },
    { to: "/reels",        icon: <Video className="h-4 w-4" />,         label: "Reels" },
    { to: "/blogs",        icon: <FileText className="h-4 w-4" />,      label: "Blogs" },
    { to: "/search",       icon: <Search className="h-4 w-4" />,        label: "Search" },
    { to: "/opportunities",icon: <Briefcase className="h-4 w-4" />,     label: "Opportunities" },
    { to: "/tournaments",  icon: <Trophy className="h-4 w-4" />,        label: "Tournaments" },
    { to: "/messages",     icon: <MessageCircle className="h-4 w-4" />, label: "Messages" },
    ...(hasRole(user.role, "athlete") ? [{ to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "My Applications" }] : []),
    ...(hasRole(user.role, "club", "organizer")
      ? [{ to: "/my-organizations", icon: <Building2 className="h-4 w-4" />, label: "Organizations" }]
      : [{ to: "/organizations", icon: <Building2 className="h-4 w-4" />, label: "Organizations" }]),
    ...(hasRole(user.role, "organizer", "scorer")
      ? [{ to: "/scoring", icon: <Target className="h-4 w-4" />, label: "Scoring" }] : []),
    ...(isAdmin(user.role) ? [{ to: "/admin", icon: <ShieldCheck className="h-4 w-4" />, label: "Admin" }] : [])
  ];

  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="shrink-0 sticky top-0 z-40 border-b border-hair bg-panel">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded p-2 transition hover:bg-fill lg:hidden" aria-label="Toggle sidebar">
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/dashboard" aria-label="Sportzicon" className="flex flex-col items-start">
              <div style={{ width: 155, height: 48, backgroundImage: 'url(/logo.png)', backgroundSize: 'auto 450%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', flexShrink: 0 }} />
              <span className="lab hidden sm:inline" style={{ fontSize: 9, marginTop: -4, marginLeft: 86, letterSpacing: '0.12em' }}>EST. 2026</span>
            </Link>
          </div>

          <GlobalSearch
            user={user}
            inputRef={searchInputRef}
            mobileOpen={mobileSearchOpen}
            onMobileClose={() => setMobileSearchOpen(false)}
          />

          <div className="flex items-center gap-2">
            {/* Mobile search icon — visible only when overlay is closed */}
            {!mobileSearchOpen && (
              <button
                className="sm:hidden rounded p-2 text-ink-70 hover:bg-fill min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Search"
                onClick={() => setMobileSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </button>
            )}
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
            <div ref={profileMenuRef} className="relative">
              <button onClick={() => setProfileMenuOpen((o) => !o)} className="btn-ghost">
                <UserIcon className="h-4 w-4" />
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
        {/* Mobile backdrop — tap to close sidebar */}
        {!isDesktop && sidebarOpen && (
          <div
            className="fixed inset-0 z-[19] bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside onMouseEnter={() => setSidebarHovered(true)} onMouseLeave={() => setSidebarHovered(false)}
          className="h-full shrink-0 overflow-y-auto overflow-x-hidden border-r border-hair bg-panel transition-all duration-200 flex flex-col z-20"
          style={{ width: isDesktop ? (sidebarHovered ? 240 : 64) : (sidebarOpen ? 240 : 0) }}>
          <nav className="flex flex-col h-full">
            <div className="space-y-0.5 p-3 flex-1">
              {navItems.map((item) => (
                <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label}
                  isCollapsed={isDesktop ? !sidebarHovered : !sidebarOpen}
                  onClick={() => { if (!isDesktop) setSidebarOpen(false); }} />
              ))}
            </div>
            <div className={`p-3 border-t border-hairsoft transition-all ${isDesktop && !sidebarHovered ? "opacity-0 invisible" : "opacity-100 visible"}`}>
              {hasRole(user.role, "athlete") ? (
                <Link to="/opportunities" className="btn-primary w-full text-center text-[11px] mb-3" onClick={() => setSidebarOpen(false)}>
                  Find a trial →
                </Link>
              ) : hasRole(user.role, "club", "organizer") ? (
                <Link to="/opportunities/new" className="btn-primary w-full text-center text-[11px] mb-3" onClick={() => setSidebarOpen(false)}>
                  + Post opportunity
                </Link>
              ) : null}
              <div className="lab mt-2 text-[10px] leading-relaxed text-ink-faint">
                <div className="font-semibold text-ink">{user.full_name}</div>
                <div className="mt-1"><span className="capitalize">{user.role}</span> · Sportzicon</div>
              </div>
            </div>
          </nav>
        </aside>

        {(() => {
          const isLiveScoring = /^\/scoring\/matches\/[^/]+\/score(\/|$)/.test(location.pathname);
          return (
            <main
              ref={mainRef}
              onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchStartXRef.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStartXRef.current;
                if (!isDesktop) {
                  if (dx > 60 && touchStartXRef.current < 40) setSidebarOpen(true);
                  if (dx < -60 && sidebarOpen) setSidebarOpen(false);
                }
                touchStartXRef.current = null;
              }}
              className={`min-w-0 flex-1 relative ${
                isLiveScoring ? "overflow-hidden p-0" : "overflow-y-auto px-3 py-4 sm:px-6 sm:py-7"}`}>
              <Outlet />
            </main>
          );
        })()}
      </div>
    </div>
  );
}
