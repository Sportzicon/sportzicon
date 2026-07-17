import { prisma } from "../../config/prisma";
import { Prisma } from "@prisma/client";
import { dateOnly } from "../opportunities/opportunities.service";

type PaginatedResult<T> = {
  data: T[];
  nextCursor: string | null;
  total: number;
};

type PlayerCard = {
  id: string;
  full_name: string;
  role: string;
  dob: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  bio: string | null;
  verification: { status: string; badges: string[] };
  athlete_data: Record<string, unknown> | undefined;
  follower_count: number;
};

type ClubRow = {
  id: string;
  org_name: string;
  org_type: string;
  description: string | null;
  logo_url: string | null;
  sport_categories: string[];
  city: string | null;
  country: string | null;
  verification_status: string;
  verification_badges: string[];
  updated_at: Date;
};

type OppRow = {
  id: string;
  title: string;
  type: string;
  sport: string;
  status: string;
  city: string;
  country: string;
  application_deadline: Date;
  vacancies: number | null;
  application_count: number;
  org_name: string;
  created_at: Date;
};

function encodeCursor(id: string, ts: Date): string {
  return Buffer.from(JSON.stringify({ id, ts: ts.toISOString() })).toString("base64url");
}

// plainto_tsquery only matches whole lexemes — "vaib" would never match a
// stored "vaibhav" lexeme. Build a prefix tsquery instead (":*" suffix per
// word) so partial/in-progress search terms match, same pattern Postgres
// docs recommend for autocomplete-style search.
function toPrefixTsQuery(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(" & ");
}

function decodeCursor(cursor: string): { id: string; ts: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function searchPlayers(q: {
  q?: string;
  sport?: string;
  sort?: string;
  cursor?: string;
  limit: number;
  country?: string;
  state?: string;
  city?: string;
  gender?: string;
  age_min?: number;
  age_max?: number;
  experience_level?: string;
  position?: string;
  available?: boolean;
  verified?: boolean;
}): Promise<PaginatedResult<PlayerCard>> {
  const limit = Math.min(q.limit, 50);
  const tsTerm = q.q?.trim() ? toPrefixTsQuery(q.q) : "";
  const hasFTS = Boolean(tsTerm);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`u.role = 'athlete'`,
    Prisma.sql`u.is_suspended IS NOT TRUE`,
    // Tighter default visibility for minors: exclude accounts still awaiting
    // guardian consent from recruiter-facing player search.
    Prisma.sql`NOT (u.is_minor AND u.guardian_consent_status = 'pending')`
  ];

  if (hasFTS) {
    conditions.push(
      Prisma.sql`u.search_vector @@ to_tsquery('english', ${tsTerm})`
    );
  }
  if (q.sport) {
    conditions.push(
      Prisma.sql`lower(u.athlete_data->>'primary_sport') = lower(${q.sport})`
    );
  }
  if (q.experience_level) {
    conditions.push(
      Prisma.sql`u.athlete_data->>'experience_level' = ${q.experience_level}`
    );
  }
  if (q.position) {
    conditions.push(
      Prisma.sql`lower(u.athlete_data->>'position') LIKE lower(${`%${q.position}%`})`
    );
  }
  if (q.available) {
    conditions.push(
      Prisma.sql`(u.athlete_data->>'availability' = 'available' OR u.athlete_data->>'availability' = 'open_to_offers')`
    );
  }
  if (q.verified) {
    conditions.push(Prisma.sql`u.verification_status = 'approved'`);
  }
  if (q.city) {
    conditions.push(Prisma.sql`lower(u.city) LIKE lower(${`%${q.city}%`})`);
  }
  if (q.country) {
    conditions.push(Prisma.sql`lower(u.country) LIKE lower(${`%${q.country}%`})`);
  }
  if (q.gender) {
    conditions.push(Prisma.sql`u.gender = ${q.gender}`);
  }
  if (q.age_min != null) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - q.age_min);
    conditions.push(Prisma.sql`u.dob::date <= ${cutoff.toISOString().slice(0, 10)}::date`);
  }
  if (q.age_max != null) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - q.age_max - 1);
    conditions.push(Prisma.sql`u.dob::date > ${cutoff.toISOString().slice(0, 10)}::date`);
  }

  const decoded = q.cursor ? decodeCursor(q.cursor) : null;
  if (decoded) {
    conditions.push(
      Prisma.sql`(u.updated_at < ${new Date(decoded.ts)}::timestamptz OR (u.updated_at = ${new Date(decoded.ts)}::timestamptz AND u.id::text < ${decoded.id}))`
    );
  }

  const where = Prisma.join(conditions, " AND ");

  const orderBy = hasFTS
    ? Prisma.sql`ts_rank(u.search_vector, to_tsquery('english', ${tsTerm})) DESC, (u.verification_status = 'approved') DESC, u.updated_at DESC, u.id DESC`
    : Prisma.sql`(u.verification_status = 'approved') DESC, u.updated_at DESC, u.id DESC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<(PlayerCard & { updated_at: Date; verification_status: string; verification_badges: string[] })[]>(
      Prisma.sql`
        SELECT u.id, u.full_name, u.role, u.dob,
               u.profile_photo_url, u.cover_photo_url,
               u.country, u.state, u.city, u.bio,
               u.verification_status, u.verification_badges,
               u.athlete_data, u.updated_at,
               (SELECT COUNT(*) FROM "Follow" f WHERE f.followee_id = u.id) AS follower_count
        FROM "User" u
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ${limit + 1}
      `
    ),
    prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`SELECT COUNT(*) as count FROM "User" u WHERE ${where}`
    ),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    data: page.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      role: u.role,
      dob: u.dob,
      profile_photo_url: u.profile_photo_url,
      cover_photo_url: u.cover_photo_url,
      country: u.country,
      state: u.state,
      city: u.city,
      bio: u.bio,
      verification: {
        status: u.verification_status,
        badges: (u.verification_badges as string[] | null) ?? [],
      },
      athlete_data: u.athlete_data as Record<string, unknown> | undefined,
      follower_count: Number(u.follower_count),
    })),
    nextCursor: hasMore && last ? encodeCursor(last.id, last.updated_at) : null,
    total: Number(countRows[0]?.count ?? 0),
  };
}

export async function searchUsers(q: {
  q: string;
  limit: number;
  excludeId?: string;
}): Promise<{ data: { id: string; full_name: string; role: string; profile_photo_url: string | null }[] }> {
  const term = `%${q.q.trim()}%`;
  const limit = Math.min(q.limit, 50);

  const rows = await prisma.$queryRaw<{ id: string; full_name: string; role: string; profile_photo_url: string | null }[]>(
    Prisma.sql`
      SELECT id, full_name, role, profile_photo_url
      FROM "User"
      WHERE lower(full_name) LIKE lower(${term})
        AND is_suspended IS NOT TRUE
        ${q.excludeId ? Prisma.sql`AND id <> ${q.excludeId}::uuid` : Prisma.sql``}
      ORDER BY full_name ASC
      LIMIT ${limit}
    `
  );

  return { data: rows };
}

export async function searchClubs(q: {
  q?: string;
  sport?: string;
  sort?: string;
  cursor?: string;
  limit: number;
  country?: string;
  state?: string;
  city?: string;
  org_type?: string;
  verified?: boolean;
}): Promise<PaginatedResult<ClubRow>> {
  const limit = Math.min(q.limit, 50);
  const tsTerm = q.q?.trim() ? toPrefixTsQuery(q.q) : "";
  const hasFTS = Boolean(tsTerm);

  const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];

  if (hasFTS) {
    conditions.push(
      Prisma.sql`o.search_vector @@ to_tsquery('english', ${tsTerm})`
    );
  }
  if (q.sport) {
    conditions.push(Prisma.sql`${q.sport} = ANY(o.sport_categories)`);
  }
  if (q.verified) {
    conditions.push(Prisma.sql`o.verification_status = 'approved'`);
  }
  if (q.city) {
    conditions.push(Prisma.sql`lower(o.city) LIKE lower(${`%${q.city}%`})`);
  }
  if (q.country) {
    conditions.push(Prisma.sql`lower(o.country) LIKE lower(${`%${q.country}%`})`);
  }
  if (q.org_type) {
    conditions.push(Prisma.sql`o.org_type = ${q.org_type}`);
  }

  const decoded = q.cursor ? decodeCursor(q.cursor) : null;
  if (decoded) {
    conditions.push(
      Prisma.sql`(o.updated_at < ${new Date(decoded.ts)}::timestamptz OR (o.updated_at = ${new Date(decoded.ts)}::timestamptz AND o.id::text < ${decoded.id}))`
    );
  }

  const where = Prisma.join(conditions, " AND ");

  const orderBy = hasFTS
    ? Prisma.sql`ts_rank(o.search_vector, to_tsquery('english', ${tsTerm})) DESC, (o.verification_status = 'approved') DESC, o.updated_at DESC, o.id DESC`
    : Prisma.sql`(o.verification_status = 'approved') DESC, o.updated_at DESC, o.id DESC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<(ClubRow & { updated_at: Date })[]>(
      Prisma.sql`
        SELECT o.id, o.org_name, o.org_type, o.description, o.logo_url,
               o.sport_categories, o.city, o.country,
               o.verification_status, o.verification_badges, o.updated_at
        FROM "Organization" o
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ${limit + 1}
      `
    ),
    prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`SELECT COUNT(*) as count FROM "Organization" o WHERE ${where}`
    ),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    data: page,
    nextCursor: hasMore && last ? encodeCursor(last.id, last.updated_at) : null,
    total: Number(countRows[0]?.count ?? 0),
  };
}

type OppRowOut = Omit<OppRow, "application_deadline"> & { application_deadline: string | null };

export async function searchOpportunities(q: {
  q?: string;
  sport?: string;
  sort?: string;
  cursor?: string;
  limit: number;
  country?: string;
  city?: string;
  type?: string;
  status?: string;
}): Promise<PaginatedResult<OppRowOut>> {
  const limit = Math.min(q.limit, 50);
  const tsTerm = q.q?.trim() ? toPrefixTsQuery(q.q) : "";
  const hasFTS = Boolean(tsTerm);
  const status = q.status ?? "open";

  const conditions: Prisma.Sql[] = [Prisma.sql`opp.status::text = ${status}`];

  if (hasFTS) {
    conditions.push(
      Prisma.sql`opp.search_vector @@ to_tsquery('english', ${tsTerm})`
    );
  }
  if (q.sport) {
    conditions.push(Prisma.sql`lower(opp.sport) = lower(${q.sport})`);
  }
  if (q.type) {
    conditions.push(Prisma.sql`opp.type::text = ${q.type}`);
  }
  if (q.city) {
    conditions.push(Prisma.sql`lower(opp.city) LIKE lower(${`%${q.city}%`})`);
  }
  if (q.country) {
    conditions.push(Prisma.sql`lower(opp.country) LIKE lower(${`%${q.country}%`})`);
  }

  const decoded = q.cursor ? decodeCursor(q.cursor) : null;
  if (decoded) {
    if (q.sort === "deadline") {
      conditions.push(
        Prisma.sql`(opp.application_deadline > ${decoded.ts} OR (opp.application_deadline = ${decoded.ts} AND opp.id::text > ${decoded.id}))`
      );
    } else {
      conditions.push(
        Prisma.sql`(opp.created_at < ${new Date(decoded.ts)}::timestamptz OR (opp.created_at = ${new Date(decoded.ts)}::timestamptz AND opp.id::text < ${decoded.id}))`
      );
    }
  }

  const where = Prisma.join(conditions, " AND ");

  const orderExpr =
    q.sort === "deadline"
      ? Prisma.sql`opp.application_deadline ASC, opp.id ASC`
      : hasFTS
        ? Prisma.sql`ts_rank(opp.search_vector, to_tsquery('english', ${tsTerm})) DESC, opp.created_at DESC, opp.id DESC`
        : Prisma.sql`opp.created_at DESC, opp.id DESC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<(OppRow & { created_at: Date })[]>(
      Prisma.sql`
        SELECT opp.id, opp.title, opp.type, opp.sport, opp.status,
               opp.city, opp.country, opp.application_deadline,
               opp.vacancies, opp.application_count,
               opp.created_at,
               org.org_name
        FROM "Opportunity" opp
        JOIN "Organization" org ON opp.org_id = org.id
        WHERE ${where}
        ORDER BY ${orderExpr}
        LIMIT ${limit + 1}
      `
    ),
    prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*) as count
        FROM "Opportunity" opp
        JOIN "Organization" org ON opp.org_id = org.id
        WHERE ${where}
      `
    ),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  const nextCursorVal = hasMore && last
    ? (q.sort === "deadline"
        ? encodeCursor(last.id, new Date(last.application_deadline))
        : encodeCursor(last.id, last.created_at))
    : null;

  return {
    data: page.map((r) => ({ ...r, application_deadline: dateOnly(r.application_deadline) })),
    nextCursor: nextCursorVal,
    total: Number(countRows[0]?.count ?? 0),
  };
}
