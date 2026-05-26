import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Bell, Home, Search, Briefcase, FileText, Film, MessageCircle, ShieldCheck, LogOut, User as UserIcon } from "lucide-react";

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">S</span>
            <span className="text-lg font-semibold tracking-tight">Sportivox</span>
          </Link>
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

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="card card-body space-y-1 sticky top-20">
            <NavItem to="/dashboard" icon={<Home className="h-4 w-4" />} label="Dashboard" />
            <NavItem to="/feed" icon={<FileText className="h-4 w-4" />} label="Feed" />
            <NavItem to="/reels" icon={<Film className="h-4 w-4" />} label="Reels" />
            <NavItem to="/blogs" icon={<FileText className="h-4 w-4" />} label="Blogs" />
            <NavItem to="/search" icon={<Search className="h-4 w-4" />} label="Search" />
            <NavItem to="/opportunities" icon={<Briefcase className="h-4 w-4" />} label="Opportunities" />
            <NavItem to="/messages" icon={<MessageCircle className="h-4 w-4" />} label="Messages" />
            {user.role === "athlete" && (
              <NavItem to="/applications" icon={<Briefcase className="h-4 w-4" />} label="My Applications" />
            )}
            {(user.role === "club" || user.role === "organizer") && (
              <NavItem to="/my-organizations" icon={<Briefcase className="h-4 w-4" />} label="My Organizations" />
            )}
            {user.role === "admin" && (
              <NavItem to="/admin" icon={<ShieldCheck className="h-4 w-4" />} label="Admin" />
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
