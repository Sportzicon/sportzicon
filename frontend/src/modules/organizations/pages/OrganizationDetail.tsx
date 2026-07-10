import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { useAuthStore } from "../../../store/auth";
import { Spinner, VerifiedBadge, SectionHead, Kicker, StatusPill, EmptyState } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { Globe, Mail, Phone, MapPin, Calendar, Pencil, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { queryKeys } from "../../../hooks/queryKeys";

function DetailRow({ icon, value }: { icon: React.ReactNode; value?: string | number }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 text-[13.5px] text-ink-70">
      <span className="flex-shrink-0 mt-0.5 text-ink-faint">{icon}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

export default function OrganizationDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const [descExpanded, setDescExpanded] = useState(false);

  const orgQ = useQuery({
    queryKey: queryKeys.organization(id),
    queryFn: async () => (await api.get(`/organizations/${id}`)).data.organization
  });

  const oppsQ = useQuery({
    queryKey: queryKeys.orgOpportunities(id ?? ""),
    queryFn: async () =>
      (await api.get("/opportunities", { params: { org_id: id, status: "open", limit: 10 } })).data.data as any[],
    enabled: !!id
  });

  if (orgQ.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  const o = orgQ.data;
  if (!o) return <div className="card card-body">Organization not found.</div>;

  const isOwner = me?.id === o.owner_user_id;
  const isAdmin = me?.role === "admin";
  const canEdit = isOwner || isAdmin;

  const descLong = o.description && o.description.length > 200;
  const descDisplay = descLong && !descExpanded
    ? o.description.slice(0, 200) + "…"
    : o.description;

  return (
    <div className="space-y-4 max-w-4xl">
      <BackButton label="Organizations" />
      {/* Cover + header */}
      <div className="card overflow-hidden">
        <div className="relative h-36 bg-ink">
          <div className="absolute inset-0"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 11px)" }} />
          {o.cover_url && <img src={o.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        </div>

        <div className="p-4 sm:p-6 -mt-10">
          {/* Logo + name row */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="h-20 w-20 rounded border-4 border-panel bg-fill overflow-hidden flex-shrink-0 flex items-center justify-center">
                {o.logo_url
                  ? <img src={o.logo_url} alt={o.org_name} className="h-full w-full object-cover" />
                  : <span className="font-disp text-3xl text-ink-sub">{o.org_name?.[0]}</span>
                }
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Kicker>{o.org_type}</Kicker>
                  <VerifiedBadge verification={o.verification} label="Verified" />
                </div>
                <h1 className="font-disp mt-1 text-2xl sm:text-4xl leading-tight">{o.org_name}</h1>
                {(o.city || o.country) && (
                  <div className="lab mt-1 flex items-center gap-1.5 text-[11px]">
                    <MapPin className="h-3 w-3" />
                    {[o.city, o.state, o.country].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons — full width on mobile */}
            {canEdit && (
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 pb-1">
                <button
                  onClick={() => navigate(`/organizations/${id}/edit`)}
                  className="btn-secondary min-h-[44px] flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <Link
                  to="/opportunities/new"
                  className="btn-accent min-h-[44px] flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <Briefcase className="h-3.5 w-3.5" /> Post opportunity
                </Link>
              </div>
            )}
          </div>

          {/* Description with "Read more" */}
          {o.description && (
            <div className="mt-4">
              <p className="text-[14px] sm:text-[15px] leading-relaxed text-ink-70">{descDisplay}</p>
              {descLong && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 flex items-center gap-1 text-brand-500 text-sm font-medium min-h-[44px]"
                >
                  {descExpanded ? <><ChevronUp className="h-4 w-4" /> Show less</> : <><ChevronDown className="h-4 w-4" /> Read more</>}
                </button>
              )}
            </div>
          )}

          {/* Sport chips — horizontally scrollable */}
          {o.sport_categories?.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {o.sport_categories.map((s: string) => (
                <span key={s} className="badge flex-shrink-0 capitalize">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content: two column on desktop */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Open opportunities */}
        <div>
          <SectionHead n="01" title="Open opportunities" sub={`From ${o.org_name}`}
            right={canEdit && (
              <Link to="/opportunities/new" className="btn-ghost text-[12px] min-h-[44px] flex items-center">+ Post →</Link>
            )}
          />
          {oppsQ.isLoading ? (
            <div className="card card-body flex justify-center py-8"><Spinner className="text-brand-500" /></div>
          ) : oppsQ.data?.length ? (
            <div className="flex flex-col gap-3">
              {oppsQ.data.map((opp: any) => {
                const days = Math.ceil((new Date(opp.application_deadline).getTime() - Date.now()) / 86400_000);
                return (
                  <Link key={opp.id} to={`/opportunities/${opp.id}`}
                    className="panel p-4 hover:bg-fill transition min-h-[72px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className="badge capitalize">{opp.type}</span>
                          <span className="badge capitalize">{opp.sport}</span>
                          <StatusPill status={opp.status} />
                        </div>
                        <div className="font-disp text-xl leading-tight">{opp.title}</div>
                        <div className="lab mt-1 text-[11px]">{opp.city}, {opp.country} · Age {opp.age_min}–{opp.age_max}</div>
                      </div>
                      <div className="font-mononum text-[11px] flex-shrink-0 mt-1"
                        style={{ color: days <= 5 ? "#FA4D14" : "#9A9286" }}>
                        {days < 0 ? "Closed" : days === 0 ? "Today" : `${days}d left`}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No open opportunities" hint="Nothing posted yet from this organization." />
          )}
        </div>

        {/* Info sidebar */}
        <aside className="space-y-4">
          <div className="card card-body space-y-3">
            <Kicker>About</Kicker>
            <div className="space-y-2.5 mt-3">
              <DetailRow icon={<MapPin className="h-4 w-4" />}
                value={[o.city, o.state, o.country].filter(Boolean).join(", ") || undefined} />
              {o.address && <DetailRow icon={<MapPin className="h-4 w-4" />} value={o.address} />}
              {o.year_established && <DetailRow icon={<Calendar className="h-4 w-4" />} value={`Est. ${o.year_established}`} />}
              {o.website && (
                <div className="flex items-start gap-2.5 text-[13.5px]">
                  <Globe className="h-4 w-4 flex-shrink-0 mt-0.5 text-ink-faint" />
                  <a href={o.website} target="_blank" rel="noopener noreferrer"
                    className="text-brand-500 hover:underline break-all">
                    {o.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>
          </div>

          {(o.contact_name || o.contact_email || o.contact_phone) && (
            <div className="card card-body space-y-3">
              <Kicker>Contact</Kicker>
              <div className="space-y-2.5 mt-3">
                {o.contact_name && (
                  <div className="text-[13.5px] font-semibold text-ink">{o.contact_name}</div>
                )}
                {o.contact_email && (
                  <a href={`mailto:${o.contact_email}`}
                    className="flex items-center gap-2.5 text-[13.5px] text-brand-500 hover:underline min-h-[44px]">
                    <Mail className="h-4 w-4 flex-shrink-0 text-ink-faint" />
                    {o.contact_email}
                  </a>
                )}
                {o.contact_phone && (
                  <a href={`tel:${o.contact_phone}`}
                    className="flex items-center gap-2.5 text-[13.5px] text-brand-500 hover:underline min-h-[44px]">
                    <Phone className="h-4 w-4 flex-shrink-0 text-ink-faint" />
                    {o.contact_phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Website button — full width on mobile */}
          {o.website && (
            <a
              href={o.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full min-h-[44px] flex items-center justify-center gap-2"
            >
              <Globe className="h-4 w-4" /> Visit website
            </a>
          )}

          {o.verification?.status === "approved" && (
            <div className="card card-body">
              <Kicker>Verification</Kicker>
              <div className="mt-3 flex items-center gap-2 text-[13.5px] text-emerald-700">
                <span className="text-lg">✓</span>
                <span>Verified organization</span>
              </div>
              {o.verification.badges?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.verification.badges.map((b: string) => (
                    <span key={b} className="badge capitalize">{b.replace(/_/g, " ")}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
