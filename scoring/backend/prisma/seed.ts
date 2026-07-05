/**
 * Seed: Sample T20 match ready for live scoring
 *
 * Creates:
 *  - 1 admin user (for scoring console login if ever needed)
 *  - 1 tournament  (Sportzicon T20 Invitational)
 *  - 2 teams       (Mumbai Lions vs Pune Warriors)
 *  - 11 players each (mix of batters, bowlers, all-rounders, keeper)
 *  - 1 match       (status = live, innings 1 started, toss done)
 *  - 1 innings     (Mumbai Lions batting, Pune Warriors bowling)
 *  - Batting & bowling lineup stubs ready for ball entry
 *
 * Run: npm run db:seed  (from scoring/backend)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding sample live match…");

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminEmail = "admin@sportzicon.local";
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hash = await bcrypt.hash("Admin@1234", 12);
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        email_lower: adminEmail,
        password_hash: hash,
        full_name: "Scoring Admin",
        full_name_lower: "scoring admin",
        role: "scorer"
      }
    });
    console.log("  ✔ Admin user created:", adminEmail, "/ Admin@1234");
  } else {
    console.log("  ✔ Admin user already exists");
  }

  // ── Wipe existing seed data (idempotent re-run) ─────────────────────────────
  await prisma.tournament.deleteMany({ where: { name: "Sportzicon T20 Invitational" } });

  // ── Tournament ──────────────────────────────────────────────────────────────
  const tournament = await prisma.tournament.create({
    data: {
      name: "Sportzicon T20 Invitational",
      sport: "cricket",
      format: "T20",
      description: "A sample T20 invitational seeded for live-scoring demo.",
      location: "Pune, Maharashtra",
      start_date: "2026-06-05",
      end_date: "2026-06-10",
      status: "ongoing",
      overs_per_innings: 20,
      number_of_innings: 2,
      ball_type: "white",
      powerplay_overs: { pp_start: 1, pp_end: 6, death_start: 16, death_end: 20 },
      super_over_enabled: true,
      free_hit_enabled: true,
      wide_rule: "men",
      is_public: true,
      created_by: admin.id
    }
  });
  console.log("  ✔ Tournament:", tournament.name);

  // ── Teams ───────────────────────────────────────────────────────────────────
  const mumbai = await prisma.team.create({
    data: {
      tournament_id: tournament.id,
      name: "Mumbai Lions",
      short_name: "MUL",
      color: "#004FA3"
    }
  });

  const pune = await prisma.team.create({
    data: {
      tournament_id: tournament.id,
      name: "Pune Warriors",
      short_name: "PWR",
      color: "#8B0000"
    }
  });
  console.log("  ✔ Teams: Mumbai Lions, Pune Warriors");

  // ── Players — Mumbai Lions (batting first) ──────────────────────────────────
  // role values: batsman | bowler | all-rounder | wicket-keeper
  const mumbaiPlayers = await Promise.all([
    prisma.player.create({ data: { team_id: mumbai.id, name: "Rohit Mehta",      jersey_number: 1,  role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Shikhar Das",      jersey_number: 5,  role: "batsman",       batting_style: "left-hand bat",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Virat Joshi",      jersey_number: 18, role: "batsman",       batting_style: "right-hand bat", is_captain: true,  is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Suryakant Nair",   jersey_number: 63, role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Hardik Patil",     jersey_number: 33, role: "all-rounder",   batting_style: "right-hand bat", bowling_style: "right-arm fast-medium",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Dinesh Karthick",  jersey_number: 25, role: "wicket-keeper", batting_style: "right-hand bat", is_captain: false, is_keeper: true  } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Ravindra Jadeja",  jersey_number: 8,  role: "all-rounder",   batting_style: "left-hand bat",  bowling_style: "slow left-arm orthodox", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Jasprit Sharma",   jersey_number: 93, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast",          is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Mohammed Arif",    jersey_number: 17, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast-medium",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Kuldeep Verma",    jersey_number: 29, role: "bowler",        batting_style: "right-hand bat", bowling_style: "left-arm wrist-spin",    is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: mumbai.id, name: "Prasidh Rao",      jersey_number: 55, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast",          is_captain: false, is_keeper: false } }),
  ]);
  console.log("  ✔ Mumbai Lions: 11 players");

  // ── Players — Pune Warriors (bowling first) ─────────────────────────────────
  const punePlayers = await Promise.all([
    prisma.player.create({ data: { team_id: pune.id, name: "KL Rahane",         jersey_number: 1,  role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Faf du Plessis",    jersey_number: 13, role: "batsman",       batting_style: "right-hand bat", is_captain: true,  is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Devdutt Padikkal",  jersey_number: 28, role: "batsman",       batting_style: "left-hand bat",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Shreyas Gupta",     jersey_number: 7,  role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Washington Sundar", jersey_number: 21, role: "all-rounder",   batting_style: "right-hand bat", bowling_style: "right-arm off-spin",    is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Sanju Samson",      jersey_number: 9,  role: "wicket-keeper", batting_style: "right-hand bat", is_captain: false, is_keeper: true  } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Axar Singh",        jersey_number: 20, role: "all-rounder",   batting_style: "left-hand bat",  bowling_style: "left-arm orthodox",     is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Arshdeep Kumar",    jersey_number: 2,  role: "bowler",        batting_style: "left-hand bat",  bowling_style: "left-arm fast-medium",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Harshal Patel",     jersey_number: 12, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast-medium", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Yuzvendra Chahal",  jersey_number: 3,  role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm leg-spin",    is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: pune.id, name: "Deepak Chahar",     jersey_number: 90, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm medium-fast", is_captain: false, is_keeper: false } }),
  ]);
  console.log("  ✔ Pune Warriors: 11 players");

  // ── Match — set LIVE ─────────────────────────────────────────────────────────
  const match = await prisma.match.create({
    data: {
      tournament_id: tournament.id,
      match_number: 1,
      title: "Match 1 — Mumbai Lions vs Pune Warriors",
      sport: "cricket",
      format: "T20",
      team1_id: mumbai.id,
      team2_id: pune.id,
      venue: "Balewadi Stadium, Pune",
      scheduled_at: new Date(),
      status: "live",
      toss_winner_id: pune.id,
      toss_decision: "bowl"   // Pune won toss, chose to bowl → Mumbai bats first
    }
  });
  console.log("  ✔ Match:", match.title, "[ LIVE ]");
  console.log("     Toss: Pune Warriors won, elected to bowl");

  // ── Innings 1 — Mumbai Lions batting ────────────────────────────────────────
  const innings = await prisma.innings.create({
    data: {
      match_id: match.id,
      innings_number: 1,
      batting_team_id: mumbai.id,
      bowling_team_id: pune.id
    }
  });

  // Batting lineup stubs for all 11 Mumbai players
  await prisma.battingEntry.createMany({
    data: mumbaiPlayers.map((p, i) => ({
      innings_id: innings.id,
      player_id: p.id,
      batting_position: i + 1,
      status: "yet_to_bat"
    }))
  });

  // Bowling stubs for Pune bowlers (5 bowlers + 2 all-rounders can bowl)
  const puneCanBowl = punePlayers.filter(p =>
    ["bowler", "all-rounder"].includes(p.role!)
  );
  await prisma.bowlingEntry.createMany({
    data: puneCanBowl.map(p => ({
      innings_id: innings.id,
      player_id: p.id
    }))
  });

  console.log("  ✔ Innings 1 created (Mumbai batting)");
  console.log("     Batting lineup: 11 entries");
  console.log("     Bowling lineup:", puneCanBowl.length, "entries");

  // ── Print IDs useful for manual API testing ──────────────────────────────────
  console.log("\n📋  IDs for live scoring:");
  console.log("   Match ID   :", match.id);
  console.log("   Innings ID :", innings.id);
  console.log("\n   Mumbai Lions openers:");
  console.log("     Striker     :", mumbaiPlayers[0].name, "/", mumbaiPlayers[0].id);
  console.log("     Non-striker :", mumbaiPlayers[1].name, "/", mumbaiPlayers[1].id);
  console.log("\n   Opening bowler (Pune):");
  const opener = puneCanBowl.find(p => p.bowling_style?.includes("fast")) ?? puneCanBowl[0];
  console.log("     Bowler      :", opener.name, "/", opener.id);

  console.log("\n✅  Seed complete. Open the Scoring console → navigate to Match 1 to start scoring.");
  console.log("   Live Scores public page will reflect every ball in real-time.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
