// Seeds the local PostgreSQL database with demo data sourced from the
// official Sportivox design prototypes (Zip 2 & 3 data.jsx files).
// Idempotent — safe to re-run (truncates all data first).
import { PrismaClient, Role, VerificationStatus, OpportunityType, ApplicationStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo1234!";

function daysAgo(n: number): Date { return new Date(Date.now() - n * 86400_000); }
function daysFromNow(n: number): string { return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10); }
function hoursAgo(n: number): Date { return new Date(Date.now() - n * 3600_000); }

async function truncateAll() {
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.blogLike.deleteMany();
  await prisma.reelLike.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.reel.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.application.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
}

type UserInput = {
  email: string;
  full_name: string;
  role: Role;
  bio?: string;
  country?: string;
  state?: string;
  city?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  verification_status?: VerificationStatus;
  verification_badges?: string[];
  athlete_data?: Record<string, unknown>;
};

async function makeUser(input: UserInput) {
  const email = input.email;
  const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.create({
    data: {
      email,
      email_lower: email.toLowerCase(),
      email_verified: true,
      phone: input.phone ?? `+9100000${Math.floor(Math.random() * 90000) + 10000}`,
      phone_verified: true,
      password_hash,
      full_name: input.full_name,
      full_name_lower: input.full_name.toLowerCase(),
      role: input.role,
      status: "active",
      bio: input.bio,
      country: input.country,
      state: input.state,
      city: input.city,
      dob: input.dob,
      gender: input.gender,
      verification_status: input.verification_status ?? "unverified",
      verification_badges: input.verification_badges ?? [],
      athlete_data: input.athlete_data as object ?? undefined
    }
  });
}

type OrgInput = {
  org_name: string;
  org_type: string;
  description?: string;
  sport_categories?: string[];
  country?: string;
  state?: string;
  city?: string;
  contact_email?: string;
  contact_phone?: string;
  verification_status?: VerificationStatus;
  verification_badges?: string[];
};

async function makeOrg(ownerUser: { id: string }, input: OrgInput) {
  return prisma.organization.create({
    data: {
      owner_user_id: ownerUser.id,
      org_name: input.org_name,
      org_name_lower: input.org_name.toLowerCase(),
      org_type: input.org_type,
      description: input.description,
      sport_categories: input.sport_categories ?? [],
      country: input.country ?? "India",
      state: input.state,
      city: input.city,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      verification_status: input.verification_status ?? "unverified",
      verification_badges: input.verification_badges ?? [],
      subscription_plan: "free"
    }
  });
}

type OppInput = {
  title: string;
  type: OpportunityType;
  sport: string;
  description: string;
  eligibility?: string;
  age_min: number;
  age_max: number;
  gender_eligibility?: string;
  experience_level_required?: string;
  start_date: string;
  end_date: string;
  application_deadline: string;
  vacancies?: number;
  vacancies_filled?: number;
  status?: "open" | "closed" | "filled";
  application_count?: number;
};

async function makeOpportunity(
  org: { id: string; country?: string | null; state?: string | null; city?: string | null; contact_email?: string | null; contact_phone?: string | null },
  poster: { id: string },
  input: OppInput
) {
  return prisma.opportunity.create({
    data: {
      org_id: org.id,
      posted_by_user_id: poster.id,
      title: input.title,
      title_lower: input.title.toLowerCase(),
      type: input.type,
      sport: input.sport,
      description: input.description,
      eligibility: input.eligibility,
      age_min: input.age_min,
      age_max: input.age_max,
      gender_eligibility: input.gender_eligibility ?? "all",
      experience_level_required: input.experience_level_required ?? "any",
      country: org.country ?? "India",
      state: org.state ?? "",
      city: org.city ?? "",
      start_date: input.start_date,
      end_date: input.end_date,
      application_deadline: input.application_deadline,
      vacancies: input.vacancies,
      vacancies_filled: input.vacancies_filled ?? 0,
      contact_email: org.contact_email,
      contact_phone: org.contact_phone,
      status: input.status ?? "open",
      application_count: input.application_count ?? 0
    }
  });
}

async function makeApplication(
  opp: { id: string; posted_by_user_id: string; title: string },
  applicant: { id: string },
  status: ApplicationStatus,
  coverNote: string,
  rejectionReason?: string
) {
  const history: Array<{ status: string; at: Date; by: string; note?: string }> = [
    { status: "pending", at: daysAgo(6), by: applicant.id }
  ];
  if (["shortlisted", "selected", "rejected"].includes(status)) {
    history.push({ status: "shortlisted", at: daysAgo(2), by: opp.posted_by_user_id, note: "Strong all-round record — invited to conditioning camp." });
  }
  if (status === "selected") {
    history.push({ status: "selected", at: daysAgo(1), by: opp.posted_by_user_id });
  }
  if (status === "rejected") {
    history.push({ status: "rejected", at: daysAgo(1), by: opp.posted_by_user_id, note: rejectionReason ?? "Outside experience window." });
  }

  return prisma.application.create({
    data: {
      opportunity_id: opp.id,
      applicant_user_id: applicant.id,
      cover_note: coverNote,
      documents: [],
      status,
      rejection_reason: status === "rejected" ? (rejectionReason ?? "Outside experience window.") : undefined,
      history: history as object[],
      applied_at: daysAgo(6)
    }
  });
}

async function makePost(author: { id: string }, text: string, sport: string, type: "post" | "log", likeCount = 0, commentCount = 0) {
  return prisma.post.create({
    data: {
      author_id: author.id,
      type,
      text,
      sport,
      tags: [sport.toLowerCase(), type === "log" ? "training" : "update"],
      like_count: likeCount,
      comment_count: commentCount
    }
  });
}

async function makeReel(author: { id: string }, caption: string, sport: string, likeCount = 0) {
  const SAMPLE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  return prisma.reel.create({
    data: {
      author_id: author.id,
      caption,
      video_url: SAMPLE,
      sport,
      duration_seconds: Math.floor(Math.random() * 40) + 10,
      view_count: Math.floor(Math.random() * 900) + 80,
      like_count: likeCount,
      comment_count: Math.floor(Math.random() * 18)
    }
  });
}

async function makeBlog(author: { id: string }, title: string, sport: string, tags: string[], body: string, excerpt: string) {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 55)}-${Math.random().toString(36).slice(2, 7)}`;
  return prisma.blog.create({
    data: {
      author_id: author.id,
      title,
      slug,
      excerpt,
      body_markdown: body,
      tags,
      sport,
      status: "published",
      like_count: Math.floor(Math.random() * 80) + 10,
      comment_count: Math.floor(Math.random() * 14),
      view_count: Math.floor(Math.random() * 600) + 60,
      published_at: new Date()
    }
  });
}

async function makeConversation(participantIds: string[], lastMessageBody: string, lastMessageSenderId: string, lastMessageAt: Date, unreadCounts: Record<string, number>, createdAt: Date) {
  return prisma.conversation.create({
    data: {
      participant_ids: participantIds,
      last_message: { body: lastMessageBody, sender_id: lastMessageSenderId, created_at: lastMessageAt },
      unread_counts: unreadCounts as object,
      created_at: createdAt,
      updated_at: lastMessageAt
    }
  });
}

async function sendMessage(convId: string, senderId: string, recipientId: string, body: string, createdAt: Date) {
  return prisma.message.create({
    data: {
      conversation_id: convId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
      created_at: createdAt
    }
  });
}

async function main() {
  console.log("Truncating existing data…");
  await truncateAll();
  console.log("Seeding Sportivox with design-prototype data…");

  // ── Admin ──────────────────────────────────────────────────────────────────
  await makeUser({
    email: "admin@sportivox.local",
    full_name: "Sportivox Admin",
    role: "admin",
    verification_status: "approved",
    verification_badges: ["verified_admin"]
  });

  // ── HERO ATHLETE: Arjun Mehta ──────────────────────────────────────────────
  const arjun = await makeUser({
    email: "athlete@demo.sportivox",
    full_name: "Arjun Mehta",
    role: "athlete",
    bio: "All-rounder with 6 seasons of state-level cricket. Top-order batter who bowls off-spin in the middle overs. Looking for a domestic contract for the upcoming season.",
    country: "India", state: "Maharashtra", city: "Pune",
    dob: "2000-03-15", gender: "male",
    verification_status: "approved",
    verification_badges: ["verified_player", "verified_stats", "coach_endorsed"],
    athlete_data: {
      primary_sport: "Cricket",
      position: "All-rounder",
      batting_style: "Right-hand bat",
      bowling_style: "Right-arm off-break",
      experience_level: "semi_pro",
      height_cm: 182, weight_kg: 76,
      availability: "open_to_offers",
      looking_for_club: true,
      stats: {
        matches: 142, runs: 4820, bat_avg: 38.25, strike_rate: 91.40,
        hundreds: 12, fifties: 28,
        wickets: 187, economy: 6.8, bowl_avg: 24.10, best_figures: "5/23"
      },
      achievements: [
        { title: "Maharashtra Player of the Season", year: 2024, verified: true },
        { title: "Ranji Trophy — Most Sixes", year: 2023, verified: true },
        { title: "U-23 State Captain", year: 2022, verified: false }
      ],
      career_history: [
        { club: "Maharashtra State XI", from: "2023-01", to: null, current: true },
        { club: "Pune Warriors U-23", from: "2021-04", to: "2022-12", current: false },
        { club: "DY Patil Academy", from: "2018-06", to: "2021-03", current: false },
        { club: "Maharashtra U-19", from: "2019-01", to: "2020-03", current: false }
      ]
    }
  });

  // ── Other Athletes ─────────────────────────────────────────────────────────
  const imran = await makeUser({
    email: "athlete2@demo.sportivox",
    full_name: "Imran Qureshi",
    role: "athlete",
    bio: "Right-arm fast bowler. 204 wickets. Economy 4.9. New-ball specialist looking for domestic contract.",
    country: "India", state: "Telangana", city: "Hyderabad",
    dob: "2002-06-11", gender: "male",
    verification_status: "approved",
    verification_badges: ["verified_player"],
    athlete_data: {
      primary_sport: "Cricket", position: "Fast Bowler", bowling_style: "Right-arm fast",
      experience_level: "semi_pro", height_cm: 186, weight_kg: 80,
      availability: "open_to_offers", looking_for_club: true,
      stats: { matches: 98, wickets: 204, economy: 4.9, bowl_avg: 19.2, best_figures: "6/18" }
    }
  });

  const dev = await makeUser({
    email: "cricket-dev@demo.sportivox",
    full_name: "Dev Sharma",
    role: "athlete",
    bio: "Aggressive opener from Delhi. Academy graduate ready for state exposure. Strike rate 142, HS 167.",
    country: "India", state: "Delhi", city: "Delhi",
    dob: "2005-09-01", gender: "male",
    athlete_data: {
      primary_sport: "Cricket", position: "Opener", batting_style: "Right-hand bat",
      experience_level: "amateur", height_cm: 174, weight_kg: 68,
      availability: "available", looking_for_club: true,
      stats: { matches: 45, runs: 1820, bat_avg: 32.4, strike_rate: 142.0, highest_score: 167 }
    }
  });

  const kabir = await makeUser({
    email: "cricket-wk@demo.sportivox",
    full_name: "Kabir Nair",
    role: "athlete",
    bio: "Keeper-batter with national experience. 188 dismissals. Available immediately for domestic contracts.",
    country: "India", state: "Kerala", city: "Kochi",
    dob: "1998-04-22", gender: "male",
    verification_status: "approved",
    verification_badges: ["verified_player", "verified_stats"],
    athlete_data: {
      primary_sport: "Cricket", position: "Wicket-keeper", batting_style: "Right-hand bat",
      experience_level: "professional", height_cm: 172, weight_kg: 70,
      availability: "available", looking_for_club: false,
      stats: { matches: 124, dismissals: 188, runs: 2840, bat_avg: 29.1 }
    }
  });

  const vikram = await makeUser({
    email: "cricket-bat@demo.sportivox",
    full_name: "Vikram Singh",
    role: "athlete",
    bio: "Middle-order anchor. 18 first-class hundreds. Bat avg 44.1. Looking to relocate for a domestic deal.",
    country: "India", state: "Rajasthan", city: "Jaipur",
    dob: "1996-11-30", gender: "male",
    verification_status: "approved",
    verification_badges: ["verified_player"],
    athlete_data: {
      primary_sport: "Cricket", position: "Middle order", batting_style: "Right-hand bat",
      experience_level: "semi_pro", height_cm: 178, weight_kg: 74,
      availability: "open_to_offers", looking_for_club: true,
      stats: { matches: 139, runs: 5620, bat_avg: 44.1, hundreds: 18, fifties: 31 }
    }
  });

  const rohanPillai = await makeUser({
    email: "football-winger@demo.sportivox",
    full_name: "Rohan Pillai",
    role: "athlete",
    bio: "Winger from Goa. 34 goals, 22 assists in state league. Fast and direct. Open to pro offers.",
    country: "India", state: "Goa", city: "Margao",
    dob: "2003-07-04", gender: "male",
    verification_status: "approved",
    verification_badges: ["verified_player"],
    athlete_data: {
      primary_sport: "Football", position: "Winger",
      experience_level: "semi_pro", height_cm: 170, weight_kg: 65,
      availability: "open_to_offers", looking_for_club: true,
      stats: { matches: 68, goals: 34, assists: 22 }
    }
  });

  const sara = await makeUser({
    email: "football-gk@demo.sportivox",
    full_name: "Sara Lewis",
    role: "athlete",
    bio: "Goalkeeper, 41 clean sheets in state football. Strong on crosses and penalty stops. Open to offers.",
    country: "India", state: "Karnataka", city: "Bengaluru",
    dob: "2001-01-18", gender: "female",
    verification_status: "approved",
    verification_badges: ["verified_player"],
    athlete_data: {
      primary_sport: "Football", position: "Goalkeeper",
      experience_level: "semi_pro", height_cm: 175, weight_kg: 67,
      availability: "available", looking_for_club: false,
      stats: { matches: 82, clean_sheets: 41, saves: 234 }
    }
  });

  const aditi = await makeUser({
    email: "athletics@demo.sportivox",
    full_name: "Aditi Rao",
    role: "athlete",
    bio: "National-level sprinter. 100m PB 11.42s. Training for 2026 nationals. Open to academy moves.",
    country: "India", state: "Tamil Nadu", city: "Chennai",
    dob: "2004-05-09", gender: "female",
    verification_status: "approved",
    verification_badges: ["verified_player", "verified_stats"],
    athlete_data: {
      primary_sport: "Athletics", position: "100m / 200m Sprinter",
      experience_level: "professional", height_cm: 166, weight_kg: 55,
      availability: "open_to_offers", looking_for_club: false,
      stats: { "100m_pb": "11.42", "200m_pb": "23.18", competitions: 38, medals: 11 },
      achievements: [
        { title: "National Junior Champion — 100m", year: 2023, verified: true },
        { title: "South Zone Record Holder — 200m", year: 2024, verified: true }
      ]
    }
  });

  // ── Scouts / Coaches / Managers ────────────────────────────────────────────
  const maya = await makeUser({
    email: "scout@demo.sportivox",
    full_name: "Maya Iyer",
    role: "scout",
    bio: "Talent scout for Maharashtra State XI. 5 years identifying domestic cricket talent across Maharashtra.",
    country: "India", state: "Maharashtra", city: "Pune"
  });

  const sandeep = await makeUser({
    email: "coach@demo.sportivox",
    full_name: "Sandeep Joshi",
    role: "scout",
    bio: "Head Coach — Maharashtra State XI. BCCI Level-3 certified. Coach endorsements available for deserving athletes.",
    country: "India", state: "Maharashtra", city: "Pune"
  });

  const clubManager = await makeUser({
    email: "club@demo.sportivox",
    full_name: "Mumbai Strikers Manager",
    role: "club",
    country: "India", state: "Maharashtra", city: "Mumbai"
  });

  const dyPatilManager = await makeUser({
    email: "academy@demo.sportivox",
    full_name: "DY Patil Academy Director",
    role: "organizer",
    country: "India", state: "Maharashtra", city: "Pune"
  });

  const margaoFCManager = await makeUser({
    email: "margao@demo.sportivox",
    full_name: "Margao FC Manager",
    role: "club",
    country: "India", state: "Goa", city: "Margao"
  });

  const puneLeagueOrg = await makeUser({
    email: "puneleague@demo.sportivox",
    full_name: "Pune Cricket League",
    role: "organizer",
    country: "India", state: "Maharashtra", city: "Pune"
  });

  // ── Organizations ──────────────────────────────────────────────────────────
  const maharashtraXI = await makeOrg(maya, {
    org_name: "Maharashtra State XI",
    org_type: "club",
    description: "Premier state cricket club representing Maharashtra in Ranji, T20 and ODI domestic formats. Producing national-level talent since 1948.",
    sport_categories: ["Cricket"],
    country: "India", state: "Maharashtra", city: "Pune",
    contact_email: "ops@msxi.demo",
    contact_phone: "+912000000001",
    verification_status: "approved",
    verification_badges: ["verified_club"]
  });

  const mumbaiStrikers = await makeOrg(clubManager, {
    org_name: "Mumbai Strikers",
    org_type: "club",
    description: "Mumbai-based T20 franchise. Scouts across Maharashtra for U-23 fast bowling talent.",
    sport_categories: ["Cricket"],
    country: "India", state: "Maharashtra", city: "Mumbai",
    contact_email: "ops@mumbaistrikers.demo",
    verification_status: "approved",
    verification_badges: ["verified_club"]
  });

  const dyPatil = await makeOrg(dyPatilManager, {
    org_name: "DY Patil Academy",
    org_type: "academy",
    description: "Top-tier multi-sport residential academy. Sports scholarships for cricket, football and athletics. BCCI-affiliated coaching.",
    sport_categories: ["Cricket", "Football", "Athletics"],
    country: "India", state: "Maharashtra", city: "Pune",
    contact_email: "admissions@dypatil.demo",
    contact_phone: "+912000000002",
    verification_status: "approved",
    verification_badges: ["verified_academy"]
  });

  const margaoFC = await makeOrg(margaoFCManager, {
    org_name: "Margao FC",
    org_type: "club",
    description: "Goa Pro League club seeking quick attacking wingers. Youth development programme running alongside senior team.",
    sport_categories: ["Football"],
    country: "India", state: "Goa", city: "Margao",
    contact_email: "ops@margaofc.demo",
    verification_status: "pending",
    verification_badges: []
  });

  const puneLeague = await makeOrg(puneLeagueOrg, {
    org_name: "Pune Cricket League",
    org_type: "both",
    description: "Organiser of the City T20 Championship — annual 16-team knockout tournament across 4 weekends.",
    sport_categories: ["Cricket"],
    country: "India", state: "Maharashtra", city: "Pune",
    contact_email: "register@puneleague.demo",
    verification_status: "approved",
    verification_badges: ["verified_institution"]
  });

  // ── Opportunities ──────────────────────────────────────────────────────────
  const seniorTrial = await makeOpportunity(maharashtraXI, maya, {
    title: "Senior Men's Trial — Maharashtra State XI",
    type: "trial",
    sport: "Cricket",
    description: "Open trial for the upcoming Ranji & T20 domestic season. We are looking for top-order batters, an off-spin all-rounder, and a wicket-keeper. Selected players join a 3-week conditioning camp before squad announcement.\n\nDay 1: Skill assessment — batting nets, bowling spells, keeping drills.\nDay 2: Match simulation — full 40-over match with selectors observing.\n\nShortlisted players will be notified within 48 hours.",
    eligibility: "State or semi-professional experience. Minimum 30 competitive matches. Must provide stats with coach endorsement.",
    age_min: 18, age_max: 28,
    gender_eligibility: "male",
    experience_level_required: "semi_pro",
    start_date: daysFromNow(7), end_date: daysFromNow(9),
    application_deadline: daysFromNow(4),
    vacancies: 6, vacancies_filled: 1,
    status: "open", application_count: 42
  });

  const u23FastBowler = await makeOpportunity(mumbaiStrikers, clubManager, {
    title: "U-23 Fast Bowler Recruitment",
    type: "recruitment",
    sport: "Cricket",
    description: "Recruiting two right-arm fast bowlers for the U-23 squad. Pace and fitness are the priority. Successful recruits will be on contract for the full T20 season with a path to the senior squad.",
    eligibility: "Under 23. Genuine pace — 135+ kph preferred. Must have district or state level experience.",
    age_min: 18, age_max: 23,
    gender_eligibility: "male",
    experience_level_required: "amateur",
    start_date: daysFromNow(12), end_date: daysFromNow(13),
    application_deadline: daysFromNow(8),
    vacancies: 2, vacancies_filled: 0,
    status: "open", application_count: 67
  });

  const dyScholarship = await makeOpportunity(dyPatil, dyPatilManager, {
    title: "Sports Scholarship 2026 — DY Patil Full Residential",
    type: "scholarship",
    sport: "Multi-sport",
    description: "Full and partial sports scholarships across cricket, football and athletics. Includes residential coaching, sports science support, nutrition guidance, and academic studies integration.\n\nApplications are shortlisted based on performance records and an in-person assessment day.",
    eligibility: "Age 16–21. Demonstrated competitive record at district level or above. Academic transcript and sports CV required.",
    age_min: 16, age_max: 21,
    gender_eligibility: "all",
    experience_level_required: "amateur",
    start_date: daysFromNow(45), end_date: daysFromNow(46),
    application_deadline: daysFromNow(25),
    vacancies: 12, vacancies_filled: 4,
    status: "open", application_count: 188
  });

  const margaoWinger = await makeOpportunity(margaoFC, margaoFCManager, {
    title: "Goa Pro League — Attacking Winger",
    type: "recruitment",
    sport: "Football",
    description: "Pro-league side seeking a quick attacking winger comfortable on either flank. Must have strong 1v1 ability and a delivery from wide positions. Availability for pre-season (starting 3rd week of month) is essential.",
    eligibility: "State-level experience minimum. Comfortable playing both flanks. Trials open to all genders.",
    age_min: 18, age_max: 30,
    gender_eligibility: "all",
    experience_level_required: "semi_pro",
    start_date: daysFromNow(10), end_date: daysFromNow(11),
    application_deadline: daysFromNow(6),
    vacancies: 1, vacancies_filled: 0,
    status: "open", application_count: 23
  });

  const cityT20 = await makeOpportunity(puneLeague, puneLeagueOrg, {
    title: "City T20 Championship — Team Registration",
    type: "tournament",
    sport: "Cricket",
    description: "16-team T20 championship across 4 weekends in Pune. Each team plays 3 group-stage matches with top 8 advancing to knockouts. Final on the last Sunday. Individual awards: Best Batter, Best Bowler, Player of the Tournament.",
    eligibility: "Registered teams of 11–15 players. Min 11 players on match day. Team registration fee: ₹8,000.",
    age_min: 16, age_max: 45,
    gender_eligibility: "all",
    experience_level_required: "any",
    start_date: daysFromNow(20), end_date: daysFromNow(41),
    application_deadline: daysFromNow(12),
    vacancies: 16, vacancies_filled: 11,
    status: "open", application_count: 11
  });

  await makeOpportunity(dyPatil, dyPatilManager, {
    title: "Batting Coach — Senior Academy Programme",
    type: "coaching_job",
    sport: "Cricket",
    description: "Full-time batting coach for our senior academy programme. Responsible for individual batting plans, session design, video analysis, and match mentoring for 12–18 athletes aged 16–23.\n\nSalary: ₹8–12 lakh per annum based on experience. On-campus accommodation available.",
    eligibility: "BCCI Level-2 coaching license minimum. 3+ years coaching experience. Preferred: former state or national player.",
    age_min: 25, age_max: 60,
    gender_eligibility: "all",
    experience_level_required: "professional",
    start_date: daysFromNow(30), end_date: daysFromNow(31),
    application_deadline: daysFromNow(20),
    vacancies: 1, vacancies_filled: 0,
    status: "open", application_count: 9
  });

  // ── Applications ───────────────────────────────────────────────────────────
  await makeApplication(seniorTrial, arjun, "shortlisted",
    "Top-order batter who bowls off-spin. 142 matches, avg 38.3, 187 wickets. Coach endorsement from Sandeep Joshi attached.");
  await makeApplication(u23FastBowler, arjun, "pending",
    "Bowl off-break but can contribute as a batting all-rounder in the middle order. Available immediately.");
  await makeApplication(dyScholarship, arjun, "selected",
    "Registered Pune Royals XI as captain. Strong domestic cricket record submitted with application.");

  await makeApplication(seniorTrial, vikram, "shortlisted",
    "Middle-order anchor, 18 first-class hundreds. Average 44.1 across formats. Looking to relocate to Maharashtra.");
  await makeApplication(seniorTrial, dev, "pending",
    "Aggressive opener. Academy graduate with SR of 142 and HS of 167. Ready for state-level exposure.");
  await makeApplication(seniorTrial, kabir, "selected",
    "Keeper-batter with national experience. 188 dismissals career total. Available immediately for the conditioning camp.");
  await makeApplication(seniorTrial, imran, "pending",
    "Right-arm fast. Wicket-taking new-ball bowler. 204 career wickets across all formats at economy 4.9.");

  const sahil = await makeUser({
    email: "sahil@demo.sportivox",
    full_name: "Sahil Verma",
    role: "athlete",
    bio: "Club all-rounder seeking step up to state cricket.",
    country: "India", state: "Maharashtra", city: "Nagpur",
    dob: "1993-08-14", gender: "male",
    athlete_data: {
      primary_sport: "Cricket", position: "All-rounder",
      experience_level: "amateur", availability: "open_to_offers", looking_for_club: true,
      stats: { matches: 62, runs: 1480, bat_avg: 26.0, wickets: 60 }
    }
  });
  await makeApplication(seniorTrial, sahil, "rejected",
    "Club all-rounder seeking step up. 62 matches, avg 26, 60 wickets.",
    "Outside age/experience window for this trial. Encouraged to build record at district level.");

  await makeApplication(dyScholarship, aditi, "shortlisted",
    "National-level sprinter. 100m PB 11.42s. National junior champion 2023. Seeking academy support for 2026 nationals.");
  await makeApplication(margaoWinger, rohanPillai, "pending",
    "Winger from Goa State League. 34 goals and 22 assists last two seasons. Quick, direct, strong delivery from both flanks.");

  // ── Posts ──────────────────────────────────────────────────────────────────
  await makePost(arjun, "Net session — worked on the slog-sweep against the off-spinners. 45 mins fitness + 200 throwdowns. Body feels good ahead of the camp.", "Cricket", "log", 38, 6);
  await makePost(imran, "5/23 in the league final. Best figures of the season. Economy 4.4 across 10 overs. On to the next one.", "Cricket", "post", 412, 54);
  await makePost(sara, "Clean sheet number 41. Reaction drills + distribution work this week. Open to offers for the new season.", "Football", "log", 96, 12);
  await makePost(aditi, "Personal best — 11.42s in the 100m today at the state trials. Nationals prep is on track. Big thanks to my coach.", "Athletics", "post", 287, 32);
  await makePost(rohanPillai, "Hat-trick of assists in the Goa Pro League opener. The left-foot cross is finally clicking. Open to all senior-level offers.", "Football", "post", 143, 18);
  await makePost(vikram, "Off-season training complete. 1200 throwdowns, 40 hours of gym work. Coming back stronger for the Ranji season.", "Cricket", "log", 61, 7);
  await makePost(kabir, "Second consecutive Player of the Match for keeping. 4 catches, 2 stumpings in the day-night match. Strong prep for trials.", "Cricket", "post", 184, 22);
  await makePost(maya, "Attended three U-23 matches in Pune this weekend. Spotted genuine pace talent on the seam — will be reaching out. #scouting", "Cricket", "post", 55, 9);
  await makePost(sandeep, "Coaching clinic at Maharashtra academy this week. Worked with 18 batters on their trigger movements. Great group of young players.", "Cricket", "post", 72, 11);
  await makePost(dev, "Scored 167 off 112 balls in the district final. First century on a big ground. Applying for state trials — fingers crossed!", "Cricket", "post", 203, 28);

  // ── Reels ──────────────────────────────────────────────────────────────────
  await makeReel(arjun, "Batting drill — the pull shot against short-pitch bowling. 50 reps today.", "Cricket", 124);
  await makeReel(imran, "5/23 ball-by-ball — every wicket from the league final. Off-stump corridor all day.", "Cricket", 387);
  await makeReel(aditi, "100m race clip — 11.42s personal best at Tamil Nadu State Trials.", "Athletics", 512);
  await makeReel(rohanPillai, "Crossing compilation — left foot and right foot deliveries from wide. Open to offers.", "Football", 219);
  await makeReel(sara, "Penalty save reaction — three stops in training drill. The angles are everything.", "Football", 166);
  await makeReel(dev, "167 highlights — boundaries from the district final. Notice my trigger movement.", "Cricket", 298);
  await makeReel(kabir, "Stumping drill — 20 stumpings off the spinner in 3 minutes. Glove work.", "Cricket", 143);

  // ── Blogs ──────────────────────────────────────────────────────────────────
  await makeBlog(maya, "What scouts actually look for at U-19 trials", "Cricket",
    ["scouting", "trials", "youth-cricket"],
    `# What scouts look for at U-19 trials\n\nFive years of attending trials has taught me one thing above all else: **talent is common, but attitude under fatigue is rare.**\n\n## 1. First touch under pressure\n\nA great touch in nets means nothing if it collapses when a fielder is bearing down at pace. Scouts watch the second and third decision — not the first.\n\n## 2. Positioning without the ball\n\nMost trialists are so focused on getting the ball that they forget positioning is 80% of the game. Scouts spend just as much time watching you when you don't have the ball.\n\n## 3. Communication\n\nYoung players rarely communicate on the pitch. The ones who do — who organize teammates, call for the ball, point to space — immediately stand out.\n\n## 4. Response to a mistake\n\nHow a player responds after an error tells you everything. Watch the 2 minutes after a mistake — that's the real character test.\n\n## Final thought\n\nIf you're going to a trial: be early, be loud appropriately, and sprint for every loose ball even in the last 10 minutes.`,
    "Five years of scouting distilled: talent is common, but attitude under fatigue is what actually separates trialists.");

  await makeBlog(sandeep, "Off-spin in the middle overs: why variation beats pace every time", "Cricket",
    ["cricket", "bowling", "off-spin", "coaching"],
    `# Off-spin in the middle overs\n\nThe middle overs are where off-spin bowlers earn their contracts or lose them.\n\n## 1. The carrom ball is your money ball\n\nA well-disguised carrom ball looks identical to a standard off-break until 0.3 seconds before the batter commits.\n\n## 2. Flight before spin\n\nYoung spinners think spin is everything. It's not. Flight — the arc and dip of the delivery — is what buys you time.\n\n## 3. Attacking field first\n\nSet an attacking field for the first two balls of your spell. By ball 3, he's thinking about the close fielders — that's when you take the wicket.\n\n## 4. Don't bowl flat under pressure\n\nFlat off-spin is the worst response to pressure. When you're going for runs, counter-intuitively — toss it higher, not flatter.`,
    "Middle-over off-spin: why variation and flight beat pace, and how to execute under pressure in T20 and ODI formats.");

  await makeBlog(aditi, "Running a sub-11.5 second 100m: my 6-month training breakdown", "Athletics",
    ["athletics", "100m", "sprinting", "training"],
    `# Running a sub-11.5s 100m\n\nI ran my first sub-11.5 in March 2024 (11.42s). Here's the breakdown of the 6 months before it.\n\n## 1. Block starts — every single session\n\nMy coach insisted on block starts for every sprint session. Reaction time improvement is compounding — over 6 months I dropped 0.12s from my reaction time alone.\n\n## 2. Strength work: single-leg focus\n\nHeavy split squats, single-leg RDLs, and box jumps twice a week. The 100m is essentially 100 single-leg contacts.\n\n## 3. Max velocity drills at 95%\n\nTrue max velocity work is done at 95–97% effort. 100% often means tension, which kills stride efficiency.\n\n## 4. Recovery\n\nIce baths after every high-intensity session. 8+ hours sleep. Foam rolling daily. The adaptation happens in recovery, not training.`,
    "Breaking down the 6-month training programme that took me from 11.82s to a 11.42s personal best.");

  await makeBlog(arjun, "Playing as a true all-rounder: lessons from 6 seasons of state cricket", "Cricket",
    ["cricket", "all-rounder", "batting", "bowling"],
    `# Playing as a true all-rounder\n\nMost cricketers call themselves all-rounders. Very few are.\n\n## 1. Your batting has to stand alone\n\nA batter who also bowls is not an all-rounder. Your batting must be good enough to justify a spot on batting average alone.\n\n## 2. Bowl first in the match, bat second in your priorities\n\nIn pre-season, put 60% of your practice time into bowling. This keeps your bowling sharp when the captain needs you.\n\n## 3. The middle overs are yours\n\nAs an off-spin all-rounder, the 12–18 over window in T20 is where you earn your wage.\n\n## 4. Be available for everything\n\nThe true value of an all-rounder isn't statistics — it's flexibility. Be the player who says yes. Always.`,
    "Six seasons of state cricket taught me what being a genuine all-rounder really means — and it starts with your batting standing alone.");

  // ── Conversations & Messages ───────────────────────────────────────────────
  const conv1 = await makeConversation(
    [arjun.id, maya.id],
    "Great — can you make the camp on the 14th?",
    maya.id, hoursAgo(2),
    { [arjun.id]: 2, [maya.id]: 0 },
    hoursAgo(26)
  );
  await sendMessage(conv1.id, maya.id, arjun.id, "Hi Arjun — we reviewed your profile and stats. Really strong all-round record.", hoursAgo(26));
  await sendMessage(conv1.id, maya.id, arjun.id, "We'd like to shortlist you for the Senior Men's Trial. Conditioning camp starts the week of the 14th.", hoursAgo(25));
  await sendMessage(conv1.id, arjun.id, maya.id, "Thank you! That's great news. I'm available and very keen.", hoursAgo(5));
  await sendMessage(conv1.id, maya.id, arjun.id, "Great — can you make the camp on the 14th?", hoursAgo(2));

  const conv2 = await makeConversation(
    [arjun.id, sandeep.id],
    "Endorsement submitted. Good luck with the trial.",
    sandeep.id, daysAgo(1),
    { [arjun.id]: 0, [sandeep.id]: 0 },
    daysAgo(2)
  );
  await sendMessage(conv2.id, arjun.id, sandeep.id, "Coach, could you add your endorsement to my stats on Sportivox? Applying for the Maharashtra State trial.", daysAgo(2));
  await sendMessage(conv2.id, sandeep.id, arjun.id, "Done — endorsement submitted. Good luck with the trial. Your off-spin work this season has been outstanding.", daysAgo(1));

  const conv3 = await makeConversation(
    [arjun.id, clubManager.id],
    "We've received your application. Reviewing this week.",
    clubManager.id, daysAgo(3),
    { [arjun.id]: 0, [clubManager.id]: 0 },
    daysAgo(3)
  );
  await sendMessage(conv3.id, clubManager.id, arjun.id, "We've received your application for the U-23 recruitment. Reviewing this week.", daysAgo(3));

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifData = [
    {
      user_id: arjun.id,
      type: "shortlisted",
      title: "You've been shortlisted",
      body: "Maharashtra State XI shortlisted you for the Senior Men's Trial.",
      link: "/my-applications",
      read: false,
      created_at: hoursAgo(2)
    },
    {
      user_id: arjun.id,
      type: "message",
      title: "New message from Maya Iyer",
      body: "Great — can you make the camp on the 14th?",
      link: `/messages?to=${maya.id}`,
      read: false,
      created_at: hoursAgo(2)
    },
    {
      user_id: arjun.id,
      type: "verification",
      title: "Stats verified",
      body: "Your statistics were verified via coach endorsement by Sandeep Joshi.",
      link: `/profile/${arjun.id}`,
      read: false,
      created_at: daysAgo(1)
    },
    {
      user_id: arjun.id,
      type: "match",
      title: "New opportunity match",
      body: "U-23 Fast Bowler Recruitment matches your cricket profile.",
      link: `/opportunities/${u23FastBowler.id}`,
      read: true,
      created_at: daysAgo(1)
    },
    {
      user_id: arjun.id,
      type: "follow",
      title: "Vikram Singh started following you",
      body: "You now have a new follower.",
      link: `/profile/${vikram.id}`,
      read: true,
      created_at: daysAgo(2)
    }
  ];
  await prisma.notification.createMany({ data: notifData });

  console.log(`
✅ Seed complete — design prototype data loaded.
   Password for all accounts: ${DEMO_PASSWORD}

   Demo accounts:
     admin@sportivox.local         (admin)
     athlete@demo.sportivox        (Arjun Mehta — cricket all-rounder)
     athlete2@demo.sportivox       (Imran Qureshi — fast bowler)
     cricket-dev@demo.sportivox    (Dev Sharma — opener)
     cricket-wk@demo.sportivox     (Kabir Nair — keeper)
     cricket-bat@demo.sportivox    (Vikram Singh — middle order)
     football-winger@demo.sportivox (Rohan Pillai)
     football-gk@demo.sportivox    (Sara Lewis — goalkeeper)
     athletics@demo.sportivox      (Aditi Rao — sprinter)
     sahil@demo.sportivox          (Sahil Verma — rejected applicant)
     scout@demo.sportivox          (Maya Iyer — scout)
     coach@demo.sportivox          (Sandeep Joshi — coach)
     club@demo.sportivox           (Mumbai Strikers Manager)
     academy@demo.sportivox        (DY Patil Academy Director)
     margao@demo.sportivox         (Margao FC Manager)
     puneleague@demo.sportivox     (Pune Cricket League)
  `);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
