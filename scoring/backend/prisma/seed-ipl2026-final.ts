/**
 * Seed: IPL 2026 Final — Royal Challengers Bengaluru vs Gujarat Titans
 *
 * Result  : RCB won by 5 wickets (with 12 balls remaining)
 * Venue   : Narendra Modi Stadium, Ahmedabad
 * Date    : 31 May 2026 (19:30 IST)
 * Toss    : RCB won, elected to field
 * POTM    : Virat Kohli (75* off 42 balls)
 * Umpires : K.N. Ananthapadmanabhan, Nitin Menon
 * TV      : Jayaraman Madanagopal
 * Referee : Javagal Srinath
 *
 * GT  155/8  (20 ov) — Rasikh Salam 3/27
 * RCB 161/5  (18 ov) — Virat Kohli 75*, Rashid Khan 2/25
 *
 * Run: npx tsx prisma/seed-ipl2026-final.ts   (from scoring/backend/)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🏆  Seeding IPL 2026 Final: RCB vs GT…");

  // ── Admin user (reuse or create) ────────────────────────────────────────────
  const adminEmail = "admin@sportzicon.local";
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: await bcrypt.hash("Admin@1234", 10),
        full_name: "Scoring Admin",
        role: "admin",
      },
    });
    console.log("  ✔ Admin created:", adminEmail);
  }

  // ── Idempotent: wipe previous run ───────────────────────────────────────────
  await prisma.tournament.deleteMany({ where: { name: "Indian Premier League 2026" } });
  console.log("  ✔ Cleared previous IPL 2026 seed data");

  // ── Tournament ───────────────────────────────────────────────────────────────
  const tournament = await prisma.tournament.create({
    data: {
      name: "Indian Premier League 2026",
      sport: "cricket",
      format: "T20",
      season: "2026",
      match_type: "tournament",
      description: "The 19th edition of the Indian Premier League, played across India.",
      location: "India",
      start_date: "2026-03-22",
      end_date: "2026-05-31",
      status: "completed",
      overs_per_innings: 20,
      number_of_innings: 2,
      ball_type: "white",
      powerplay_overs: { pp_start: 1, pp_end: 6, death_start: 16, death_end: 20 },
      super_over_enabled: true,
      free_hit_enabled: true,
      wide_rule: "men",
      tie_break_rule: "super_over",
      is_public: true,
      created_by: admin.id,
    },
  });
  console.log("  ✔ Tournament:", tournament.name);

  // ── Teams ────────────────────────────────────────────────────────────────────
  const gt = await prisma.team.create({
    data: {
      tournament_id: tournament.id,
      name: "Gujarat Titans",
      short_name: "GT",
      color: "#1B3F6A",
    },
  });

  const rcb = await prisma.team.create({
    data: {
      tournament_id: tournament.id,
      name: "Royal Challengers Bengaluru",
      short_name: "RCB",
      color: "#C8102E",
    },
  });
  console.log("  ✔ Teams: GT, RCB");

  // ── GT Players ───────────────────────────────────────────────────────────────
  const [
    saiSudharsan,
    shubmanGill,
    nishantSindhu,
    josButtler,
    washingtonSundar,
    arshadKhan,
    rahulTewatia,
    jasonHolder,
    rashidKhan,
    kagisoRabada,
    mohammedSiraj,
    prassidhKrishna,
  ] = await Promise.all([
    prisma.player.create({ data: { team_id: gt.id, name: "Sai Sudharsan",    jersey_number: 3,  role: "batsman",       batting_style: "left-hand bat",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Shubman Gill",     jersey_number: 77, role: "batsman",       batting_style: "right-hand bat", is_captain: true,  is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Nishant Sindhu",   jersey_number: 32, role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Jos Buttler",      jersey_number: 63, role: "wicket-keeper", batting_style: "right-hand bat", is_captain: false, is_keeper: true  } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Washington Sundar",jersey_number: 21, role: "all-rounder",   batting_style: "right-hand bat", bowling_style: "right-arm off-spin",    is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Arshad Khan",      jersey_number: 41, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast-medium", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Rahul Tewatia",    jersey_number: 58, role: "all-rounder",   batting_style: "left-hand bat",  bowling_style: "right-arm leg-spin",    is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Jason Holder",     jersey_number: 17, role: "all-rounder",   batting_style: "right-hand bat", bowling_style: "right-arm fast-medium", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Rashid Khan",      jersey_number: 19, role: "all-rounder",   batting_style: "right-hand bat", bowling_style: "right-arm leg-spin",    is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Kagiso Rabada",    jersey_number: 25, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast",        is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Mohammed Siraj",   jersey_number: 13, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast-medium", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: gt.id, name: "Prasidh Krishna",  jersey_number: 99, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast",        is_captain: false, is_keeper: false } }),
  ]);
  console.log("  ✔ GT: 12 players (incl. Impact Player: Prasidh Krishna)");

  // ── RCB Players ──────────────────────────────────────────────────────────────
  const [
    venkateshIyer,
    viratKohli,
    devduttPadikkal,
    rajatPatidar,
    krunalPandya,
    timDavid,
    jiteshSharma,
    romarioShepherd,
    bhuvneshwarKumar,
    joshHazlewood,
    rasikhSalam,
    jacobDuffy,
  ] = await Promise.all([
    prisma.player.create({ data: { team_id: rcb.id, name: "Venkatesh Iyer",    jersey_number: 9,  role: "all-rounder",   batting_style: "left-hand bat",  bowling_style: "right-arm medium",      is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Virat Kohli",       jersey_number: 18, role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Devdutt Padikkal",  jersey_number: 1,  role: "batsman",       batting_style: "left-hand bat",  is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Rajat Patidar",     jersey_number: 88, role: "batsman",       batting_style: "right-hand bat", is_captain: true,  is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Krunal Pandya",     jersey_number: 24, role: "all-rounder",   batting_style: "left-hand bat",  bowling_style: "left-arm orthodox",     is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Tim David",         jersey_number: 8,  role: "batsman",       batting_style: "right-hand bat", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Jitesh Sharma",     jersey_number: 7,  role: "wicket-keeper", batting_style: "right-hand bat", is_captain: false, is_keeper: true  } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Romario Shepherd",  jersey_number: 11, role: "all-rounder",   batting_style: "right-hand bat", bowling_style: "right-arm fast-medium", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Bhuvneshwar Kumar", jersey_number: 15, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm medium-fast", is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Josh Hazlewood",    jersey_number: 28, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast",        is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Rasikh Salam Dar",  jersey_number: 40, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast",        is_captain: false, is_keeper: false } }),
    prisma.player.create({ data: { team_id: rcb.id, name: "Jacob Duffy",       jersey_number: 45, role: "bowler",        batting_style: "right-hand bat", bowling_style: "right-arm fast-medium", is_captain: false, is_keeper: false } }),
  ]);
  console.log("  ✔ RCB: 12 players (incl. Impact Player: Venkatesh Iyer)");

  // ── Match ────────────────────────────────────────────────────────────────────
  const match = await prisma.match.create({
    data: {
      tournament_id:     tournament.id,
      match_number:      1,
      title:             "Final — Royal Challengers Bengaluru vs Gujarat Titans",
      sport:             "cricket",
      format:            "T20",
      match_type:        "knockout",
      team1_id:          gt.id,
      team2_id:          rcb.id,
      venue:             "Narendra Modi Stadium, Ahmedabad",
      scheduled_at:      new Date("2026-05-31T19:30:00+05:30"),
      status:            "completed",
      toss_winner_id:    rcb.id,
      toss_decision:     "bowl",              // RCB won toss, chose to field
      winner_team_id:    rcb.id,
      result_summary:    "Royal Challengers Bengaluru won by 5 wickets (with 12 balls remaining)",
      player_of_match_id: viratKohli.id,
      umpire1:           "K.N. Ananthapadmanabhan",
      umpire2:           "Nitin Menon",
      tv_umpire:         "Jayaraman Madanagopal",
      match_referee:     "Javagal Srinath",
    },
  });
  console.log("  ✔ Match:", match.title);

  // ── Playing XIs ─────────────────────────────────────────────────────────────
  // GT Playing XI + Impact Player
  await prisma.matchPlayer.createMany({
    data: [
      { match_id: match.id, team_id: gt.id, player_id: saiSudharsan.id,    batting_position: 1,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: shubmanGill.id,     batting_position: 2,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: nishantSindhu.id,   batting_position: 3,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: josButtler.id,      batting_position: 4,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: washingtonSundar.id,batting_position: 5,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: arshadKhan.id,      batting_position: 6,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: rahulTewatia.id,    batting_position: 7,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: jasonHolder.id,     batting_position: 8,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: rashidKhan.id,      batting_position: 9,    is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: kagisoRabada.id,    batting_position: 10,   is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: mohammedSiraj.id,   batting_position: 11,   is_impact_player: false },
      { match_id: match.id, team_id: gt.id, player_id: prassidhKrishna.id, batting_position: null, is_impact_player: true  },
    ],
  });

  // RCB Playing XI + Impact Player
  await prisma.matchPlayer.createMany({
    data: [
      { match_id: match.id, team_id: rcb.id, player_id: venkateshIyer.id,    batting_position: 1,    is_impact_player: true  }, // Impact sub — came in as opener
      { match_id: match.id, team_id: rcb.id, player_id: viratKohli.id,       batting_position: 2,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: devduttPadikkal.id,  batting_position: 3,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: rajatPatidar.id,     batting_position: 4,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: krunalPandya.id,     batting_position: 5,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: timDavid.id,         batting_position: 6,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: jiteshSharma.id,     batting_position: 7,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: romarioShepherd.id,  batting_position: 8,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: bhuvneshwarKumar.id, batting_position: 9,    is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: joshHazlewood.id,    batting_position: 10,   is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: rasikhSalam.id,      batting_position: 11,   is_impact_player: false },
      { match_id: match.id, team_id: rcb.id, player_id: jacobDuffy.id,       batting_position: null, is_impact_player: true  }, // Fielding substitute
    ],
  });
  console.log("  ✔ Playing XIs registered");

  // ════════════════════════════════════════════════════════════════════════════
  // INNINGS 1 — Gujarat Titans batting  155/8 (20 ov)
  // ════════════════════════════════════════════════════════════════════════════
  const inn1 = await prisma.innings.create({
    data: {
      match_id:        match.id,
      innings_number:  1,
      batting_team_id: gt.id,
      bowling_team_id: rcb.id,
      total_runs:      155,
      total_wickets:   8,
      total_balls:     120,
      extras:          5,
      wides:           4,
      no_balls:        0,
      byes:            0,
      leg_byes:        1,
      boundary_4s:     15,
      boundary_6s:     3,
      dot_balls:       48,
      // Phase splits  (PP: ov 1-6 | Mid: ov 7-15 | Death: ov 16-20)
      pp_runs:         48,  pp_wickets: 2, pp_balls: 36,
      mid_runs:        60,  mid_wickets: 3, mid_balls: 54,
      death_runs:      47,  death_wickets: 3, death_balls: 30,
      is_completed:    true,
    },
  });

  // ── GT Batting Entries ───────────────────────────────────────────────────────
  await prisma.battingEntry.createMany({
    data: [
      {
        innings_id: inn1.id, player_id: saiSudharsan.id, batting_position: 1,
        runs: 12, balls_faced: 12, fours: 2, sixes: 0,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: bhuvneshwarKumar.id, fielder_id: jiteshSharma.id,
        dismissal_desc: "c Jitesh Sharma b Bhuvneshwar Kumar",
      },
      {
        innings_id: inn1.id, player_id: shubmanGill.id, batting_position: 2,
        runs: 10, balls_faced: 8, fours: 2, sixes: 0,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: joshHazlewood.id, fielder_id: rajatPatidar.id,
        dismissal_desc: "c Rajat Patidar b Josh Hazlewood",
      },
      {
        innings_id: inn1.id, player_id: nishantSindhu.id, batting_position: 3,
        runs: 20, balls_faced: 18, fours: 3, sixes: 0,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: rasikhSalam.id, fielder_id: devduttPadikkal.id,
        dismissal_desc: "c Devdutt Padikkal b Rasikh Salam",
      },
      {
        innings_id: inn1.id, player_id: josButtler.id, batting_position: 4,
        runs: 19, balls_faced: 23, fours: 1, sixes: 0,
        status: "out", dismissal_type: "stumped",
        dismissed_by_id: krunalPandya.id, fielder_id: jiteshSharma.id,
        dismissal_desc: "st Jitesh Sharma b Krunal Pandya",
      },
      {
        innings_id: inn1.id, player_id: washingtonSundar.id, batting_position: 5,
        runs: 50, balls_faced: 37, fours: 5, sixes: 0,
        status: "not_out", dismissal_desc: "not out",
      },
      {
        innings_id: inn1.id, player_id: arshadKhan.id, batting_position: 6,
        runs: 15, balls_faced: 6, fours: 0, sixes: 2,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: joshHazlewood.id, fielder_id: rasikhSalam.id,
        dismissal_desc: "c Rasikh Salam b Josh Hazlewood",
      },
      {
        innings_id: inn1.id, player_id: rahulTewatia.id, batting_position: 7,
        runs: 7, balls_faced: 5, fours: 1, sixes: 0,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: rasikhSalam.id, fielder_id: rajatPatidar.id,
        dismissal_desc: "c Rajat Patidar b Rasikh Salam",
      },
      {
        innings_id: inn1.id, player_id: jasonHolder.id, batting_position: 8,
        runs: 7, balls_faced: 5, fours: 1, sixes: 0,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: bhuvneshwarKumar.id, fielder_id: joshHazlewood.id,
        dismissal_desc: "c Josh Hazlewood b Bhuvneshwar Kumar",
      },
      {
        innings_id: inn1.id, player_id: rashidKhan.id, batting_position: 9,
        runs: 7, balls_faced: 3, fours: 0, sixes: 1,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: rasikhSalam.id, fielder_id: romarioShepherd.id,
        dismissal_desc: "c Romario Shepherd b Rasikh Salam",
      },
      {
        innings_id: inn1.id, player_id: kagisoRabada.id, batting_position: 10,
        runs: 3, balls_faced: 3, fours: 0, sixes: 0,
        status: "not_out", dismissal_desc: "not out",
      },
      {
        innings_id: inn1.id, player_id: mohammedSiraj.id, batting_position: 11,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0,
        status: "yet_to_bat", dismissal_desc: "did not bat",
      },
    ],
  });

  // ── RCB Bowling in Innings 1 ─────────────────────────────────────────────────
  // Total: 20 ov, 8 wkts, 150 runs + 5 extras = 155
  await prisma.bowlingEntry.createMany({
    data: [
      { innings_id: inn1.id, player_id: jacobDuffy.id,       balls: 24, maidens: 0, runs_conceded: 38, wickets: 0, wides: 3, no_balls: 0, dot_balls: 10 },
      { innings_id: inn1.id, player_id: bhuvneshwarKumar.id, balls: 24, maidens: 0, runs_conceded: 29, wickets: 2, wides: 0, no_balls: 0, dot_balls: 13 },
      { innings_id: inn1.id, player_id: joshHazlewood.id,    balls: 24, maidens: 0, runs_conceded: 37, wickets: 2, wides: 1, no_balls: 0, dot_balls: 11 },
      { innings_id: inn1.id, player_id: rasikhSalam.id,      balls: 24, maidens: 0, runs_conceded: 27, wickets: 3, wides: 0, no_balls: 0, dot_balls: 14 },
      { innings_id: inn1.id, player_id: krunalPandya.id,     balls: 24, maidens: 0, runs_conceded: 23, wickets: 1, wides: 0, no_balls: 0, dot_balls: 10 },
    ],
  });

  // ── RCB Fielding in Innings 1 ────────────────────────────────────────────────
  await prisma.fieldingEntry.createMany({
    data: [
      { innings_id: inn1.id, player_id: jiteshSharma.id,    catches: 1, stumpings: 1, impact_score: 2 },
      { innings_id: inn1.id, player_id: rajatPatidar.id,    catches: 2, impact_score: 2 },
      { innings_id: inn1.id, player_id: devduttPadikkal.id, catches: 1, impact_score: 1 },
      { innings_id: inn1.id, player_id: rasikhSalam.id,     catches: 1, impact_score: 1 },
      { innings_id: inn1.id, player_id: joshHazlewood.id,   catches: 1, impact_score: 1 },
      { innings_id: inn1.id, player_id: romarioShepherd.id, catches: 1, impact_score: 1 },
    ],
  });

  // ── Partnerships — GT Innings 1 ──────────────────────────────────────────────
  // FOW: 1-22(Gill,2.2) 2-26(Sudharsan,3.4) 3-55(Sindhu,7.6) 4-73(Buttler,12.1)
  //      5-99(Arshad,14.1) 6-115(Tewatia,16.1) 7-142(Holder,18.3) 8-151(Rashid,19.2)
  await prisma.partnership.createMany({
    data: [
      { innings_id: inn1.id, wicket_number: 0, player1_id: saiSudharsan.id,    player2_id: shubmanGill.id,      runs: 22, balls: 14, fours: 4, sixes: 0, is_unbroken: false, ended_over: 2,  ended_ball: 2 },
      { innings_id: inn1.id, wicket_number: 1, player1_id: saiSudharsan.id,    player2_id: nishantSindhu.id,   runs:  4, balls:  8, fours: 1, sixes: 0, is_unbroken: false, ended_over: 3,  ended_ball: 4 },
      { innings_id: inn1.id, wicket_number: 2, player1_id: nishantSindhu.id,   player2_id: josButtler.id,      runs: 29, balls: 26, fours: 3, sixes: 0, is_unbroken: false, ended_over: 7,  ended_ball: 6 },
      { innings_id: inn1.id, wicket_number: 3, player1_id: josButtler.id,      player2_id: washingtonSundar.id,runs: 18, balls: 25, fours: 2, sixes: 0, is_unbroken: false, ended_over: 12, ended_ball: 1 },
      { innings_id: inn1.id, wicket_number: 4, player1_id: washingtonSundar.id,player2_id: arshadKhan.id,      runs: 26, balls: 12, fours: 1, sixes: 2, is_unbroken: false, ended_over: 14, ended_ball: 1 },
      { innings_id: inn1.id, wicket_number: 5, player1_id: washingtonSundar.id,player2_id: rahulTewatia.id,    runs: 16, balls: 12, fours: 2, sixes: 0, is_unbroken: false, ended_over: 16, ended_ball: 1 },
      { innings_id: inn1.id, wicket_number: 6, player1_id: washingtonSundar.id,player2_id: jasonHolder.id,     runs: 27, balls: 14, fours: 2, sixes: 1, is_unbroken: false, ended_over: 18, ended_ball: 3 },
      { innings_id: inn1.id, wicket_number: 7, player1_id: washingtonSundar.id,player2_id: rashidKhan.id,      runs:  9, balls:  5, fours: 0, sixes: 1, is_unbroken: false, ended_over: 19, ended_ball: 2 },
      { innings_id: inn1.id, wicket_number: 8, player1_id: washingtonSundar.id,player2_id: kagisoRabada.id,    runs:  4, balls:  4, fours: 0, sixes: 0, is_unbroken: true,  ended_over: 20, ended_ball: 6 },
    ],
  });
  console.log("  ✔ Innings 1 (GT 155/8): batting, bowling, fielding, partnerships");

  // ════════════════════════════════════════════════════════════════════════════
  // INNINGS 2 — Royal Challengers Bengaluru batting  161/5 (18 ov)
  // ════════════════════════════════════════════════════════════════════════════
  const inn2 = await prisma.innings.create({
    data: {
      match_id:        match.id,
      innings_number:  2,
      batting_team_id: rcb.id,
      bowling_team_id: gt.id,
      total_runs:      161,
      total_wickets:   5,
      total_balls:     108,  // 18 overs
      extras:          2,
      wides:           1,
      no_balls:        0,
      byes:            0,
      leg_byes:        1,
      boundary_4s:     18,
      boundary_6s:     7,
      dot_balls:       30,
      target:          156,
      // Phase splits  (PP: ov 1-6 | Mid: ov 7-15 | Death: ov 16-18 only)
      pp_runs:         70,  pp_wickets: 2, pp_balls: 36,
      mid_runs:        70,  mid_wickets: 3, mid_balls: 54,
      death_runs:      21,  death_wickets: 0, death_balls: 18,
      is_completed:    true,
    },
  });

  // ── RCB Batting Entries ──────────────────────────────────────────────────────
  await prisma.battingEntry.createMany({
    data: [
      {
        innings_id: inn2.id, player_id: venkateshIyer.id, batting_position: 1,
        runs: 32, balls_faced: 16, fours: 4, sixes: 2,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: mohammedSiraj.id, fielder_id: kagisoRabada.id,
        dismissal_desc: "c Kagiso Rabada b Mohammed Siraj",
      },
      {
        innings_id: inn2.id, player_id: viratKohli.id, batting_position: 2,
        runs: 75, balls_faced: 42, fours: 9, sixes: 3,
        status: "not_out", dismissal_desc: "not out",
      },
      {
        innings_id: inn2.id, player_id: devduttPadikkal.id, batting_position: 3,
        runs: 1, balls_faced: 4, fours: 0, sixes: 0,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: kagisoRabada.id, fielder_id: arshadKhan.id,
        dismissal_desc: "c Arshad Khan b Kagiso Rabada",
      },
      {
        innings_id: inn2.id, player_id: rajatPatidar.id, batting_position: 4,
        runs: 15, balls_faced: 13, fours: 1, sixes: 1,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: rashidKhan.id, fielder_id: kagisoRabada.id,
        dismissal_desc: "c Kagiso Rabada b Rashid Khan",
      },
      {
        innings_id: inn2.id, player_id: krunalPandya.id, batting_position: 5,
        runs: 1, balls_faced: 2, fours: 0, sixes: 0,
        status: "out", dismissal_type: "lbw",
        dismissed_by_id: rashidKhan.id,
        dismissal_desc: "lbw b Rashid Khan",
      },
      {
        innings_id: inn2.id, player_id: timDavid.id, batting_position: 6,
        runs: 24, balls_faced: 17, fours: 3, sixes: 1,
        status: "out", dismissal_type: "caught",
        dismissed_by_id: arshadKhan.id, fielder_id: josButtler.id,
        dismissal_desc: "c Jos Buttler b Arshad Khan",
      },
      {
        innings_id: inn2.id, player_id: jiteshSharma.id, batting_position: 7,
        runs: 11, balls_faced: 14, fours: 1, sixes: 0,
        status: "not_out", dismissal_desc: "not out",
      },
      {
        innings_id: inn2.id, player_id: romarioShepherd.id, batting_position: 8,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0,
        status: "yet_to_bat", dismissal_desc: "did not bat",
      },
      {
        innings_id: inn2.id, player_id: bhuvneshwarKumar.id, batting_position: 9,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0,
        status: "yet_to_bat", dismissal_desc: "did not bat",
      },
      {
        innings_id: inn2.id, player_id: joshHazlewood.id, batting_position: 10,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0,
        status: "yet_to_bat", dismissal_desc: "did not bat",
      },
      {
        innings_id: inn2.id, player_id: rasikhSalam.id, batting_position: 11,
        runs: 0, balls_faced: 0, fours: 0, sixes: 0,
        status: "yet_to_bat", dismissal_desc: "did not bat",
      },
    ],
  });

  // ── GT Bowling in Innings 2 ──────────────────────────────────────────────────
  // Total: 18 ov (108 balls), 5 wkts, 159 runs + 2 extras = 161
  await prisma.bowlingEntry.createMany({
    data: [
      { innings_id: inn2.id, player_id: mohammedSiraj.id,  balls: 24, maidens: 0, runs_conceded: 36, wickets: 1, wides: 1, no_balls: 0, dot_balls: 8 },
      { innings_id: inn2.id, player_id: kagisoRabada.id,   balls: 18, maidens: 0, runs_conceded: 44, wickets: 1, wides: 0, no_balls: 0, dot_balls: 4 },
      { innings_id: inn2.id, player_id: jasonHolder.id,    balls: 12, maidens: 0, runs_conceded: 16, wickets: 0, wides: 0, no_balls: 0, dot_balls: 5 },
      { innings_id: inn2.id, player_id: rashidKhan.id,     balls: 24, maidens: 0, runs_conceded: 25, wickets: 2, wides: 0, no_balls: 0, dot_balls: 9 },
      { innings_id: inn2.id, player_id: arshadKhan.id,     balls: 24, maidens: 0, runs_conceded: 32, wickets: 1, wides: 0, no_balls: 0, dot_balls: 7 },
      { innings_id: inn2.id, player_id: prassidhKrishna.id,balls:  6, maidens: 0, runs_conceded:  7, wickets: 0, wides: 0, no_balls: 0, dot_balls: 3 },
    ],
  });

  // ── GT Fielding in Innings 2 ─────────────────────────────────────────────────
  await prisma.fieldingEntry.createMany({
    data: [
      { innings_id: inn2.id, player_id: kagisoRabada.id, catches: 2, impact_score: 2 },
      { innings_id: inn2.id, player_id: arshadKhan.id,   catches: 1, impact_score: 1 },
      { innings_id: inn2.id, player_id: josButtler.id,   catches: 1, impact_score: 1 },
    ],
  });

  // ── Partnerships — RCB Innings 2 ─────────────────────────────────────────────
  // FOW: 1-62(Iyer,4.3) 2-63(Padikkal,5.1) 3-89(Patidar,8.2) 4-91(Krunal,8.5) 5-132(David,13.6)
  await prisma.partnership.createMany({
    data: [
      { innings_id: inn2.id, wicket_number: 0, player1_id: venkateshIyer.id,  player2_id: viratKohli.id,   runs: 62, balls: 27, fours: 7, sixes: 2, is_unbroken: false, ended_over: 4,  ended_ball: 3 },
      { innings_id: inn2.id, wicket_number: 1, player1_id: viratKohli.id,     player2_id: devduttPadikkal.id, runs: 1, balls: 4, fours: 0, sixes: 0, is_unbroken: false, ended_over: 5,  ended_ball: 1 },
      { innings_id: inn2.id, wicket_number: 2, player1_id: viratKohli.id,     player2_id: rajatPatidar.id, runs: 26, balls: 19, fours: 2, sixes: 2, is_unbroken: false, ended_over: 8,  ended_ball: 2 },
      { innings_id: inn2.id, wicket_number: 3, player1_id: viratKohli.id,     player2_id: krunalPandya.id, runs:  2, balls:  3, fours: 0, sixes: 0, is_unbroken: false, ended_over: 8,  ended_ball: 5 },
      { innings_id: inn2.id, wicket_number: 4, player1_id: viratKohli.id,     player2_id: timDavid.id,     runs: 41, balls: 31, fours: 5, sixes: 2, is_unbroken: false, ended_over: 13, ended_ball: 6 },
      { innings_id: inn2.id, wicket_number: 5, player1_id: viratKohli.id,     player2_id: jiteshSharma.id, runs: 29, balls: 24, fours: 4, sixes: 1, is_unbroken: true,  ended_over: 18, ended_ball: 0 },
    ],
  });
  console.log("  ✔ Innings 2 (RCB 161/5): batting, bowling, fielding, partnerships");

  // ════════════════════════════════════════════════════════════════════════════
  // Career Stats
  // ════════════════════════════════════════════════════════════════════════════
  await prisma.playerCareerStats.createMany({
    data: [
      // Notable performers — single-match career snapshot
      {
        player_id: viratKohli.id,
        matches_played: 1, innings_batted: 1,
        total_runs: 75, balls_faced: 42,
        highest_score: 75, not_outs: 1,
        hundreds: 0, fifties: 1,
        fours: 9, sixes: 3,
        innings_bowled: 0, balls_bowled: 0, runs_conceded: 0, wickets: 0, maidens: 0,
      },
      {
        player_id: washingtonSundar.id,
        matches_played: 1, innings_batted: 1,
        total_runs: 50, balls_faced: 37,
        highest_score: 50, not_outs: 1,
        hundreds: 0, fifties: 1,
        fours: 5, sixes: 0,
        innings_bowled: 0, balls_bowled: 0, runs_conceded: 0, wickets: 0, maidens: 0,
      },
      {
        player_id: rasikhSalam.id,
        matches_played: 1, innings_batted: 0,
        total_runs: 0, balls_faced: 0, highest_score: 0, not_outs: 0,
        innings_bowled: 1, balls_bowled: 24, runs_conceded: 27, wickets: 3,
        maidens: 0, five_wicket_hauls: 0,
        best_bowling_wickets: 3, best_bowling_runs: 27,
      },
      {
        player_id: rashidKhan.id,
        matches_played: 1, innings_batted: 1,
        total_runs: 7, balls_faced: 3, highest_score: 7, not_outs: 0,
        fours: 0, sixes: 1,
        innings_bowled: 1, balls_bowled: 24, runs_conceded: 25, wickets: 2,
        maidens: 0, best_bowling_wickets: 2, best_bowling_runs: 25,
      },
      {
        player_id: venkateshIyer.id,
        matches_played: 1, innings_batted: 1,
        total_runs: 32, balls_faced: 16, highest_score: 32, not_outs: 0,
        fours: 4, sixes: 2, hundreds: 0, fifties: 0,
        innings_bowled: 0, balls_bowled: 0, runs_conceded: 0, wickets: 0, maidens: 0,
      },
      {
        player_id: bhuvneshwarKumar.id,
        matches_played: 1, innings_batted: 0,
        total_runs: 0, balls_faced: 0, highest_score: 0, not_outs: 0,
        innings_bowled: 1, balls_bowled: 24, runs_conceded: 29, wickets: 2,
        maidens: 0, best_bowling_wickets: 2, best_bowling_runs: 29,
      },
      {
        player_id: joshHazlewood.id,
        matches_played: 1, innings_batted: 0,
        total_runs: 0, balls_faced: 0, highest_score: 0, not_outs: 0,
        innings_bowled: 1, balls_bowled: 24, runs_conceded: 37, wickets: 2,
        maidens: 0, best_bowling_wickets: 2, best_bowling_runs: 37,
      },
    ],
  });
  console.log("  ✔ Career stats: 7 notable performers");

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n🏆  IPL 2026 Final seeded successfully!");
  console.log("   Match ID    :", match.id);
  console.log("   Innings 1 ID:", inn1.id, "(GT 155/8)");
  console.log("   Innings 2 ID:", inn2.id, "(RCB 161/5)");
  console.log("\n   Toss   : RCB won, elected to field");
  console.log("   Result : RCB won by 5 wickets (12 balls remaining)");
  console.log("   POTM   : Virat Kohli — 75* off 42 balls (9×4, 3×6)");
  console.log("\n   GT  Highlights: Washington Sundar 50* (37), Rasikh Salam 3/27");
  console.log("   RCB Highlights: Virat Kohli 75* (42), Venkatesh Iyer 32 (16)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
