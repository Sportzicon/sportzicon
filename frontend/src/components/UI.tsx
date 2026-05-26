import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        color === "slate" && "bg-slate-100 text-slate-700",
        color === "emerald" && "bg-emerald-100 text-emerald-800",
        color === "amber" && "bg-amber-100 text-amber-800",
        color === "red" && "bg-red-100 text-red-800",
        color === "blue" && "bg-brand-100 text-brand-800"
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card card-body text-center">
      <h3 className="text-base font-medium text-slate-800">{title}</h3>
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
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
  const map: Record<string, "slate" | "emerald" | "amber" | "red" | "blue"> = {
    pending: "amber",
    shortlisted: "blue",
    selected: "emerald",
    rejected: "red",
    withdrawn: "slate",
    open: "emerald",
    closed: "slate",
    filled: "blue",
    active: "emerald",
    suspended: "red",
    approved: "emerald",
    unverified: "slate",
    draft: "slate",
    published: "emerald"
  };
  return <Badge color={map[status] ?? "slate"}>{status}</Badge>;
}

export function VerifiedBadge({ verification }: { verification?: { status: string; badges?: string[] } }) {
  if (!verification || verification.status !== "approved") return null;
  return <Badge color="emerald">✓ verified</Badge>;
}
