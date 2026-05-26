import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Bell, Home, Search, Briefcase, FileText, Film, MessageCircle, ShieldCheck, LogOut, User as UserIcon, Menu, X, Trophy } from "lucide-react";
import { useState } from "react";

function NavItem({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    ...((user.role === "club" || user.role === "organizer") ? [{ to: "/my-organizations", icon: <Briefcase className="h-4 w-4" />, label: "My Organizations" }] : []),
    ...(user.role === "admin" ? [{ to: "/admin", icon: <ShieldCheck className="h-4 w-4" />, label: "Admin" }] : [])
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded-lg p-2 hover:bg-slate-100 transition"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">S</span>
              <span className="text-lg font-semibold tracking-tight">Sportivox</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/notifications" className="relative rounded-full p-2 hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              {!!count && count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-medium text-white">
                  {count}
                </span>
              )}
            </NavLink>
            <NavLink to={`/profile/${user.id}`} className="btn-ghost">
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{user.full_name}</span>
            </NavLink>
            <button onClick={logout} className="btn-ghost" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={`${
          sidebarOpen ? "w-64" : "w-0"
        } border-r bg-white transition-all duration-200 overflow-hidden lg:w-64`}>
          <nav className="space-y-1 p-4">
            {navItems.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  setSidebarOpen(false);
                }}
              />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
