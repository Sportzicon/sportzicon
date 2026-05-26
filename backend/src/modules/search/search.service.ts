import { db, Collections } from "../../config/firestore";
import type { OpportunityDoc, OrganizationDoc, UserDoc } from "../../types/domain";

// NOTE: Firestore has no native full-text search. For Phase 1 we do:
//   1. Indexed equality / range filters server-side.
//   2. A simple case-insensitive substring filter applied in-memory for keyword `q`.
// This works fine up to a few thousand candidates. The SRS Section 3.3 calls
// out Algolia/Elasticsearch as the Phase-2 upgrade path; the API shape here
// is compatible with either.

const ranked = <T extends { verification?: { status?: string }; updated_at?: number }>(items: T[]) => {
  return items
    .slice()
    .sort((a, b) => {
      const va = a.verification?.status === "approved" ? 1 : 0;
      const vb = b.verification?.status === "approved" ? 1 : 0;
      if (va !== vb) return vb - va;
      return (b.updated_at ?? 0) - (a.updated_at ?? 0);
    });
};

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
  let query: FirebaseFirestore.Query = db
    .collection(Collections.users)
    .where("role", "==", "athlete");
  if (q.country) query = query.where("country", "==", q.country);
  if (q.state) query = query.where("state", "==", q.state);
  if (q.city) query = query.where("city", "==", q.city);
  if (q.gender) query = query.where("gender", "==", q.gender);
  if (q.sport) query = query.where("athlete.primary_sport", "==", q.sport);
  if (q.experience_level) query = query.where("athlete.experience_level", "==", q.experience_level);
  if (q.availability) query = query.where("athlete.availability", "==", q.availability);
  query = query.limit(Math.min(q.limit * 3, 500));

  const snap = await query.get();
  let items = snap.docs.map((d) => d.data() as UserDoc);

  if (q.verified) items = items.filter((u) => u.verification?.status === "approved");
  if (q.age_min || q.age_max) {
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
    items = items.filter(
      (u) =>
        u.full_name_lower?.includes(needle) ||
        (u.bio?.toLowerCase().includes(needle) ?? false) ||
        (u.athlete?.primary_sport?.toLowerCase().includes(needle) ?? false)
    );
  }

  const sorted = ranked(items).slice(0, q.limit);
  return sorted.map((u) => publicCard(u));
}

export async function searchClubs(q: {
  q?: string;
  sport?: string;
  country?: string;
  state?: string;
  city?: string;
  org_type?: "club" | "academy" | "both";
  verified?: boolean;
  limit: number;
}) {
  let query: FirebaseFirestore.Query = db.collection(Collections.organizations);
  if (q.country) query = query.where("country", "==", q.country);
  if (q.state) query = query.where("state", "==", q.state);
  if (q.city) query = query.where("city", "==", q.city);
  if (q.org_type) query = query.where("org_type", "==", q.org_type);
  query = query.limit(Math.min(q.limit * 3, 500));

  const snap = await query.get();
  let items = snap.docs.map((d) => d.data() as OrganizationDoc);
  if (q.sport) items = items.filter((o) => o.sport_categories?.includes(q.sport!));
  if (q.verified) items = items.filter((o) => o.verification?.status === "approved");
  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter(
      (o) =>
        o.org_name_lower?.includes(needle) ||
        (o.description?.toLowerCase().includes(needle) ?? false)
    );
  }
  return ranked(items).slice(0, q.limit);
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
  let query: FirebaseFirestore.Query = db.collection(Collections.opportunities);
  query = query.where("status", "==", q.status ?? "open");
  if (q.sport) query = query.where("sport", "==", q.sport);
  if (q.type) query = query.where("type", "==", q.type);
  if (q.country) query = query.where("country", "==", q.country);
  if (q.city) query = query.where("city", "==", q.city);
  query = query.orderBy("created_at", "desc").limit(Math.min(q.limit * 3, 500));

  const snap = await query.get();
  let items = snap.docs.map((d) => d.data() as OpportunityDoc);
  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter(
      (o) =>
        o.title_lower?.includes(needle) ||
        (o.description?.toLowerCase().includes(needle) ?? false) ||
        (o.org_name?.toLowerCase().includes(needle) ?? false)
    );
  }
  return items.slice(0, q.limit);
}

function publicCard(u: UserDoc) {
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
    verification: u.verification,
    athlete: u.athlete
      ? {
          primary_sport: u.athlete.primary_sport,
          position: u.athlete.position,
          experience_level: u.athlete.experience_level,
          availability: u.athlete.availability
        }
      : undefined,
    follower_count: u.follower_count
  };
}
