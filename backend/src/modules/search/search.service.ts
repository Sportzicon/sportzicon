import { prisma } from "../../config/prisma";
import type { User, Organization, Opportunity } from "@prisma/client";

// Phase 1: indexed SQL filters server-side + case-insensitive substring in-memory.
// Phase 2 upgrade path: replace in-memory text filter with pg full-text search (tsvector).

function rankPlayers(items: User[]) {
  return items.sort((a, b) => {
    const va = a.verification_status === "approved" ? 1 : 0;
    const vb = b.verification_status === "approved" ? 1 : 0;
    return va !== vb ? vb - va : b.updated_at.getTime() - a.updated_at.getTime();
  });
}

function rankOrgs(items: Organization[]) {
  return items.sort((a, b) => {
    const va = a.verification_status === "approved" ? 1 : 0;
    const vb = b.verification_status === "approved" ? 1 : 0;
    return va !== vb ? vb - va : b.updated_at.getTime() - a.updated_at.getTime();
  });
}

export async function searchPlayers(q: {
  q?: string;
  sport?: string;
  country?: string;
  state?: string;
  city?: string;
  gender?: string;
  age_min?: number;
  age_max?: number;
  experience_level?: string;
  availability?: string;
  verified?: boolean;
  limit: number;
}) {
  const where: Record<string, unknown> = { role: "athlete" };
  if (q.country) where.country = q.country;
  if (q.state) where.state = q.state;
  if (q.city) where.city = q.city;
  if (q.gender) where.gender = q.gender;
  if (q.verified) where.verification_status = "approved";

  let items = await prisma.user.findMany({
    where,
    take: Math.min(q.limit * 3, 500)
  });

  // In-memory filters for JSON fields and age
  if (q.sport) {
    items = items.filter((u) => {
      const d = u.athlete_data as Record<string, unknown> | null;
      return d?.primary_sport === q.sport;
    });
  }
  if (q.experience_level) {
    items = items.filter((u) => {
      const d = u.athlete_data as Record<string, unknown> | null;
      return d?.experience_level === q.experience_level;
    });
  }
  if (q.availability) {
    items = items.filter((u) => {
      const d = u.athlete_data as Record<string, unknown> | null;
      return d?.availability === q.availability;
    });
  }
  if (q.age_min != null || q.age_max != null) {
    items = items.filter((u) => {
      if (!u.dob) return false;
      const age = Math.floor((Date.now() - new Date(u.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
      if (q.age_min != null && age < q.age_min) return false;
      if (q.age_max != null && age > q.age_max) return false;
      return true;
    });
  }
  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter((u) => {
      const d = u.athlete_data as Record<string, unknown> | null;
      return (
        u.full_name_lower?.includes(needle) ||
        u.bio?.toLowerCase().includes(needle) ||
        String(d?.primary_sport ?? "").toLowerCase().includes(needle)
      );
    });
  }

  return rankPlayers(items).slice(0, q.limit).map(playerCard);
}

export async function searchClubs(q: {
  q?: string;
  sport?: string;
  country?: string;
  state?: string;
  city?: string;
  org_type?: string;
  verified?: boolean;
  limit: number;
}) {
  const where: Record<string, unknown> = {};
  if (q.country) where.country = q.country;
  if (q.state) where.state = q.state;
  if (q.city) where.city = q.city;
  if (q.org_type) where.org_type = q.org_type;
  if (q.verified) where.verification_status = "approved";

  let items = await prisma.organization.findMany({ where, take: Math.min(q.limit * 3, 500) });

  if (q.sport) items = items.filter((o) => o.sport_categories.includes(q.sport!));
  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter(
      (o) => o.org_name_lower?.includes(needle) || o.description?.toLowerCase().includes(needle)
    );
  }

  return rankOrgs(items).slice(0, q.limit);
}

export async function searchOpportunities(q: {
  q?: string;
  sport?: string;
  type?: string;
  country?: string;
  city?: string;
  status?: string;
  limit: number;
}) {
  const where: Record<string, unknown> = { status: q.status ?? "open" };
  if (q.sport) where.sport = q.sport;
  if (q.type) where.type = q.type;
  if (q.country) where.country = q.country;
  if (q.city) where.city = q.city;

  let items = await prisma.opportunity.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: Math.min(q.limit * 3, 500),
    include: { organization: { select: { org_name: true } } }
  });

  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter(
      (o) =>
        o.title_lower?.includes(needle) ||
        o.description?.toLowerCase().includes(needle) ||
        o.organization.org_name.toLowerCase().includes(needle)
    );
  }

  return items.slice(0, q.limit);
}

function playerCard(u: User) {
  const d = u.athlete_data as Record<string, unknown> | null;
  return {
    id: u.id,
    full_name: u.full_name,
    role: u.role,
    profile_photo_url: u.profile_photo_url,
    cover_photo_url: u.cover_photo_url,
    country: u.country,
    state: u.state,
    city: u.city,
    bio: u.bio,
    verification: { status: u.verification_status, badges: u.verification_badges },
    athlete: d
      ? {
          primary_sport: d.primary_sport,
          position: d.position,
          experience_level: d.experience_level,
          availability: d.availability
        }
      : undefined,
    follower_count: u.follower_count
  };
}
