import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import HowItWorksContent from "./HowItWorks";

// ============================================================================
// Landing — public marketing home. "Editorial Workstation" treatment.
// Owns its own header + footer. "How it works" swaps the body in-place so
// the header/footer never change — it is NOT a separate page or route.
// ============================================================================

type View = "home" | "how-it-works";

export default function Landing({ initialView = "home" }: { initialView?: View }) {
  const location = useLocation();
  const pendingScroll = useRef<string | null>(null);
  const [view, setView] = useState<View>(initialView);

  // Sync view when route changes; preserve any pending scroll target from router state
  useEffect(() => {
    if (location.state?.scrollTo) {
      pendingScroll.current = location.state.scrollTo;
      window.history.replaceState({}, "", location.pathname);
    }
    setView(initialView);
  // location.pathname is only read for history.replaceState; re-running on it would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView, location.state]);

  // After view settles, either execute pending scroll or go to top
  useLayoutEffect(() => {
    if (view === "home" && pendingScroll.current) {
      const id = pendingScroll.current;
      pendingScroll.current = null;
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [view]);

  const stats: [string, string][] = [
    ["48,200", "Athletes"],
    ["1,940", "Clubs & academies"],
    ["320", "Trials live now"],
    ["6,100", "Players selected"],
  ];

  const props: [string, string, string][] = [
    ["01", "Verified profiles", "Government-ID, coach endorsement and stat verification — every profile a scout opens is real, with a badge to prove it."],
    ["02", "Multi-filter search", "Sport, role, position, age, experience, location and live availability across one fast index built for recruiters."],
    ["03", "Application workflow", "Pending → Shortlisted → Selected. A formal state machine so both sides always know exactly where things stand."],
  ];

  const roles: [string, string][] = [
    ["Athletes", "Build a profile, get discovered, apply to trials."],
    ["Clubs & academies", "Post trials, search talent, manage applications."],
    ["Scouts", "Search players, save profiles, view verified stats."],
    ["Organizers", "Run events, accept registrations, manage participants."],
    ["Admins", "Verify identities, issue badges, moderate."],
  ];

  const athleteBenefits: [string, string, string][] = [
    ["01", "Verified identity", "Get a verified badge backed by government ID and coach endorsement — stand out in every recruiter search."],
    ["02", "Showcase your stats", "Upload match highlights, performance data and career history. One link, your entire story."],
    ["03", "Apply to trials", "Browse and apply to open trials with one tap. Track your application status from Pending to Selected in real time."],
    ["04", "Get discovered", "Appear in scout searches filtered by sport, position, age and location. Let opportunities come to you."],
    ["05", "Free to join", "Create your profile at no cost. Verified badge and premium discovery are always included."],
  ];

  const clubBenefits: [string, string, string][] = [
    ["01", "Post trials instantly", "Go live with a trial listing in minutes — sport, location, date, requirements and application window, all in one form."],
    ["02", "Search verified talent", "Filter 48,000+ athletes by sport, role, position, age, experience and live availability. Every result is verified."],
    ["03", "Manage applications", "A structured Pending → Shortlisted → Selected pipeline keeps your recruitment process organised and transparent."],
    ["04", "Team collaboration", "Invite scouts and coaches to your club workspace. Share shortlists, leave notes, make decisions together."],
    ["05", "Analytics dashboard", "Track trial views, application volume, shortlist conversion and time-to-selection across every campaign."],
  ];

  return (
    <div className="bg-paper text-ink">

      {/* ── Body — swaps between Home content and How It Works content ───── */}
      {view === "how-it-works" ? (
        <HowItWorksContent />
      ) : (
        <>
          {/* hero */}
          <section className="grid grid-cols-1 border-b border-hair lg:grid-cols-[1.25fr_1fr]">
            <div className="border-b border-hair lg:border-b-0 lg:border-r px-4 sm:px-8 lg:px-11 py-8 lg:py-12">
              <h1 className="font-disp mt-4 text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                Where talent<br />gets <span className="text-brand-500">seen.</span>
              </h1>
              <p className="mt-6 max-w-md text-base sm:text-lg leading-relaxed text-ink-sub">
                Sportzicon connects athletes, clubs, academies and scouts in one verified ecosystem — a structured
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
          <section className="grid grid-cols-1 border-b border-hair lg:grid-cols-3">
            {props.map(([n, t, b], i) => (
              <div key={n} className={`px-4 sm:px-8 py-6 sm:py-8 border-hair ${i < 2 ? "border-b lg:border-b-0 lg:border-r" : ""}`}>
                <div className="font-disp text-2xl text-brand-500">{n}</div>
                <h3 className="font-disp mt-3.5 text-2xl">{t}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-sub">{b}</p>
              </div>
            ))}
          </section>

          {/* For Athletes */}
          <section id="for-athletes" className="border-b-[1.5px] border-ink scroll-mt-16">
            <div className="flex items-baseline justify-between border-b border-hair px-11 py-5">
              <div>
                <div className="kicker">For Athletes</div>
                <h2 className="font-disp mt-1 text-4xl">Your career, verified.</h2>
              </div>
              <Link to="/signup" className="btn-primary">Join as an athlete →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {athleteBenefits.map(([n, t, b], i) => (
                <div key={n} className={`px-8 py-8 ${i < athleteBenefits.length - 1 ? "border-r border-hair" : ""}`}>
                  <div className="font-disp text-xl text-brand-500">{n}</div>
                  <h3 className="font-disp mt-3 text-lg leading-snug">{t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-sub">{b}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-hair bg-fill px-11 py-5 flex flex-wrap gap-3 items-center">
              {["Free to join", "Verified badge", "Trial applications", "Scout discovery", "Stats showcase"].map((tag) => (
                <span key={tag} className="badge">{tag}</span>
              ))}
            </div>
          </section>

          {/* For Clubs */}
          <section id="for-clubs" className="border-b-[1.5px] border-ink scroll-mt-16">
            <div className="flex items-baseline justify-between border-b border-hair px-11 py-5">
              <div>
                <div className="kicker">For Clubs &amp; Academies</div>
                <h2 className="font-disp mt-1 text-4xl">Recruit smarter.</h2>
              </div>
              <Link to="/signup" className="btn-primary">Join as a club →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {clubBenefits.map(([n, t, b], i) => (
                <div key={n} className={`px-8 py-8 ${i < clubBenefits.length - 1 ? "border-r border-hair" : ""}`}>
                  <div className="font-disp text-xl text-brand-500">{n}</div>
                  <h3 className="font-disp mt-3 text-lg leading-snug">{t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-sub">{b}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-hair bg-fill px-11 py-5 flex flex-wrap gap-3 items-center">
              {["Post trials", "Verified athletes", "Application pipeline", "Team workspace", "Analytics"].map((tag) => (
                <span key={tag} className="badge">{tag}</span>
              ))}
            </div>
          </section>

          {/* roles strip */}
          <section className="border-b border-hair bg-fill px-4 sm:px-8 lg:px-11 py-6 lg:py-9">
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
        </>
      )}

    </div>
  );
}
