import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Bell, Home, Search, Briefcase, FileText, Film, MessageCircle, ShieldCheck, LogOut, User as UserIcon, Menu, X, Trophy } from "lucide-react";
import { useState, useEffect } from "react";

// ============================================================================
// App chrome — "Editorial Workstation" skin.
// Logic is unchanged (auth gate, notif-count query, role-based nav, logout,
// responsive sidebar). Only presentation is restyled.
// ============================================================================

function NavItem({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded px-3 py-2.5 font-mononum text-[12px] tracking-[0.04em] transition ${
          isActive ? "bg-ink text-paper" : "text-ink-70 hover:bg-fill"
        }`
      }
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          <span className={`w-4 text-center ${isActive ? "text-brand-500" : "text-ink-faint"}`}>{icon}</span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { data: count } = useQuery({
    queryKey: ["notif-count"],
    queryFn: async () => (await api.get("/notifications/count")).data.unread as number,
    refetchInterval: 30_000,
    enabled: !!user
  });

  if (!user) return <Outlet />;

  const logout = async () => {
    try {
      await api.post("/auth/logout", { refresh_token: useAuthStore.getState().refreshToken });
    } catch {
      /* ignore */
    }
    clear();
    navigate("/login", { replace: true });
  };

  const navItems = [
    { to: "/dashboard", icon: <Home className="h-4 w-4" />, label: "Dashboard" },
    { to: "/feed", icon: <FileText className="h-4 w-4" />, label: "Feed" },
    { to: "/reels", icon: <Film className="h-4 w-4" />, label: "Reels" },
    { to: "/blogs", icon: <FileText className="h-4 w-4" />, label: "Blogs" },
    { to: "/search", icon: <Search className="h-4 w-4" />, label: "Search" },
    { to: "/opportunities", icon: <Briefcase className="h-4 w-4" />, label: "Opportunities" },
    { to: "/tournaments", icon: <Trophy className="h-4 w-4" />, label: "Tournaments" },
    { to: "/messages", icon: <MessageCircle className="h-4 w-4" />, label: "Messages" },
    ...(user.role === "athlete" ? [{ to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "My Applications" }] : []),
    ...(user.role === "club" || user.role === "organizer" ? [{ to: "/my-organizations", icon: <Briefcase className="h-4 w-4" />, label: "My Organizations" }] : []),
    ...(user.role === "admin" ? [{ to: "/admin", icon: <ShieldCheck className="h-4 w-4" />, label: "Admin" }] : [])
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-hair bg-panel">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded p-2 transition hover:bg-fill lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-500 font-disp text-lg text-white">S</span>
              <span className="font-disp text-xl tracking-[0.02em]">Sportivox</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/notifications" className="relative rounded p-2 text-ink-70 hover:bg-fill">
              <Bell className="h-5 w-5" />
              {!!count && count > 0 && (
                <span className="font-mononum absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
                  {count}
                </span>
              )}
            </NavLink>
            <NavLink to={`/profile/${user.id}`} className="btn-ghost">
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline normal-case tracking-normal">{user.full_name}</span>
            </NavLink>
            <button onClick={logout} className="btn-ghost" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? "w-60" : "w-0"} shrink-0 overflow-hidden border-r border-hair bg-panel transition-all duration-200 lg:w-60`}
        >
          <nav className="space-y-0.5 p-3">
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
              />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-6 py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
