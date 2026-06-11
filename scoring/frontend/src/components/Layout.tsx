import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api } from "../api/client";
import { Trophy, Radio, Home, LogOut, User, PlusCircle, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const rt = useAuthStore.getState().refresh_token;
    if (rt) await api.post("/auth/logout", { refresh_token: rt }).catch(() => {});
    clear();
    navigate("/login");
  }

  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);

  return (
    <div className="flex flex-col h-screen">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 shrink-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-emerald-600 text-lg shrink-0">
            <Trophy className="w-5 h-5" />
            ScoreBoard
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 flex-1">
            <NavItem to="/" icon={<Home className="w-4 h-4" />} label="Home" />
            <NavItem to="/tournaments" icon={<Trophy className="w-4 h-4" />} label="Tournaments" />
            <NavItem to="/?live=1" icon={<Radio className="w-4 h-4" />} label="Live" />
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {canManage && (
              <Link to="/tournaments/new" className="btn-primary hidden sm:flex">
                <PlusCircle className="w-4 h-4" /> New Tournament
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:block">{user.full_name}</span>
                <button onClick={handleLogout} className="btn-secondary px-2 py-1.5">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary">Sign in</Link>
            )}
            <button className="sm:hidden p-1" onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-2" onClick={() => setMenuOpen(false)}>
            <Link to="/" className="flex items-center gap-2 py-2 text-sm"><Home className="w-4 h-4" /> Home</Link>
            <Link to="/tournaments" className="flex items-center gap-2 py-2 text-sm"><Trophy className="w-4 h-4" /> Tournaments</Link>
            {canManage && <Link to="/tournaments/new" className="flex items-center gap-2 py-2 text-sm text-emerald-600"><PlusCircle className="w-4 h-4" /> New Tournament</Link>}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        ScoreBoard — Local Tournament Scoring Platform
      </footer>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
          isActive ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-100"
        }`
      }
    >
      {icon}{label}
    </NavLink>
  );
}
