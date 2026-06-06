import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";

// ============================================================================
// Shared shell for public marketing pages (Landing + HowItWorks).
// Header and footer are rendered once here — page content via <Outlet />.
// This prevents the "completely separate page" feel when navigating between
// public routes.
// ============================================================================

export default function PublicLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  function handleScrollNav(sectionId: string) {
    if (pathname === "/") {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    } else {
      // Pass scroll target via router state — Landing reads it after switching to home view
      navigate("/", { state: { scrollTo: sectionId } });
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b-[1.5px] border-ink bg-paper px-4 sm:px-8 lg:px-11 py-4">
        <Link to="/" aria-label="Sportzicon" className="flex flex-col items-start">
          <div style={{ width: 155, height: 48, backgroundImage: 'url(/logo.png)', backgroundSize: 'auto 450%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', flexShrink: 0 }} />
          <span className="lab hidden sm:inline" style={{ fontSize: 9, marginTop: -4, marginLeft: 86, letterSpacing: '0.12em' }}>EST. 2026</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 lg:gap-7">
          <button
            onClick={() => handleScrollNav("for-athletes")}
            className={`font-mononum text-[11px] transition bg-transparent border-none p-0 hidden md:inline cursor-pointer ${pathname === "/" ? "text-ink-70 hover:text-ink" : "text-ink-70 hover:text-ink"}`}
          >
            For Athletes
          </button>
          <button
            onClick={() => handleScrollNav("for-clubs")}
            className="font-mononum text-[11px] text-ink-70 hover:text-ink transition bg-transparent border-none p-0 hidden md:inline cursor-pointer"
          >
            For Clubs
          </button>
          <Link
            to="/how-it-works"
            className={`font-mononum text-[11px] transition hidden md:inline ${
              pathname === "/how-it-works"
                ? "text-ink border-b border-brand-500 pb-px"
                : "text-ink-70 hover:text-ink"
            }`}
          >
            How it works
          </Link>
          <Link
            to="/live-scores"
            className={`font-mononum text-[11px] transition hidden md:inline-flex items-center gap-1 ${
              pathname === "/live-scores"
                ? "text-ink border-b border-brand-500 pb-px"
                : "text-ink-70 hover:text-ink"
            }`}
          >
            <Activity className="w-3 h-3 text-red-500" />
            Live Scores
          </Link>
          <Link to="/login" className="font-mononum text-[11px] text-ink-sub">Sign in</Link>
          <Link to="/signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-hair px-4 sm:px-8 lg:px-11 py-2.5">
        <span className="lab">The verified sports recruitment network</span>
        <span className="lab hidden sm:inline">Pune · Mumbai · London · Melbourne · Cape Town</span>
      </div>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <Outlet />

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-4 sm:px-8 lg:px-11 py-4 lg:py-5">
        <span className="lab">© {new Date().getFullYear()} Sportzicon — All rights reserved</span>
        <span className="lab">Verified sports recruitment</span>
      </footer>
    </div>
  );
}
