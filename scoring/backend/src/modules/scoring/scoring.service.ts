import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";

// ── Guards ───────────────────────────────────────────────────────────────────

function canManage(role: string) {
  return role === "organizer" || role === "admin" || role === "scorer";
}

async function assertManager(tournamentId: string, actorId: string, actorRole: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw NotFound("Tournament not found");
  if (t.created_by !== actorId && actorRole !== "admin") throw Forbidden("Not authorized to manage this tournament");
  return t;
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export async function listTournaments(sport?: string, status?: string, page = 1, limit = 20) {
  const where: any = { is_public: true };
  if (sport) where.sport = sport.toLowerCase();
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    prisma.tournament.count({ where }),
    prisma.tournament.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { teams: true, matches: true } } }
    })
  ]);
  return { total, page, limit, items };
}

export async function getTournament(id: string) {
  const t = await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: {
        include: {
          players: { orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }] }
        }
      },
      matches: {
        orderBy: [{ match_number: "asc" }, { scheduled_at: "asc" }],
        include: {
          team1: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
          team2: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
          innings: {
            select: {
              id: true, innings_number: true, batting_team_id: true,
              total_runs: true, total_wickets: true, total_balls: true,
              is_completed: true, target: true
            }
          }
        }
      }
    }
  });
  if (!t) throw NotFound("Tournament not found");
  return t;
}

export async function createTournament(actorId: string, actorRole: string, input: any) {
  if (!canManage(actorRole)) throw Forbidden("Only organizers can create tournaments");
  return prisma.tournament.create({
    data: {
      name: input.name,
      sport: input.sport.toLowerCase(),
      format: input.format,
      description: input.description,
      start_date: input.start_date,
      end_date: input.end_date,
      location: input.location,
      logo_url: input.logo_url,
      banner_url: input.banner_url,
      is_public: input.is_public ?? true,
      created_by: actorId
    }
  });
}

export async function updateTournament(id: string, actorId: string, actorRole: string, patch: any) {
  await assertManager(id, actorId, actorRole);
  const fields = ["name", "sport", "format", "description", "start_date", "end_date", "location", "logo_url", "banner_url", "status", "is_public"];
  const data: any = {};
  for (const k of fields) if (patch[k] !== undefined) data[k] = patch[k];
  return prisma.tournament.update({ where: { id }, data });
}

export async function deleteTournament(id: string, actorId: string, actorRole: string) {
  await assertManager(id, actorId, actorRole);
  await prisma.tournament.delete({ where: { id } });
  return { deleted: true };
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function createTeam(tournamentId: string, actorId: string, actorRole: string, input: any) {
  await assertManager(tournamentId, actorId, actorRole);
  return prisma.team.create({
    data: { tournament_id: tournamentId, name: input.name, short_name: input.short_name, logo_url: input.logo_url, color: input.color }
  });
}

export async function updateTeam(tournamentId: string, teamId: string, actorId: string, actorRole: string, patch: any) {
  await assertManager(tournamentId, actorId, actorRole);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.tournament_id !== tournamentId) throw NotFound("Team not found");
  const data: any = {};
  for (const k of ["name", "short_name", "logo_url", "color"]) if (patch[k] !== undefined) data[k] = patch[k];
  return prisma.team.update({ where: { id: teamId }, data });
}

export async function deleteTeam(tournamentId: string, teamId: string, actorId: string, actorRole: string) {
  await assertManager(tournamentId, actorId, actorRole);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.tournament_id !== tournamentId) throw NotFound("Team not found");
  await prisma.team.delete({ where: { id: teamId } });
  return { deleted: true };
}

// ── Players ───────────────────────────────────────────────────────────────────

export async function createPlayer(tournamentId: string, teamId: string, actorId: string, actorRole: string, input: any) {
  await assertManager(tournamentId, actorId, actorRole);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.tournament_id !== tournamentId) throw NotFound("Team not found");
  return prisma.player.create({
    data: {
      team_id: teamId,
      name: input.name,
      jersey_number: input.jersey_number,
      role: input.role,
      batting_style: input.batting_style,
      bowling_style: input.bowling_style,
      is_captain: input.is_captain ?? false,
      is_keeper: input.is_keeper ?? false,
      photo_url: input.photo_url,
      sportivox_user_id: input.sportivox_user_id
    }
  });
}

export async function updatePlayer(tournamentId: string, teamId: string, playerId: string, actorId: string, actorRole: string, patch: any) {
  await assertManager(tournamentId, actorId, actorRole);
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.team_id !== teamId) throw NotFound("Player not found");
  const data: any = {};
  for (const k of ["name", "jersey_number", "role", "batting_style", "bowling_style", "is_captain", "is_keeper", "photo_url"]) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  return prisma.player.update({ where: { id: playerId }, data });
}

export async function deletePlayer(tournamentId: string, teamId: string, playerId: string, actorId: string, actorRole: string) {
  await assertManager(tournamentId, actorId, actorRole);
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.team_id !== teamId) throw NotFound("Player not found");
  await prisma.player.delete({ where: { id: playerId } });
  return { deleted: true };
}

export async function getPlayerStats(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      team: { select: { id: true, name: true, short_name: true, tournament_id: true } },
      batting_entries: { include: { innings: { select: { match_id: true } } } },
      bowling_entries: { include: { innings: { select: { match_id: true } } } }
    }
  });
  if (!player) throw NotFound("Player not found");

  const bat = player.batting_entries;
  const bowl = player.bowling_entries;

  const innings_batted = bat.filter(b => b.status !== "yet_to_bat").length;
  const dismissals = bat.filter(b => b.status === "out").length;
  const total_runs = bat.reduce((s, b) => s + b.runs, 0);
  const total_balls = bat.reduce((s, b) => s + b.balls_faced, 0);

  const battingStats = {
    matches: new Set(bat.map(b => b.innings.match_id)).size,
    innings: innings_batted,
    runs: total_runs,
    balls: total_balls,
    fours: bat.reduce((s, b) => s + b.fours, 0),
    sixes: bat.reduce((s, b) => s + b.sixes, 0),
    dismissals,
    not_outs: bat.filter(b => b.status === "not_out").length,
    highest: bat.length > 0 ? Math.max(...bat.map(b => b.runs)) : 0,
    average: dismissals > 0 ? parseFloat((total_runs / dismissals).toFixed(2)) : total_runs,
    strike_rate: total_balls > 0 ? parseFloat(((total_runs / total_balls) * 100).toFixed(2)) : 0,
    fifties: bat.filter(b => b.runs >= 50 && b.runs < 100).length,
    hundreds: bat.filter(b => b.runs >= 100).length
  };

  const bowl_balls = bowl.reduce((s, b) => s + b.balls, 0);
  const bowl_runs = bowl.reduce((s, b) => s + b.runs_conceded, 0);
  const bowl_wickets = bowl.reduce((s, b) => s + b.wickets, 0);

  const bowlingStats = {
    matches: new Set(bowl.map(b => b.innings.match_id)).size,
    innings: bowl.length,
    balls: bowl_balls,
    overs: parseFloat(((Math.floor(bowl_balls / 6)) + "." + (bowl_balls % 6)).toString()),
    runs: bowl_runs,
    wickets: bowl_wickets,
    maidens: bowl.reduce((s, b) => s + b.maidens, 0),
    economy: bowl_balls > 0 ? parseFloat(((bowl_runs / bowl_balls) * 6).toFixed(2)) : 0,
    average: bowl_wickets > 0 ? parseFloat((bowl_runs / bowl_wickets).toFixed(2)) : 0,
    strike_rate: bowl_wickets > 0 ? parseFloat((bowl_balls / bowl_wickets).toFixed(2)) : 0,
    five_wickets: bowl.filter(b => b.wickets >= 5).length,
    best: bowl.length > 0
      ? (() => {
          const b = bowl.reduce((best, e) =>
            e.wickets > best.wickets || (e.wickets === best.wickets && e.runs_conceded < best.runs_conceded) ? e : best
          );
          return `${b.wickets}/${b.runs_conceded}`;
        })()
      : "-"
  };

  return {
    player: {
      id: player.id, name: player.name, role: player.role,
      batting_style: player.batting_style, bowling_style: player.bowling_style,
      is_captain: player.is_captain, jersey_number: player.jersey_number,
      photo_url: player.photo_url, team: player.team
    },
    battingStats,
    bowlingStats
  };
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function createMatch(tournamentId: string, actorId: string, actorRole: string, input: any) {
  const t = await assertManager(tournamentId, actorId, actorRole);
  return prisma.match.create({
    data: {
      tournament_id: tournamentId,
      sport: t.sport,
      format: input.format ?? t.format,
      team1_id: input.team1_id,
      team2_id: input.team2_id,
      title: input.title,
      match_number: input.match_number,
      venue: input.venue,
      scheduled_at: input.scheduled_at ? new Date(input.scheduled_at) : undefined
    },
    include: {
      team1: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      team2: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } }
    }
  });
}

export async function getMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: { include: { players: { orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }] } } },
      team2: { include: { players: { orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }] } } },
      innings: {
        orderBy: { innings_number: "asc" },
        include: {
          batting_entries: {
            orderBy: { batting_position: "asc" },
            include: { player: { select: { id: true, name: true, jersey_number: true, is_captain: true, is_keeper: true } } }
          },
          bowling_entries: {
            orderBy: [{ wickets: "desc" }, { runs_conceded: "asc" }],
            include: { player: { select: { id: true, name: true } } }
          }
        }
      },
      events: { orderBy: { minute: "asc" } }
    }
  });
  if (!match) throw NotFound("Match not found");
  return match;
}

export async function getLiveMatches() {
  return prisma.match.findMany({
    where: { status: "live" },
    orderBy: { updated_at: "desc" },
    include: {
      tournament: { select: { id: true, name: true, sport: true } },
      team1: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      team2: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      innings: {
        select: {
          innings_number: true, batting_team_id: true,
          total_runs: true, total_wickets: true, total_balls: true, is_completed: true
        }
      }
    }
  });
}

export async function updateMatch(matchId: string, actorId: string, actorRole: string, patch: any) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const data: any = {};
  for (const k of ["title", "venue", "status", "winner_team_id", "result_summary", "toss_winner_id", "toss_decision"]) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (patch.scheduled_at) data.scheduled_at = new Date(patch.scheduled_at);

  return prisma.match.update({ where: { id: matchId }, data });
}

export async function deleteMatch(matchId: string, actorId: string, actorRole: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);
  await prisma.match.delete({ where: { id: matchId } });
  return { deleted: true };
}

// ── Cricket Innings ───────────────────────────────────────────────────────────

export async function createInnings(matchId: string, actorId: string, actorRole: string, input: any) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const existing = await prisma.innings.findUnique({
    where: { match_id_innings_number: { match_id: matchId, innings_number: input.innings_number } }
  });
  if (existing) throw BadRequest("This innings already exists");

  if (match.status === "upcoming") {
    await prisma.match.update({ where: { id: matchId }, data: { status: "live" } });
  }

  const innings = await prisma.innings.create({
    data: {
      match_id: matchId,
      innings_number: input.innings_number,
      batting_team_id: input.batting_team_id,
      bowling_team_id: input.bowling_team_id,
      target: input.target
    }
  });

  // Auto-create batting lineup stubs from the batting team's players
  const players = await prisma.player.findMany({
    where: { team_id: input.batting_team_id },
    orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }]
  });
  if (players.length > 0) {
    await prisma.battingEntry.createMany({
      data: players.map((p, i) => ({
        innings_id: innings.id,
        player_id: p.id,
        batting_position: i + 1
      })),
      skipDuplicates: true
    });
  }

  // Auto-create bowling stubs for bowling team
  const bowlers = await prisma.player.findMany({
    where: { team_id: input.bowling_team_id },
    orderBy: { jersey_number: "asc" }
  });
  if (bowlers.length > 0) {
    await prisma.bowlingEntry.createMany({
      data: bowlers.map(p => ({ innings_id: innings.id, player_id: p.id })),
      skipDuplicates: true
    });
  }

  return innings;
}

export async function updateInnings(inningsId: string, actorId: string, actorRole: string, patch: any) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const data: any = {};
  if (patch.is_declared !== undefined) data.is_declared = patch.is_declared;
  if (patch.is_completed !== undefined) data.is_completed = patch.is_completed;
  if (patch.target !== undefined) data.target = patch.target;

  return prisma.innings.update({ where: { id: inningsId }, data });
}

// ── Phase / derivations (PPTX § Team Analytics) ──────────────────────────────

const DEFAULT_PHASES = { pp_end: 6, mid_end: 15, death_end: 20 };

function computePhase(overNumber: number, format: string | null | undefined, ppOvers: any) {
  const cfg = ppOvers || (() => {
    if (format === "T20") return { pp_end: 6, mid_end: 15, death_end: 20 };
    if (format === "ODI") return { pp_end: 10, mid_end: 40, death_end: 50 };
    return DEFAULT_PHASES;
  })();
  if (overNumber < (cfg.pp_end ?? 6)) return "pp";
  if (overNumber < (cfg.mid_end ?? 15)) return "mid";
  return "death";
}

function projectedScore(currentRuns: number, ballsBowled: number, oversTotal: number) {
  if (ballsBowled === 0 || !oversTotal) return null;
  const ballsTotal = oversTotal * 6;
  const runRate = currentRuns / ballsBowled;
  return Math.round(runRate * ballsTotal);
}

function winProbability(
  battingTeamRuns: number, ballsBowled: number, wickets: number,
  target: number | null | undefined, oversTotal: number | null | undefined
) {
  // Simplified WP heuristic for live UX (PPTX § Live Innings Tracking).
  // First innings: track scoring rate vs par; second innings: chase math.
  if (!oversTotal) return null;
  const ballsTotal = oversTotal * 6;
  const ballsRemaining = Math.max(ballsTotal - ballsBowled, 0);

  if (target && target > 0) {
    if (battingTeamRuns >= target) return 100;
    if (wickets >= 10 || ballsRemaining === 0) return 0;
    const runsNeeded = target - battingTeamRuns;
    const reqRate = (runsNeeded / ballsRemaining) * 6;
    const wktsInHand = 10 - wickets;
    // logistic-ish on rrr & wickets in hand
    const rateScore = Math.max(0, Math.min(1, (12 - reqRate) / 12));
    const wktScore = wktsInHand / 10;
    return parseFloat(((rateScore * 0.7 + wktScore * 0.3) * 100).toFixed(1));
  } else {
    // first innings — par ≈ runs per remaining ball, capped at 50/50 baseline
    const proj = projectedScore(battingTeamRuns, ballsBowled, oversTotal) ?? 0;
    const par = oversTotal === 20 ? 160 : oversTotal === 50 ? 280 : oversTotal * 8;
    const wktScore = (10 - wickets) / 10;
    const projScore = Math.max(0, Math.min(1, proj / (par * 1.5)));
    return parseFloat(((projScore * 0.6 + wktScore * 0.4) * 100).toFixed(1));
  }
}

function momentumIndex(recentBalls: { is_wicket: boolean; runs: number; is_four: boolean; is_six: boolean; is_dot: boolean }[]) {
  if (recentBalls.length === 0) return 0;
  // Last 12 balls: +0.15 per boundary, -0.25 per wicket, -0.05 per dot, +0.05 per run.
  let score = 0;
  for (const b of recentBalls) {
    if (b.is_wicket) score -= 0.25;
    if (b.is_four) score += 0.15;
    if (b.is_six) score += 0.20;
    if (b.is_dot && !b.is_wicket) score -= 0.05;
    if (!b.is_dot && !b.is_wicket) score += 0.02 * Math.min(b.runs, 3);
  }
  return parseFloat(Math.max(-1, Math.min(1, score / recentBalls.length * 3)).toFixed(2));
}

// ── Ball-by-ball live scoring ─────────────────────────────────────────────────

export async function addBall(inningsId: string, actorId: string, actorRole: string, input: any) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  if (innings.is_completed) throw BadRequest("Innings is already completed");

  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const tournament = await prisma.tournament.findUnique({ where: { id: match.tournament_id } });

  const {
    over_number, ball_number, batsman_id, bowler_id, non_striker_id,
    runs = 0, is_wide = false, is_no_ball = false, is_bye = false, is_leg_bye = false,
    is_penalty = false, is_wicket = false, is_four = false, is_six = false, is_free_hit = false,
    shot_type, ball_line, ball_length, bowler_variant, delivery_outcome,
    wicket_type, dismissed_player_id, fielder_id, fielder_name,
    fielding_position, dismissal_zone, ball_trajectory, commentary
  } = input;

  const isLegal = !is_wide && !is_no_ball;
  const batsmanRuns = (is_bye || is_leg_bye) ? 0 : runs;
  const extraRuns = is_wide ? runs + 1 : is_no_ball ? 1 : 0;
  const byeRuns = (is_bye || is_leg_bye) ? runs : 0;
  const totalRuns = batsmanRuns + extraRuns + byeRuns + (is_penalty ? 5 : 0);
  const isDot = isLegal && totalRuns === 0 && !is_wicket;
  const phase = computePhase(over_number, match.format, (tournament?.powerplay_overs as any) ?? null);

  // Ball event row with full PPTX fields
  const ball = await prisma.ballEvent.create({
    data: {
      innings_id: inningsId,
      over_number, ball_number,
      batsman_id, bowler_id, non_striker_id,
      runs,
      is_wide, is_no_ball, is_bye, is_leg_bye, is_penalty,
      is_wicket, is_four, is_six, is_free_hit, is_dot: isDot,
      shot_type, ball_line, ball_length, bowler_variant, delivery_outcome,
      phase,
      wicket_type, dismissed_player_id, fielder_id, fielder_name,
      fielding_position, dismissal_zone, ball_trajectory,
      commentary
    }
  });

  // Phase increment helpers
  const phaseInc = (key: "pp" | "mid" | "death") => ({
    [`${key}_runs`]: phase === key ? { increment: totalRuns } : undefined,
    [`${key}_balls`]: phase === key && isLegal ? { increment: 1 } : undefined,
    [`${key}_wickets`]: phase === key && is_wicket ? { increment: 1 } : undefined
  });

  // Innings totals + phase splits + counters
  await prisma.innings.update({
    where: { id: inningsId },
    data: {
      total_runs: { increment: totalRuns },
      total_wickets: is_wicket ? { increment: 1 } : undefined,
      total_balls: isLegal ? { increment: 1 } : undefined,
      extras: { increment: extraRuns + byeRuns + (is_penalty ? 5 : 0) },
      wides: is_wide ? { increment: runs + 1 } : undefined,
      no_balls: is_no_ball ? { increment: 1 } : undefined,
      byes: is_bye ? { increment: runs } : undefined,
      leg_byes: is_leg_bye ? { increment: runs } : undefined,
      penalty_runs: is_penalty ? { increment: 5 } : undefined,
      boundary_4s: is_four ? { increment: 1 } : undefined,
      boundary_6s: is_six ? { increment: 1 } : undefined,
      dot_balls: isDot ? { increment: 1 } : undefined,
      ...phaseInc("pp"), ...phaseInc("mid"), ...phaseInc("death")
    }
  });

  // Batsman stats with PPTX shot detail counters
  const oneRun = batsmanRuns === 1;
  const twoRun = batsmanRuns === 2;
  const threeRun = batsmanRuns === 3;
  await prisma.battingEntry.upsert({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: batsman_id } },
    create: {
      innings_id: inningsId, player_id: batsman_id, batting_position: 99,
      runs: batsmanRuns, balls_faced: isLegal ? 1 : 0,
      fours: is_four ? 1 : 0, sixes: is_six ? 1 : 0,
      dot_balls: isDot ? 1 : 0,
      singles: oneRun ? 1 : 0, doubles: twoRun ? 1 : 0, threes: threeRun ? 1 : 0,
      status: "not_out"
    },
    update: {
      runs: { increment: batsmanRuns },
      balls_faced: isLegal ? { increment: 1 } : undefined,
      fours: is_four ? { increment: 1 } : undefined,
      sixes: is_six ? { increment: 1 } : undefined,
      dot_balls: isDot ? { increment: 1 } : undefined,
      singles: oneRun ? { increment: 1 } : undefined,
      doubles: twoRun ? { increment: 1 } : undefined,
      threes: threeRun ? { increment: 1 } : undefined,
      status: "not_out"
    }
  });

  // Dismiss out batsman + capture dismissal context for scorecard view
  if (is_wicket && dismissed_player_id) {
    const bowlerCredit = ["caught", "bowled", "lbw", "stumped", "hit_wicket", "cb"].includes(wicket_type ?? "");
    await prisma.battingEntry.updateMany({
      where: { innings_id: inningsId, player_id: dismissed_player_id },
      data: {
        status: "out",
        dismissal_type: wicket_type,
        dismissed_by_id: bowlerCredit ? bowler_id : null,
        fielder_id: fielder_id ?? null,
        dismissal_shot: shot_type ?? null,
        dismissal_line: ball_line ?? null,
        dismissal_length: ball_length ?? null,
        dismissal_bowler_type: bowler_variant ?? null,
        dismissal_zone: dismissal_zone ?? null,
        dismissal_trajectory: ball_trajectory ?? null,
        dismissal_fielding_position: fielding_position ?? null
      }
    });
  }

  // Bowler stats with phase splits
  const bowlerRunsConceded = batsmanRuns + (is_wide ? runs + 1 : 0) + (is_no_ball ? 1 : 0);
  const bowlerWicket = is_wicket && !["run_out", "obstructing_field", "handled_ball", "retired_hurt"].includes(wicket_type ?? "");
  const bowlPhaseInc = (key: "pp" | "mid" | "death") => ({
    [`${key}_runs`]: phase === key ? { increment: bowlerRunsConceded } : undefined,
    [`${key}_balls`]: phase === key && isLegal ? { increment: 1 } : undefined,
    [`${key}_wickets`]: phase === key && bowlerWicket ? { increment: 1 } : undefined
  });
  await prisma.bowlingEntry.upsert({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: bowler_id } },
    create: {
      innings_id: inningsId, player_id: bowler_id,
      balls: isLegal ? 1 : 0, runs_conceded: bowlerRunsConceded,
      wickets: bowlerWicket ? 1 : 0,
      wides: is_wide ? 1 : 0, no_balls: is_no_ball ? 1 : 0,
      dot_balls: isDot ? 1 : 0,
      boundaries_4s: is_four ? 1 : 0, boundaries_6s: is_six ? 1 : 0,
      pp_runs: phase === "pp" ? bowlerRunsConceded : 0, pp_balls: phase === "pp" && isLegal ? 1 : 0, pp_wickets: phase === "pp" && bowlerWicket ? 1 : 0,
      mid_runs: phase === "mid" ? bowlerRunsConceded : 0, mid_balls: phase === "mid" && isLegal ? 1 : 0, mid_wickets: phase === "mid" && bowlerWicket ? 1 : 0,
      death_runs: phase === "death" ? bowlerRunsConceded : 0, death_balls: phase === "death" && isLegal ? 1 : 0, death_wickets: phase === "death" && bowlerWicket ? 1 : 0
    },
    update: {
      balls: isLegal ? { increment: 1 } : undefined,
      runs_conceded: { increment: bowlerRunsConceded },
      wickets: bowlerWicket ? { increment: 1 } : undefined,
      wides: is_wide ? { increment: 1 } : undefined,
      no_balls: is_no_ball ? { increment: 1 } : undefined,
      dot_balls: isDot ? { increment: 1 } : undefined,
      boundaries_4s: is_four ? { increment: 1 } : undefined,
      boundaries_6s: is_six ? { increment: 1 } : undefined,
      ...bowlPhaseInc("pp"), ...bowlPhaseInc("mid"), ...bowlPhaseInc("death")
    }
  });

  // Fielding entry — catches, drops, run-outs, stumpings, assists
  if (is_wicket && fielder_id) {
    const isCatch = wicket_type === "caught" || wicket_type === "cb";
    const isRunOut = wicket_type === "run_out";
    const isStump = wicket_type === "stumped";
    if (isCatch || isRunOut || isStump) {
      await prisma.fieldingEntry.upsert({
        where: { innings_id_player_id: { innings_id: inningsId, player_id: fielder_id } },
        create: {
          innings_id: inningsId, player_id: fielder_id,
          catches: isCatch ? 1 : 0,
          run_outs_direct: isRunOut ? 1 : 0,
          stumpings: isStump ? 1 : 0,
          direct_hits: isRunOut ? 1 : 0,
          impact_score: 1
        },
        update: {
          catches: isCatch ? { increment: 1 } : undefined,
          run_outs_direct: isRunOut ? { increment: 1 } : undefined,
          stumpings: isStump ? { increment: 1 } : undefined,
          direct_hits: isRunOut ? { increment: 1 } : undefined,
          impact_score: { increment: 1 }
        }
      });
    }
  }

  // Partnership tracking — open on first ball, close on wicket of dismissed_player
  await updatePartnerships(inningsId, {
    runs: totalRuns, isLegal, batsman_id, non_striker_id,
    is_wicket, dismissed_player_id, over_number, ball_number,
    is_four, is_six
  });

  // Recompute derived: projected score / win probability / momentum
  const recent = await prisma.ballEvent.findMany({
    where: { innings_id: inningsId },
    orderBy: { created_at: "desc" }, take: 12,
    select: { is_wicket: true, runs: true, is_four: true, is_six: true, is_dot: true }
  });
  const fresh = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (fresh) {
    const oversTotal = tournament?.overs_per_innings ?? (match.format === "T20" ? 20 : match.format === "ODI" ? 50 : null);
    const proj = projectedScore(fresh.total_runs, fresh.total_balls, oversTotal ?? 0);
    const wp = winProbability(fresh.total_runs, fresh.total_balls, fresh.total_wickets, fresh.target, oversTotal);
    const mom = momentumIndex(recent);
    await prisma.innings.update({
      where: { id: inningsId },
      data: { projected_score: proj, win_probability: wp, momentum_index: mom }
    });
  }

  return { ball, innings_id: inningsId };
}

// ── Partnerships ─────────────────────────────────────────────────────────────

async function updatePartnerships(
  inningsId: string,
  ev: {
    runs: number; isLegal: boolean; batsman_id: string; non_striker_id?: string;
    is_wicket: boolean; dismissed_player_id?: string; over_number: number; ball_number: number;
    is_four: boolean; is_six: boolean;
  }
) {
  // find unbroken partnership
  let pship = await prisma.partnership.findFirst({
    where: { innings_id: inningsId, is_unbroken: true },
    orderBy: { wicket_number: "desc" }
  });

  if (!pship) {
    // open one with current batsman and non-striker (if known)
    const wicketsSoFar = (await prisma.innings.findUnique({ where: { id: inningsId } }))?.total_wickets ?? 0;
    pship = await prisma.partnership.create({
      data: {
        innings_id: inningsId,
        wicket_number: wicketsSoFar,
        player1_id: ev.batsman_id,
        player2_id: ev.non_striker_id ?? ev.batsman_id,
        runs: ev.runs, balls: ev.isLegal ? 1 : 0,
        fours: ev.is_four ? 1 : 0, sixes: ev.is_six ? 1 : 0
      }
    });
  } else {
    await prisma.partnership.update({
      where: { id: pship.id },
      data: {
        runs: { increment: ev.runs },
        balls: ev.isLegal ? { increment: 1 } : undefined,
        fours: ev.is_four ? { increment: 1 } : undefined,
        sixes: ev.is_six ? { increment: 1 } : undefined
      }
    });
  }

  if (ev.is_wicket && pship) {
    await prisma.partnership.update({
      where: { id: pship.id },
      data: { is_unbroken: false, ended_over: ev.over_number, ended_ball: ev.ball_number }
    });
  }
}

export async function listPartnerships(inningsId: string) {
  const rows = await prisma.partnership.findMany({
    where: { innings_id: inningsId },
    orderBy: { wicket_number: "asc" }
  });
  return rows;
}

// ── Match configuration (PPTX § Match & Innings setup) ──────────────────────

export async function updateMatchConfig(matchId: string, actorId: string, actorRole: string, patch: any) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  // Cricket config is stored on Tournament — propagate from organizer match dashboard.
  const data: any = {};
  for (const k of [
    "overs_per_innings", "number_of_innings", "ball_type", "powerplay_overs",
    "super_over_enabled", "dls_enabled", "free_hit_enabled", "no_ball_rule",
    "wide_rule", "tie_break_rule", "retired_hurt_allowed", "substitutes_allowed"
  ]) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  return prisma.tournament.update({ where: { id: match.tournament_id }, data });
}

// ── Analytics (PPTX § In-app · Scorecard & Analytics) ───────────────────────

export async function getInningsAnalytics(inningsId: string) {
  const innings = await prisma.innings.findUnique({
    where: { id: inningsId },
    include: { batting_entries: true, bowling_entries: true }
  });
  if (!innings) throw NotFound("Innings not found");

  const balls = await prisma.ballEvent.findMany({ where: { innings_id: inningsId } });

  // Dismissal patterns (PPTX § Analytics — Key Numbers: dismissed_outside_off %)
  const wickets = balls.filter(b => b.is_wicket);
  const total_w = wickets.length || 1;
  const pct = (n: number) => parseFloat(((n / total_w) * 100).toFixed(1));

  const dismissedOutsideOff = wickets.filter(b => b.ball_line === "outside_off" || b.ball_line === "outside_off_wide").length;
  const wktsOffSpin = wickets.filter(b => ["ob", "lb", "googly", "sla", "slw", "doosra", "carrom", "teesra"].includes(b.bowler_variant ?? "")).length;
  const wktsOffPace = wickets.filter(b => ["rf", "rfm", "rmf", "rm", "lf", "lfm", "lm"].includes(b.bowler_variant ?? "")).length;

  // Length distribution (pitch map: PPTX § Bowler · Length distribution chart)
  const lengthCounts: Record<string, { balls: number; runs: number; wickets: number; dots: number }> = {};
  for (const b of balls) {
    const k = b.ball_length || "unknown";
    lengthCounts[k] ??= { balls: 0, runs: 0, wickets: 0, dots: 0 };
    lengthCounts[k].balls++;
    lengthCounts[k].runs += b.runs;
    if (b.is_wicket) lengthCounts[k].wickets++;
    if (b.is_dot) lengthCounts[k].dots++;
  }

  // Line distribution
  const lineCounts: Record<string, { balls: number; runs: number; wickets: number; dots: number }> = {};
  for (const b of balls) {
    const k = b.ball_line || "unknown";
    lineCounts[k] ??= { balls: 0, runs: 0, wickets: 0, dots: 0 };
    lineCounts[k].balls++;
    lineCounts[k].runs += b.runs;
    if (b.is_wicket) lineCounts[k].wickets++;
    if (b.is_dot) lineCounts[k].dots++;
  }

  // Shot distribution (wagon-wheel proxy, PPTX § Strong scoring zone)
  const shotCounts: Record<string, { balls: number; runs: number; fours: number; sixes: number }> = {};
  for (const b of balls) {
    if (!b.shot_type || b.is_bye || b.is_leg_bye) continue;
    const k = b.shot_type;
    shotCounts[k] ??= { balls: 0, runs: 0, fours: 0, sixes: 0 };
    shotCounts[k].balls++;
    shotCounts[k].runs += b.runs;
    if (b.is_four) shotCounts[k].fours++;
    if (b.is_six) shotCounts[k].sixes++;
  }

  return {
    innings: {
      id: innings.id, runs: innings.total_runs, wickets: innings.total_wickets,
      balls: innings.total_balls, projected_score: innings.projected_score,
      win_probability: innings.win_probability, momentum_index: innings.momentum_index,
      boundary_4s: innings.boundary_4s, boundary_6s: innings.boundary_6s, dot_balls: innings.dot_balls,
      phase: {
        pp: { runs: innings.pp_runs, wickets: innings.pp_wickets, balls: innings.pp_balls },
        mid: { runs: innings.mid_runs, wickets: innings.mid_wickets, balls: innings.mid_balls },
        death: { runs: innings.death_runs, wickets: innings.death_wickets, balls: innings.death_balls }
      }
    },
    dismissal_patterns: {
      outside_off_pct: pct(dismissedOutsideOff),
      vs_spin_pct: pct(wktsOffSpin),
      vs_pace_pct: pct(wktsOffPace),
      total_wickets: wickets.length
    },
    length_distribution: lengthCounts,
    line_distribution: lineCounts,
    shot_distribution: shotCounts
  };
}

export async function getPlayerScouting(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw NotFound("Player not found");

  // Aggregate batting balls
  const balls = await prisma.ballEvent.findMany({ where: { batsman_id: playerId } });
  const dismissals = balls.filter(b => b.is_wicket && b.dismissed_player_id === playerId);

  const byLength: Record<string, { balls: number; runs: number; wkts: number }> = {};
  const byVariant: Record<string, { balls: number; runs: number; wkts: number }> = {};
  for (const b of balls) {
    const len = b.ball_length || "unknown";
    byLength[len] ??= { balls: 0, runs: 0, wkts: 0 };
    byLength[len].balls++;
    byLength[len].runs += b.runs;
    if (b.is_wicket && b.dismissed_player_id === playerId) byLength[len].wkts++;

    const vr = b.bowler_variant || "unknown";
    byVariant[vr] ??= { balls: 0, runs: 0, wkts: 0 };
    byVariant[vr].balls++;
    byVariant[vr].runs += b.runs;
    if (b.is_wicket && b.dismissed_player_id === playerId) byVariant[vr].wkts++;
  }

  // Latest scouting tags
  const latest = await prisma.battingEntry.findFirst({
    where: { player_id: playerId, NOT: { strong_zone: null } },
    orderBy: { updated_at: "desc" }
  });

  return {
    player: { id: player.id, name: player.name, role: player.role },
    by_length: byLength,
    by_bowler_variant: byVariant,
    dismissals_count: dismissals.length,
    tags: latest ? {
      strong_zone: latest.strong_zone, weak_zone: latest.weak_zone,
      strength_vs: latest.strength_vs, preferred_zone: latest.preferred_zone,
      notes: latest.scouting_notes
    } : null
  };
}

export async function setPlayerScouting(
  inningsId: string, playerId: string, actorId: string, actorRole: string, body: any
) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  return prisma.battingEntry.update({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: playerId } },
    data: {
      strong_zone: body.strong_zone, weak_zone: body.weak_zone,
      strength_vs: body.strength_vs, preferred_zone: body.preferred_zone,
      scouting_notes: body.scouting_notes
    }
  });
}

// ── Fielding (PPTX § Fielder) ────────────────────────────────────────────────

export async function listFielding(inningsId: string) {
  return prisma.fieldingEntry.findMany({
    where: { innings_id: inningsId },
    include: { player: { select: { id: true, name: true, is_keeper: true } } },
    orderBy: { impact_score: "desc" }
  });
}

export async function logFieldingEvent(
  inningsId: string, actorId: string, actorRole: string, body: any
) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const { player_id, event_type } = body;
  if (!player_id) throw BadRequest("player_id required");

  // event_type ∈ catch · drop · run_out_assist · misfield · direct_hit · assist
  const delta: any = {};
  switch (event_type) {
    case "catch": delta.catches = { increment: 1 }; delta.impact_score = { increment: 1 }; break;
    case "drop": delta.drops = { increment: 1 }; delta.impact_score = { increment: -1 }; break;
    case "run_out_assist": delta.run_outs_assist = { increment: 1 }; delta.impact_score = { increment: 1 }; break;
    case "misfield": delta.misfields = { increment: 1 }; delta.impact_score = { increment: -1 }; break;
    case "direct_hit": delta.direct_hits = { increment: 1 }; delta.impact_score = { increment: 1 }; break;
    case "assist": delta.assists = { increment: 1 }; delta.impact_score = { increment: 1 }; break;
    case "stumping": delta.stumpings = { increment: 1 }; delta.impact_score = { increment: 1 }; break;
    default: throw BadRequest("Invalid event_type");
  }

  return prisma.fieldingEntry.upsert({
    where: { innings_id_player_id: { innings_id: inningsId, player_id } },
    create: {
      innings_id: inningsId, player_id,
      catches: event_type === "catch" ? 1 : 0,
      drops: event_type === "drop" ? 1 : 0,
      run_outs_assist: event_type === "run_out_assist" ? 1 : 0,
      misfields: event_type === "misfield" ? 1 : 0,
      direct_hits: event_type === "direct_hit" ? 1 : 0,
      assists: event_type === "assist" ? 1 : 0,
      stumpings: event_type === "stumping" ? 1 : 0,
      impact_score: ["drop", "misfield"].includes(event_type) ? -1 : 1
    },
    update: delta
  });
}

// ── Undo last ball (PPTX § Team Analytics · Edit score / Undo last ball) ────

export async function undoLastBall(inningsId: string, actorId: string, actorRole: string) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const last = await prisma.ballEvent.findFirst({
    where: { innings_id: inningsId },
    orderBy: { created_at: "desc" }
  });
  if (!last) throw BadRequest("No balls to undo");

  // Reverse the stats deltas the same way addBall applied them.
  const isLegal = !last.is_wide && !last.is_no_ball;
  const batsmanRuns = (last.is_bye || last.is_leg_bye) ? 0 : last.runs;
  const extraRuns = last.is_wide ? last.runs + 1 : last.is_no_ball ? 1 : 0;
  const byeRuns = (last.is_bye || last.is_leg_bye) ? last.runs : 0;
  const totalRuns = batsmanRuns + extraRuns + byeRuns + (last.is_penalty ? 5 : 0);

  await prisma.innings.update({
    where: { id: inningsId },
    data: {
      total_runs: { decrement: totalRuns },
      total_wickets: last.is_wicket ? { decrement: 1 } : undefined,
      total_balls: isLegal ? { decrement: 1 } : undefined,
      extras: { decrement: extraRuns + byeRuns + (last.is_penalty ? 5 : 0) },
      wides: last.is_wide ? { decrement: last.runs + 1 } : undefined,
      no_balls: last.is_no_ball ? { decrement: 1 } : undefined,
      byes: last.is_bye ? { decrement: last.runs } : undefined,
      leg_byes: last.is_leg_bye ? { decrement: last.runs } : undefined,
      boundary_4s: last.is_four ? { decrement: 1 } : undefined,
      boundary_6s: last.is_six ? { decrement: 1 } : undefined,
      dot_balls: last.is_dot ? { decrement: 1 } : undefined
    }
  });

  // Reverse batsman + bowler entries
  await prisma.battingEntry.updateMany({
    where: { innings_id: inningsId, player_id: last.batsman_id },
    data: {
      runs: { decrement: batsmanRuns },
      balls_faced: isLegal ? { decrement: 1 } : undefined,
      fours: last.is_four ? { decrement: 1 } : undefined,
      sixes: last.is_six ? { decrement: 1 } : undefined,
      dot_balls: last.is_dot ? { decrement: 1 } : undefined
    }
  });

  if (last.is_wicket && last.dismissed_player_id) {
    await prisma.battingEntry.updateMany({
      where: { innings_id: inningsId, player_id: last.dismissed_player_id },
      data: {
        status: "not_out",
        dismissal_type: null, dismissed_by_id: null, fielder_id: null,
        dismissal_shot: null, dismissal_line: null, dismissal_length: null,
        dismissal_bowler_type: null, dismissal_zone: null,
        dismissal_trajectory: null, dismissal_fielding_position: null
      }
    });
  }

  const bowlerRunsConceded = batsmanRuns + (last.is_wide ? last.runs + 1 : 0) + (last.is_no_ball ? 1 : 0);
  const bowlerWicket = last.is_wicket && !["run_out", "obstructing_field", "handled_ball", "retired_hurt"].includes(last.wicket_type ?? "");
  await prisma.bowlingEntry.updateMany({
    where: { innings_id: inningsId, player_id: last.bowler_id },
    data: {
      balls: isLegal ? { decrement: 1 } : undefined,
      runs_conceded: { decrement: bowlerRunsConceded },
      wickets: bowlerWicket ? { decrement: 1 } : undefined,
      wides: last.is_wide ? { decrement: 1 } : undefined,
      no_balls: last.is_no_ball ? { decrement: 1 } : undefined,
      dot_balls: last.is_dot ? { decrement: 1 } : undefined,
      boundaries_4s: last.is_four ? { decrement: 1 } : undefined,
      boundaries_6s: last.is_six ? { decrement: 1 } : undefined
    }
  });

  await prisma.ballEvent.delete({ where: { id: last.id } });
  return { deleted: last.id };
}

export async function getOverSummary(inningsId: string, overNumber?: number) {
  const where: any = { innings_id: inningsId };
  if (overNumber !== undefined) where.over_number = overNumber;

  return prisma.ballEvent.findMany({
    where,
    orderBy: [{ over_number: "asc" }, { ball_number: "asc" }],
    include: {
      batsman: { select: { id: true, name: true } },
      bowler: { select: { id: true, name: true } }
    }
  });
}

// ── Generic match events (football, etc.) ─────────────────────────────────────

export async function addMatchEvent(matchId: string, actorId: string, actorRole: string, input: any) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  // Auto-start match
  if (match.status === "upcoming") {
    await prisma.match.update({ where: { id: matchId }, data: { status: "live" } });
  }

  const event = await prisma.matchEvent.create({
    data: {
      match_id: matchId,
      team_id: input.team_id,
      player_id: input.player_id,
      event_type: input.event_type,
      minute: input.minute,
      period: input.period,
      value: input.value ?? 1,
      description: input.description
    }
  });

  // Update match_data score for goal events
  if (input.event_type === "goal" && input.team_id) {
    const md: any = (match.match_data as any) || { team1_score: 0, team2_score: 0 };
    if (input.team_id === match.team1_id) md.team1_score = (md.team1_score ?? 0) + 1;
    else if (input.team_id === match.team2_id) md.team2_score = (md.team2_score ?? 0) + 1;
    await prisma.match.update({ where: { id: matchId }, data: { match_data: md } });
  }

  return event;
}

// ── Standings ─────────────────────────────────────────────────────────────────

export async function getStandings(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: true }
  });
  if (!tournament) throw NotFound("Tournament not found");

  const matches = await prisma.match.findMany({
    where: { tournament_id: tournamentId, status: "completed" },
    include: {
      innings: {
        select: {
          batting_team_id: true, bowling_team_id: true,
          total_runs: true, total_balls: true, total_wickets: true, innings_number: true
        }
      }
    }
  });

  const table: Record<string, any> = {};
  for (const team of tournament.teams) {
    table[team.id] = {
      team_id: team.id, team_name: team.name, short_name: team.short_name,
      logo_url: team.logo_url, color: team.color,
      played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
      nrr: 0, runs_for: 0, balls_for: 0, runs_against: 0, balls_against: 0
    };
  }

  for (const m of matches) {
    const t1 = table[m.team1_id];
    const t2 = table[m.team2_id];
    if (!t1 || !t2) continue;

    t1.played++; t2.played++;

    if (tournament.sport === "cricket") {
      const inn1 = m.innings.find(i => i.batting_team_id === m.team1_id);
      const inn2 = m.innings.find(i => i.batting_team_id === m.team2_id);
      if (inn1) { t1.runs_for += inn1.total_runs; t1.balls_for += inn1.total_balls; }
      if (inn2) { t2.runs_for += inn2.total_runs; t2.balls_for += inn2.total_balls; }
      if (inn2) { t1.runs_against += inn2.total_runs; t1.balls_against += inn2.total_balls; }
      if (inn1) { t2.runs_against += inn1.total_runs; t2.balls_against += inn1.total_balls; }
    }

    if (m.winner_team_id === m.team1_id) { t1.won++; t1.points += 2; t2.lost++; }
    else if (m.winner_team_id === m.team2_id) { t2.won++; t2.points += 2; t1.lost++; }
    else if (m.status === "no_result") { t1.no_result++; t1.points++; t2.no_result++; t2.points++; }
    else { t1.tied++; t1.points++; t2.tied++; t2.points++; }
  }

  for (const row of Object.values(table)) {
    const rrf = row.balls_for > 0 ? (row.runs_for / row.balls_for) * 6 : 0;
    const rra = row.balls_against > 0 ? (row.runs_against / row.balls_against) * 6 : 0;
    row.nrr = parseFloat((rrf - rra).toFixed(3));
    delete row.runs_for; delete row.balls_for; delete row.runs_against; delete row.balls_against;
  }

  const standings = Object.values(table).sort((a, b) =>
    b.points !== a.points ? b.points - a.points : b.nrr - a.nrr
  );

  return { tournament: { id: tournament.id, name: tournament.name, sport: tournament.sport, format: tournament.format }, standings };
}
