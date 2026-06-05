import { Link } from "react-router-dom";

// ============================================================================
// How It Works — public explainer page. Same "Editorial Workstation" treatment
// as Landing. Shares the exact masthead + footer shell.
// ============================================================================

const steps: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Create your profile", body: "Sign up, pick your role, and build a detailed profile — sport, position, stats, achievements, and a verified CV. Your profile is your digital scouting dossier." },
  { n: "02", title: "Get verified", body: "Submit a government ID, coach endorsement, or club registration certificate. An admin reviews your documents and issues a trust badge visible to everyone on the platform." },
  { n: "03", title: "Search or get found", body: "Athletes appear in the recruiter search index the moment they go live. Scouts and clubs use multi-filter search — sport, age, position, location, availability — to find the right fit fast." },
  { n: "04", title: "Apply or recruit", body: "Athletes apply to open trials and scholarship listings. Clubs receive applications in a structured pipeline and move candidates through Pending → Shortlisted → Selected." },
  { n: "05", title: "Communicate", body: "Direct messaging keeps every conversation inside Sportzicon. In-app and email notifications fire at every stage change — no one is left wondering where things stand." },
];

const roles: { title: string; tag: string; steps: string[] }[] = [
  {
    title: "Athletes",
    tag: "Get discovered",
    steps: [
      "Build a profile with verified stats, achievements, and a sports CV.",
      "Get a Verified Player badge after ID and stat review.",
      "Browse and apply to trials, scholarships, and recruitment drives.",
      "Track every application in My Applications.",
      "Get AI-generated training tips based on your own statistics.",
    ],
  },
  {
    title: "Clubs & Academies",
    tag: "Recruit smarter",
    steps: [
      "Create a verified organisation profile with your badge and sport categories.",
      "Post trials, recruitment listings, and coaching job openings.",
      "Search the full athlete database with age, position, location, and experience filters.",
      "Manage your applicant pipeline — shortlist, select, or decline with one click.",
      "Communicate directly with candidates through in-app messaging.",
    ],
  },
  {
    title: "Scouts",
    tag: "Find talent",
    steps: [
      "Access the complete verified player database from day one.",
      "Filter by sport, playing role, experience level, location, and availability.",
      "View verified stats and coach endorsements on every profile.",
      "Message athletes directly and share profiles with the clubs you work for.",
    ],
  },
  {
    title: "Organizers",
    tag: "Run events",
    steps: [
      "Create tournament and event listings with eligibility criteria and dates.",
      "Accept and manage registrations from athletes and teams.",
      "Track participant lists and communicate with entrants.",
    ],
  },
];

const pipeline: { status: string; who: string; desc: string }[] = [
  { status: "Pending", who: "Athlete applies", desc: "Application created. Club receives an in-app and email notification immediately." },
  { status: "Shortlisted", who: "Club shortlists", desc: "Athlete flagged for further review. Athlete notified by email and in-app." },
  { status: "Selected", who: "Club selects", desc: "Athlete confirmed. Vacancy count decrements. Listing auto-closes when all spots are filled." },
  { status: "Rejected", who: "Club declines", desc: "Application closed with an optional reason. Athlete notified." },
  { status: "Withdrawn", who: "Athlete withdraws", desc: "Athlete cancels at any stage. If selected, their vacancy slot is restored." },
];

const badges: { badge: string; for: string; what: string }[] = [
  { badge: "Verified Player", for: "Athletes", what: "Phone, email, government ID, and stat or coach endorsement" },
  { badge: "Verified Club", for: "Clubs", what: "Registration certificate reviewed and approved by admin" },
  { badge: "Verified Academy", for: "Academies", what: "Registration certificate reviewed and approved by admin" },
  { badge: "Verified Coach", for: "Coaches", what: "Coaching licence or certification approved by admin" },
  { badge: "Verified Scout", for: "Scouts", what: "Identity document and organisation association confirmed" },
  { badge: "Verified Stats", for: "Athletes", what: "Stats source document or endorsement by a verified coach" },
];

const features: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Activity posts", body: "Share training logs, match updates, and general updates. Other users can like and comment. Posts appear in the feeds of your followers." },
  { n: "02", title: "Blogs", body: "Write long-form articles about sport, training, or your journey in Markdown. Save as draft or publish immediately. Fully searchable by the community." },
  { n: "03", title: "Follow network", body: "Follow clubs, scouts, and athletes you want to track. Their activity shows in your feed. Your follower count is displayed on your profile — it matters to recruiters." },
  { n: "04", title: "Direct messages", body: "Every user can initiate a private thread. Conversations are stored in your inbox with unread counts. Admin can access threads only if formally flagged for abuse." },
  { n: "05", title: "Notifications", body: "In-app and email alerts fire on every meaningful event — new application, shortlisted, selected, new message, verification decision, new follower." },
  { n: "06", title: "AI training tips", body: "Athletes click Get Tips on their dashboard. Sportzicon sends their stats to OpenAI and returns personalised training recommendations in seconds." },
];

export default function HowItWorks() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 border-b border-hair lg:grid-cols-[1.4fr_1fr]">
        <div className="border-r border-hair px-11 py-12">
          <div className="kicker">Platform guide — Issue No. 02</div>
          <h1 className="font-disp mt-4 text-6xl leading-[0.95] lg:text-7xl">
            Built for how<br />sport <span className="text-brand-500">actually</span><br />works.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-sub">
            Sportzicon is not a general social network. It is a structured recruitment platform with verified
            profiles, a formal application workflow, and role-specific tools — built for athletes, clubs,
            scouts, and organizers who mean business.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">Create your profile →</Link>
            <Link to="/" className="btn-secondary">← Back to home</Link>
          </div>
        </div>
        <div className="flex flex-col justify-center bg-fill px-9 py-10 gap-5">
          {["Verified profiles", "Structured application pipeline", "Multi-filter recruiter search", "AI performance tips", "In-app messaging & notifications"].map((item, i) => (
            <div key={item} className="flex items-start gap-4 border-b border-hairsoft pb-4 last:border-0 last:pb-0">
              <span className="font-disp text-brand-500 text-base mt-0.5">0{i + 1}</span>
              <span className="text-sm text-ink">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Five-step overview ───────────────────────────────────────────── */}
      <section className="border-b border-hair">
        <div className="px-11 py-8 border-b border-hair">
          <div className="kicker">The journey</div>
          <h2 className="font-disp mt-2 text-4xl">From sign-up to selected — five steps</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(({ n, title, body }, i) => (
            <div key={n} className={`px-8 py-8 ${i < steps.length - 1 ? "border-r border-hair" : ""}`}>
              <div className="font-disp text-3xl text-brand-500">{n}</div>
              <h3 className="font-disp mt-3 text-lg">{title}</h3>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-sub">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────────── */}
      <section className="border-b border-hair bg-fill">
        <div className="px-11 py-8 border-b border-hair">
          <div className="kicker">Role-by-role breakdown</div>
          <h2 className="font-disp mt-2 text-4xl">One platform, four distinct experiences</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {roles.map(({ title, tag, steps: roleSteps }, ri) => (
            <div
              key={title}
              className={`px-9 py-8 ${ri % 2 === 0 ? "border-r border-hair" : ""} ${ri < 2 ? "border-b border-hair" : ""}`}
            >
              <div className="flex items-center gap-3 mb-5">
                <span className="font-disp text-brand-500 text-sm">0{ri + 1}</span>
                <h3 className="font-disp text-2xl">{title}</h3>
                <span className="badge">{tag}</span>
              </div>
              <ol className="space-y-3">
                {roleSteps.map((s, si) => (
                  <li key={si} className="flex items-start gap-3">
                    <span className="font-mononum text-[10px] text-brand-500 mt-0.5 shrink-0">{String(si + 1).padStart(2, "0")}</span>
                    <span className="text-[12.5px] leading-relaxed text-ink-sub">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* ── Application pipeline ─────────────────────────────────────────── */}
      <section className="border-b border-hair">
        <div className="px-11 py-8 border-b border-hair">
          <div className="kicker">Application workflow</div>
          <h2 className="font-disp mt-2 text-4xl">A formal state machine — no ambiguity</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-sub">
            Every application moves through a defined lifecycle. Both sides — athlete and organisation — always know exactly where things stand.
            Email and in-app notifications fire at every stage transition.
          </p>
        </div>

        {/* Pipeline visual */}
        <div className="px-11 py-8 border-b border-hair">
          <div className="flex flex-wrap items-center gap-0">
            {["Pending", "Shortlisted", "Selected"].map((s, i) => (
              <div key={s} className="flex items-center gap-0">
                <div className={`panel px-5 py-2.5 ${s === "Selected" ? "bg-ink text-paper" : ""}`}>
                  <span className={`font-mononum text-[11px] uppercase tracking-[0.08em] ${s === "Selected" ? "text-paper" : "text-ink"}`}>{s}</span>
                </div>
                {i < 2 && <span className="font-mononum text-[10px] text-brand-500 mx-2">→</span>}
              </div>
            ))}
            <span className="font-mononum text-[10px] text-ink-faint mx-4">or</span>
            <div className="panel px-5 py-2.5 border-red-200">
              <span className="font-mononum text-[11px] uppercase tracking-[0.08em] text-red-600">Rejected</span>
            </div>
            <span className="font-mononum text-[10px] text-ink-faint mx-4">or</span>
            <div className="panel px-5 py-2.5">
              <span className="font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub">Withdrawn</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {pipeline.map(({ status, who, desc }, i) => (
            <div key={status} className={`px-7 py-7 ${i < pipeline.length - 1 ? "border-r border-hair" : ""}`}>
              <div className={`font-mononum text-[10px] uppercase tracking-[0.1em] mb-2 ${status === "Rejected" ? "text-red-500" : status === "Selected" ? "text-brand-500" : "text-ink-sub"}`}>{status}</div>
              <div className="font-disp text-base mb-2">{who}</div>
              <p className="text-[12px] leading-relaxed text-ink-sub">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Search & Discovery ───────────────────────────────────────────── */}
      <section className="border-b border-hair">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
          <div className="border-r border-hair px-11 py-10">
            <div className="kicker">Search & discovery</div>
            <h2 className="font-disp mt-2 text-4xl">Multi-filter search built for recruiters</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-sub">
              Scouts and clubs search the full verified player database without ever
              leaving the platform. No LinkedIn hacks. No WhatsApp groups. One index.
            </p>
            <div className="mt-7 space-y-2.5">
              {[
                ["Sport & position", "Filter by primary sport, playing role, and position on field."],
                ["Age & experience", "Set min/max age range and experience level in one slider."],
                ["Location", "Country, state, city, or radius-based nearby search."],
                ["Availability", "Only show players who are actively looking for a club."],
                ["Verification status", "Filter to verified profiles only for higher-confidence outreach."],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-start gap-3 pb-2.5 border-b border-hairsoft last:border-0">
                  <span className="text-brand-500 mt-0.5 shrink-0">✓</span>
                  <div>
                    <span className="font-mononum text-[10.5px] uppercase tracking-[0.08em] text-ink">{label}</span>
                    <span className="text-[12px] text-ink-sub ml-2">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-11 py-10 bg-fill">
            <div className="kicker mb-5">Search ranking logic</div>
            <div className="space-y-4">
              {[
                ["01", "Exact match", "Name, sport, or location exact matches are ranked first."],
                ["02", "Verified first", "Verified profiles rank above unverified ones at every position."],
                ["03", "Profile completeness", "A complete profile with stats and photo ranks higher."],
                ["04", "Recent activity", "Players active in the last 30 days are boosted in results."],
                ["05", "Stats performance", "Higher reported stats rank higher within the same sport and position."],
              ].map(([n, t, d]) => (
                <div key={n} className="panel p-4 flex gap-4">
                  <span className="font-disp text-brand-500 text-xl shrink-0">{n}</span>
                  <div>
                    <div className="font-disp text-sm">{t}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-sub">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Verification ─────────────────────────────────────────────────── */}
      <section className="border-b border-hair bg-fill">
        <div className="px-11 py-8 border-b border-hair">
          <div className="kicker">Trust & verification</div>
          <h2 className="font-disp mt-2 text-4xl">Verified badges — what they mean and how to earn them</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-sub">
            Every badge on Sportzicon is issued by a human admin after reviewing uploaded documents. They cannot be self-assigned.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map(({ badge, for: forRole, what }, i) => (
            <div key={badge} className={`px-8 py-7 ${i % 3 < 2 ? "border-r border-hair" : ""} ${i < 3 ? "border-b border-hair" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge-verified">
                  <span className="tick">✓</span> {badge}
                </span>
              </div>
              <div className="lab mb-2">For {forRole}</div>
              <p className="text-[12.5px] leading-relaxed text-ink-sub">{what}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────────── */}
      <section className="border-b border-hair">
        <div className="px-11 py-8 border-b border-hair">
          <div className="kicker">Platform features</div>
          <h2 className="font-disp mt-2 text-4xl">Everything in one place</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ n, title, body }, i) => (
            <div key={n} className={`px-8 py-8 ${i % 3 < 2 ? "border-r border-hair" : ""} ${i < 3 ? "border-b border-hair" : ""}`}>
              <div className="font-disp text-2xl text-brand-500">{n}</div>
              <h3 className="font-disp mt-3 text-xl">{title}</h3>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-sub">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-hair bg-fill">
        <div className="px-11 py-8 border-b border-hair">
          <div className="kicker">Common questions</div>
          <h2 className="font-disp mt-2 text-4xl">Frequently asked</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {[
            ["Can I change my role after signing up?", "No — your role is set at registration and cannot be changed from the app. Contact platform support if you need a correction."],
            ["What happens when an opportunity's deadline passes?", "The listing automatically closes at midnight on the deadline date. No new applications can be accepted after that point."],
            ["How long does verification take?", "Verification is reviewed manually by the admin team. During the beta phase, review typically takes 1–3 business days."],
            ["Can I apply to the same opportunity more than once?", "No. Each athlete can only submit one application per opportunity. You can withdraw and the slot is restored if you change your mind."],
            ["Are my private messages secure?", "Yes — only you and the other person can read the conversation. Admins can access threads only if they are formally flagged for abuse review."],
            ["What does the Verified badge mean?", "It means the platform admin team has reviewed and confirmed the identity or credentials of that user or organisation. A higher-trust signal for everyone."],
            ["What if the AI tips service is unavailable?", "A set of standard fallback tips is shown automatically. The rate limit is 20 requests per day with a 30-second cooldown between requests."],
            ["How do vacancy counts work?", "Each time a club selects an applicant, the vacancy count decreases by one. When it reaches zero the listing is automatically marked Filled and closed."],
          ].map(([q, a], i) => (
            <div key={q} className={`px-9 py-7 ${i % 2 === 0 ? "border-r border-hair" : ""} ${i < (8 - 2) ? "border-b border-hair" : ""}`}>
              <h4 className="font-disp text-base mb-2">{q}</h4>
              <p className="text-[12.5px] leading-relaxed text-ink-sub">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center justify-between gap-6 border-t-[1.5px] border-ink px-11 py-10">
        <h2 className="font-disp text-4xl leading-tight">
          Ready to get<br /><span className="text-brand-500">started?</span>
        </h2>
        <div className="flex gap-3">
          <Link to="/signup" className="btn-primary">Create your profile →</Link>
          <Link to="/opportunities" className="btn-secondary">Browse opportunities</Link>
        </div>
      </section>

    </div>
  );
}
