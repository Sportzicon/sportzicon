import { Link } from "react-router-dom";

// ============================================================================
// Landing — public marketing home. "Editorial Workstation" treatment.
// Static (no data); safe to drop in. Mirrors the approved prototype.
// ============================================================================

export default function Landing() {
  const stats: [string, string][] = [
    ["48,200", "Athletes"],
    ["1,940", "Clubs & academies"],
    ["320", "Trials live now"],
    ["6,100", "Players selected"]
  ];
  const props: [string, string, string][] = [
    ["01", "Verified profiles", "Government-ID, coach endorsement and stat verification — every profile a scout opens is real, with a badge to prove it."],
    ["02", "Multi-filter search", "Sport, role, position, age, experience, location and live availability across one fast index built for recruiters."],
    ["03", "Application workflow", "Pending → Shortlisted → Selected. A formal state machine so both sides always know exactly where things stand."]
  ];
  const roles: [string, string][] = [
    ["Athletes", "Build a profile, get discovered, apply to trials."],
    ["Clubs & academies", "Post trials, search talent, manage applications."],
    ["Scouts", "Search players, save profiles, view verified stats."],
    ["Organizers", "Run events, accept registrations, manage participants."],
    ["Admins", "Verify identities, issue badges, moderate."]
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* masthead */}
      <header className="flex items-center justify-between border-b-[1.5px] border-ink px-4 sm:px-8 lg:px-11 py-4">
        <div className="flex items-baseline gap-3">
          <span className="inline-flex h-7 w-7 translate-y-0.5 items-center justify-center rounded bg-brand-500 font-disp text-lg text-white">S</span>
          <span className="font-disp text-2xl tracking-[0.02em]">Sportivox</span>
          <span className="lab hidden sm:inline">est. 2026</span>
        </div>
        <nav className="flex items-center gap-3 sm:gap-5 lg:gap-7">
          {["For Athletes", "For Clubs", "Opportunities", "How it works"].map((n) => (
            <span key={n} className="font-mononum cursor-pointer text-[11px] text-ink-70 hidden md:inline">{n}</span>
          ))}
          <Link to="/login" className="font-mononum text-[11px] text-ink-sub">Sign in</Link>
          <Link to="/signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-hair px-4 sm:px-8 lg:px-11 py-2.5">
        <span className="lab">The verified sports recruitment network</span>
        <span className="lab hidden sm:inline">Pune · Mumbai · London · Melbourne · Cape Town</span>
      </div>

      {/* hero */}
      <section className="grid grid-cols-1 border-b border-hair lg:grid-cols-[1.25fr_1fr]">
        <div className="border-b border-hair lg:border-b-0 lg:border-r px-4 sm:px-8 lg:px-11 py-8 lg:py-12">
          <div className="kicker">Issue No. 01 — Talent, Verified</div>
          <h1 className="font-disp mt-4 text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
            Where talent<br />gets <span className="text-brand-500">seen.</span>
          </h1>
          <p className="mt-6 max-w-md text-base sm:text-lg leading-relaxed text-ink-sub">
            Sportivox connects athletes, clubs, academies and scouts in one verified ecosystem — a structured
            profile, a powerful search, and a recruitment workflow built for how sport actually hires.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">Create your profile →</Link>
            <Link to="/signup" className="btn-secondary">For clubs &amp; scouts</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-5 sm:gap-7">
            {["Verified Player", "Verified Club", "Verified Stats", "Verified Scout"].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="text-brand-500">✓</span>
                <span className="lab">{b}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center bg-fill px-4 sm:px-6 lg:px-9 py-6 lg:py-8">
          <div className="flex items-center justify-between">
            <span className="lab">Built for recruiters</span>
            <span className="kicker">320 open</span>
          </div>
          <div className="ph mt-4" style={{ height: 280 }}>
            <span className="absolute left-2 top-2 h-1.5 w-1.5 bg-brand-500" />
            <span className="lab absolute bottom-2 left-2">Product preview · search index</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Cricket", "Football", "Trials", "Scholarships", "Verified clubs"].map((c) => (
              <span key={c} className="badge">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* stat ledger */}
      <section className="grid grid-cols-2 border-b-[1.5px] border-ink lg:grid-cols-4">
        {stats.map(([n, l], i) => (
          <div key={l} className={`px-4 sm:px-8 py-5 sm:py-6 ${i < stats.length - 1 ? "border-r border-hair" : ""}`}>
            <div className="font-disp text-5xl">{n}</div>
            <div className="lab mt-2">{l}</div>
          </div>
        ))}
      </section>

      {/* value props */}
      <section className="grid grid-cols-1 lg:grid-cols-3">
        {props.map(([n, t, b], i) => (
          <div key={n} className={`px-4 sm:px-8 py-6 sm:py-8 border-hair ${i < 2 ? "border-b lg:border-b-0 lg:border-r" : ""}`}>
            <div className="font-disp text-2xl text-brand-500">{n}</div>
            <h3 className="font-disp mt-3.5 text-2xl">{t}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-sub">{b}</p>
          </div>
        ))}
      </section>

      {/* roles strip */}
      <section className="border-t border-hair bg-fill px-4 sm:px-8 lg:px-11 py-6 lg:py-9">
        <div className="kicker">One network, five roles</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map(([t, d]) => (
            <div key={t} className="panel p-4">
              <h4 className="font-disp text-base">{t}</h4>
              <p className="mt-2 text-[12.5px] leading-snug text-ink-sub">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-wrap items-center justify-between gap-6 border-t-[1.5px] border-ink px-4 sm:px-8 lg:px-11 py-8 lg:py-10">
        <h2 className="font-disp text-3xl sm:text-4xl leading-tight">
          Get discovered.<br /><span className="text-brand-500">Get recruited.</span>
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/signup" className="btn-primary">Create your profile →</Link>
          <Link to="/opportunities" className="btn-secondary">Browse opportunities</Link>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-4 sm:px-8 lg:px-11 py-4 lg:py-5">
        <span className="lab">© {new Date().getFullYear()} Sportivox — All rights reserved</span>
        <span className="lab">Verified sports recruitment</span>
      </footer>
    </div>
  );
}
