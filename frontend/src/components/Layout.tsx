import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "../services";
import { useNotificationCount } from "../hooks";
import { Bell, Home, Search, Briefcase, FileText, MessageCircle, ShieldCheck, LogOut, User as UserIcon, Menu, X, Trophy, ChevronDown, Building2, Target, Activity } from "lucide-react";
import { useState, useEffect, useRef } from "react";

function GlobalSearch({ user, inputRef }: { user: any; inputRef: React.RefObject<HTMLInputElement> }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const isRecruiter = user.role === "club" || user.role === "scout" || user.role === "organizer" || user.role === "admin";

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && q.trim()) {
      navigate(isRecruiter ? `/search?q=${encodeURIComponent(q.trim())}` : `/opportunities?q=${encodeURIComponent(q.trim())}`);
      setQ(""); inputRef.current?.blur();
    }
    if (e.key === "Escape") { setQ(""); inputRef.current?.blur(); }
  }

  return (
    <div className="relative flex-1 max-w-xs hidden sm:block">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none" />
      <input ref={inputRef} className="input w-full pl-8 text-[12px]" style={{ height: 34 }}
        placeholder={isRecruiter ? "Search players, clubs… (⌘K)" : "Search opportunities, athletes… (⌘K)"}
        value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={handleKey} />
    </div>
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

export function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const qc = useQueryClient();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { count } = useNotificationCount(!!user);

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
    { to: "/blogs",        icon: <FileText className="h-4 w-4" />,      label: "Blogs" },
    { to: "/search",       icon: <Search className="h-4 w-4" />,        label: "Search" },
    { to: "/opportunities",icon: <Briefcase className="h-4 w-4" />,     label: "Opportunities" },
    { to: "/tournaments",  icon: <Trophy className="h-4 w-4" />,        label: "Tournaments" },
    { to: "/messages",     icon: <MessageCircle className="h-4 w-4" />, label: "Messages" },
    ...(user.role === "athlete" ? [{ to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "My Applications" }] : []),
    ...(user.role === "club" || user.role === "organizer" || user.role === "admin"
      ? [{ to: "/my-organizations", icon: <Building2 className="h-4 w-4" />, label: "Organizations" }]
      : [{ to: "/organizations", icon: <Building2 className="h-4 w-4" />, label: "Organizations" }]),
    ...(["organizer", "admin", "scorer"].includes(user.role)
      ? [{ to: "/scoring", icon: <Target className="h-4 w-4" />, label: "Scoring" }] : []),
    ...(user.role === "admin" ? [{ to: "/admin", icon: <ShieldCheck className="h-4 w-4" />, label: "Admin" }] : [])
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

          <GlobalSearch user={user} inputRef={searchInputRef} />

          <div className="flex items-center gap-2">
            <NavLink to="/notifications" className="relative rounded p-2 text-ink-70 hover:bg-fill">
              <Bell className="h-5 w-5" />
              {!!count.data && count.data > 0 && (
                <span className="font-mononum absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
                  {count.data}
                </span>
              )}
            </NavLink>
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
              {user.role === "athlete" ? (
                <Link to="/opportunities" className="btn-primary w-full text-center text-[11px] mb-3" onClick={() => setSidebarOpen(false)}>
                  Find a trial →
                </Link>
              ) : user.role === "club" || user.role === "organizer" ? (
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
          const isLiveScoring = location.pathname.includes("/score");
          return (
            <main ref={mainRef} className={`min-w-0 flex-1 relative ${
              isLiveScoring ? "overflow-hidden p-0" : "overflow-y-auto px-3 py-4 sm:px-6 sm:py-7"}`}>
              <Outlet />
            </main>
          );
        })()}
      </div>
    </div>
  );
}
