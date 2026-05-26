import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">S</span>
          <span className="text-lg font-semibold tracking-tight">Sportivox</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost">Sign in</Link>
          <Link to="/signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <span className="badge">Sports Networking & Recruitment</span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
          Get discovered. Get recruited.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Sportivox connects athletes, clubs, academies, scouts, and organizers in one verified ecosystem.
          A LinkedIn-style network built specifically for how recruitment actually works in sports.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className="btn-primary">Create your profile</Link>
          <Link to="/opportunities" className="btn-secondary">Browse opportunities</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-3">
        {[
          { title: "Verified athlete profiles", body: "Government-ID + coach endorsement give scouts confidence in every profile they review." },
          { title: "Powerful search", body: "Filter players by sport, position, age, experience, location and availability — all in one place." },
          { title: "Application workflow", body: "Pending → Shortlisted → Selected. Both sides always know exactly where things stand." }
        ].map((f) => (
          <div key={f.title} className="card card-body">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-slate-500">
          © {new Date().getFullYear()} Sportivox. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
