// Seeds the local Firestore emulator with demo data so a fresh developer can
// poke around the UI immediately. Idempotent — safe to re-run.
import { db, Collections } from "../config/firestore";
import { hashPassword } from "../modules/auth/tokens";
import { newId, now } from "../utils/ids";
import { logger } from "../config/logger";
import type {
  ApplicationDoc,
  BlogDoc,
  OpportunityDoc,
  OrganizationDoc,
  PostDoc,
  ReelDoc,
  UserDoc
} from "../types/domain";

const DEMO_PASSWORD = "Demo1234!";

async function makeUser(overrides: Partial<UserDoc>): Promise<UserDoc> {
  const id = newId();
  const email = overrides.email ?? `${id.slice(0, 8)}@demo.sportivox`;
  const password_hash = await hashPassword(DEMO_PASSWORD);
  const u: UserDoc = {
    id,
    email,
    email_lower: email.toLowerCase(),
    email_verified: true,
    phone: overrides.phone ?? `+9100000${Math.floor(Math.random() * 10000)}`,
    phone_verified: true,
    password_hash,
    full_name: overrides.full_name ?? "Demo User",
    full_name_lower: (overrides.full_name ?? "Demo User").toLowerCase(),
    role: overrides.role ?? "athlete",
    status: "active",
    verification: overrides.verification ?? { badges: [], status: "unverified" },
    follower_count: 0,
    following_count: 0,
    created_at: now(),
    updated_at: now(),
    last_active_at: now(),
    ...overrides
  };
  await db.collection(Collections.users).doc(id).set(u);
  return u;
}

async function main() {
  logger.info("Seeding Sportivox demo data...");

  const admin = await makeUser({
    email: "admin@sportivox.local",
    full_name: "Sportivox Admin",
    role: "admin",
    verification: { badges: ["verified_admin"], status: "approved" }
  });

  const athlete = await makeUser({
    email: "athlete@demo.sportivox",
    full_name: "Aria Patel",
    role: "athlete",
    bio: "Right-back, Bengaluru. Looking for academy trials.",
    country: "India",
    state: "Karnataka",
    city: "Bengaluru",
    dob: "2004-04-12",
    gender: "female",
    verification: { badges: ["verified_player"], status: "approved" },
    athlete: {
      primary_sport: "Football",
      position: "Right Back",
      experience_level: "amateur",
      height_cm: 168,
      weight_kg: 58,
      availability: "open_to_offers",
      looking_for_club: true,
      stats: { matches: 32, goals: 3, assists: 11 }
    }
  });

  const athlete2 = await makeUser({
    email: "athlete2@demo.sportivox",
    full_name: "Rohan Singh",
    role: "athlete",
    bio: "Striker, Mumbai. Trials this season.",
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    dob: "2003-09-04",
    gender: "male",
    athlete: {
      primary_sport: "Football",
      position: "Striker",
      experience_level: "semi_pro",
      stats: { matches: 41, goals: 24, assists: 8 }
    }
  });

  const clubOwner = await makeUser({
    email: "club@demo.sportivox",
    full_name: "City FC Manager",
    role: "club",
    country: "India",
    state: "Karnataka",
    city: "Bengaluru"
  });

  const scout = await makeUser({
    email: "scout@demo.sportivox",
    full_name: "Veer Kapoor",
    role: "scout",
    bio: "Independent scout — youth football, west India.",
    country: "India",
    state: "Maharashtra",
    city: "Mumbai"
  });

  // Org
  const orgId = newId();
  const org: OrganizationDoc = {
    id: orgId,
    owner_user_id: clubOwner.id,
    org_name: "City FC Academy",
    org_name_lower: "city fc academy",
    org_type: "academy",
    description: "Tier-1 youth football academy in Bengaluru.",
    sport_categories: ["Football"],
    country: "India",
    state: "Karnataka",
    city: "Bengaluru",
    contact_email: "ops@cityfc.demo",
    contact_phone: "+910000000000",
    verification: { status: "approved", badges: ["verified_academy"] },
    subscription_plan: "free",
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.organizations).doc(orgId).set(org);

  // Opportunity
  const oppId = newId();
  const opp: OpportunityDoc = {
    id: oppId,
    org_id: orgId,
    org_name: org.org_name,
    posted_by_user_id: clubOwner.id,
    title: "U-19 Football Trials, October Intake",
    title_lower: "u-19 football trials, october intake",
    type: "trial",
    sport: "Football",
    description: "Open trials for the U-19 squad. Bring boots and ID.",
    eligibility: "Born between 2005-2008. Must have played at school or club level.",
    age_min: 16,
    age_max: 19,
    gender_eligibility: "all",
    experience_level_required: "amateur",
    country: "India",
    state: "Karnataka",
    city: "Bengaluru",
    start_date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
    application_deadline: new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10),
    vacancies: 5,
    vacancies_filled: 0,
    contact_email: org.contact_email,
    contact_phone: org.contact_phone,
    status: "open",
    application_count: 0,
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.opportunities).doc(oppId).set(opp);

  // One application
  const appId = newId();
  const application: ApplicationDoc = {
    id: appId,
    opportunity_id: oppId,
    opportunity_title: opp.title,
    org_id: orgId,
    applicant_user_id: athlete.id,
    applicant_name: athlete.full_name,
    cover_note: "Excited to trial. Highlights attached.",
    documents: [],
    status: "pending",
    history: [{ status: "pending", at: now(), by: athlete.id }],
    applied_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.applications).doc(appId).set(application);

  // Posts (activity logs)
  const post: PostDoc = {
    id: newId(),
    author_id: athlete.id,
    author_name: athlete.full_name,
    author_role: athlete.role,
    type: "log",
    text: "Morning conditioning + tactical drills. 6km easy run + 4x400m intervals.",
    sport: "Football",
    tags: ["training", "conditioning"],
    like_count: 0,
    comment_count: 0,
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.posts).doc(post.id).set(post);

  // Reel
  const reel: ReelDoc = {
    id: newId(),
    author_id: athlete.id,
    author_name: athlete.full_name,
    caption: "Free-kick drill - left foot",
    video_url: "https://storage.googleapis.com/demo/reel.mp4",
    sport: "Football",
    duration_seconds: 12,
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    created_at: now()
  };
  await db.collection(Collections.reels).doc(reel.id).set(reel);

  // Blog
  const blog: BlogDoc = {
    id: newId(),
    author_id: scout.id,
    author_name: scout.full_name,
    title: "What scouts actually look for at U-19 trials",
    title_lower: "what scouts actually look for at u-19 trials",
    slug: "what-scouts-look-for-u19",
    excerpt: "Five years of scouting experience boiled down to one question: can you do it under fatigue?",
    body_markdown: "# What scouts look for\n\nGreat first touch, decision speed, attitude when tired.\n\n## 1. First touch\n...",
    tags: ["scouting", "trials"],
    sport: "Football",
    status: "published",
    like_count: 0,
    comment_count: 0,
    view_count: 0,
    published_at: now(),
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.blogs).doc(blog.id).set(blog);

  logger.info({
    admin: admin.email,
    athlete: athlete.email,
    athlete2: athlete2.email,
    club: clubOwner.email,
    scout: scout.email,
    password: DEMO_PASSWORD,
    org: org.org_name,
    opportunity: opp.title
  }, "Seed complete. Use any demo email + password to log in.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "seed failed");
    process.exit(1);
  });
