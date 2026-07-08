import clsx from "clsx";
import type { ReactNode } from "react";

// ============================================================================
// Shared UI primitives — "Editorial Workstation" skin.
// All original exports keep identical signatures so every page compiles
// unchanged: PageHeader, Badge, EmptyState, Spinner, StatusPill, VerifiedBadge.
// New optional helpers (Kicker, SectionHead, Avatar, StatCard, Tabs, Placeholder)
// are additive — adopt them where you want the full treatment.
// ============================================================================

export function PageHeader({ title, subtitle, action, sticky, className }: { title: string; subtitle?: string; action?: ReactNode; sticky?: boolean; className?: string }) {
  return (
    <div className={clsx(
      "mb-6 flex flex-wrap items-end justify-between gap-3 border-b-[1.5px] border-ink pb-3",
      sticky && "sticky -top-4 sm:-top-7 z-30 bg-panel -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 sm:pt-4",
      className
    )}>
      <div>
        {subtitle && <div className="lab mb-2 text-brand-500">{subtitle}</div>}
        <h1 className="font-disp text-3xl text-ink">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("kicker", className)}>{children}</div>;
}

export function SectionHead({ n, title, sub, right }: { n?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="section-head">
      <div className="flex items-baseline gap-3">
        {n && <span className="font-disp text-lg text-brand-500">{n}</span>}
        <div>
          <h2 className="font-disp text-2xl">{title}</h2>
          {sub && <div className="lab mt-1.5">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  return (
    <span
      className={clsx(
        "badge",
        color === "slate" && "bg-fill text-ink-70 border-hair",
        color === "emerald" && "bg-emerald-50 text-emerald-800 border-emerald-200",
        color === "amber" && "bg-amber-50 text-amber-800 border-amber-200",
        color === "red" && "bg-red-50 text-red-800 border-red-200",
        color === "blue" && "bg-blue-50 text-blue-800 border-blue-200"
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card card-body text-center border-dashed">
      <h3 className="font-disp text-xl text-ink-70">{title}</h3>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm text-ink-sub">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin h-5 w-5", className)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" fill="none" />
    </svg>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; label?: string }> = {
    pending: { c: "#B6791E", bg: "#F6ECD7" },
    shortlisted: { c: "#2B66C9", bg: "#E2EAF8" },
    selected: { c: "#2E7D52", bg: "#E2F0E8" },
    rejected: { c: "#C0392B", bg: "#F8E3E0", label: "not selected" },
    withdrawn: { c: "#726B60", bg: "#F2F1EC" },
    open: { c: "#2E7D52", bg: "#E2F0E8" },
    closed: { c: "#726B60", bg: "#F2F1EC" },
    filled: { c: "#2B66C9", bg: "#E2EAF8" },
    active: { c: "#2E7D52", bg: "#E2F0E8" },
    suspended: { c: "#C0392B", bg: "#F8E3E0" },
    approved: { c: "#2E7D52", bg: "#E2F0E8" },
    unverified: { c: "#726B60", bg: "#F2F1EC" },
    draft: { c: "#726B60", bg: "#F2F1EC" },
    published: { c: "#2E7D52", bg: "#E2F0E8" },
    review: { c: "#B6791E", bg: "#F6ECD7", label: "in review" }
  };
  const s = map[status] ?? { c: "#726B60", bg: "#F2F1EC" };
  return (
    <span
      className="font-mononum inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]"
      style={{ color: s.c, background: s.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />
      {s.label ?? status}
    </span>
  );
}

export function VerifiedBadge({ verification, label = "verified" }: { verification?: { status: string; badges?: string[] }; label?: string }) {
  if (!verification || verification.status !== "approved") return null;
  return (
    <span className="badge-verified">
      <span className="tick">✓</span>
      {label}
    </span>
  );
}

// ---- additive helpers (optional adoption) ----------------------------------

// Initials avatar — square by default, ink fill when accent.
// Pass `src` to show a photo; falls back to initials when src is absent or fails to load.
export function Avatar({ name = "", size = 40, accent = false, square = true, src, className }: { name?: string; size?: number; accent?: boolean; square?: boolean; src?: string | null; className?: string }) {
  const ini = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx("shrink-0 object-cover border", square ? "rounded" : "rounded-full", className)}
        style={{ width: size, height: size, borderColor: "rgba(20,17,13,0.13)" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <span
      className={clsx("font-disp inline-flex shrink-0 items-center justify-center border", square ? "rounded" : "rounded-full", className)}
      style={{
        width: size, height: size,
        background: accent ? "#14110D" : "#F2F1EC",
        color: accent ? "#F7F5EF" : "#4A453D",
        borderColor: accent ? "#14110D" : "rgba(20,17,13,0.13)",
        fontSize: size * 0.4
      }}
    >
      {ini}
    </span>
  );
}

// Career headline stat card.
export function StatCard({ k, v, big = false }: { k: string; v: ReactNode; big?: boolean }) {
  return (
    <div className="panel px-3.5 py-3">
      <div className={clsx("font-disp", big ? "text-4xl" : "text-3xl")}>{v}</div>
      <div className="lab mt-1.5">{k}</div>
    </div>
  );
}

// Striped media placeholder (drop-zone for real imagery).
export function Placeholder({ label, height = 160, className }: { label?: string; height?: number; className?: string }) {
  return (
    <div className={clsx("ph", className)} style={{ height }}>
      <span className="absolute left-2 top-2 h-1.5 w-1.5 bg-brand-500" />
      {label && <span className="lab absolute bottom-2 left-2">{label}</span>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange, sticky, className }: { tabs: { id: string; label: string }[] | string[]; active: string; onChange: (id: string) => void; sticky?: boolean; className?: string }) {
  const norm = tabs.map((t) => (typeof t === "string" ? { id: t, label: t } : t));
  return (
    <div className={clsx(
      "flex gap-1 overflow-x-auto border-b border-hair",
      sticky && "sticky -top-4 sm:-top-7 z-30 bg-panel -mx-3 sm:-mx-6 px-3 sm:px-6",
      className
    )}>
      {norm.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "font-mononum whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[11.5px] transition",
            active === t.id ? "border-brand-500 font-semibold text-ink" : "border-transparent text-ink-sub hover:text-ink"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btn = "font-mononum text-[11px] min-w-[28px] h-[28px] rounded border transition flex items-center justify-center";
  return (
    <div className="flex items-center justify-between gap-4 pt-5">
      <span className="font-mononum text-[11px] text-ink-sub whitespace-nowrap">
        Page {page} of {totalPages} · {total} record{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={clsx(btn, "px-3 text-ink-sub border-hair hover:text-ink hover:border-ink disabled:opacity-35 disabled:cursor-not-allowed")}
      >
        ←
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`el-${i}`} className="font-mononum text-[11px] w-7 text-center text-ink-faint">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={btn}
            style={{
              background: page === p ? "#14110D" : undefined,
              color: page === p ? "#F7F5EF" : "#726B60",
              borderColor: page === p ? "#14110D" : "rgba(20,17,13,0.13)",
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={clsx(btn, "px-3 text-ink-sub border-hair hover:text-ink hover:border-ink disabled:opacity-35 disabled:cursor-not-allowed")}
      >
        →
      </button>
      </div>
    </div>
  );
}
