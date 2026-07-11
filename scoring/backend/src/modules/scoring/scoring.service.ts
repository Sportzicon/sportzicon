import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";

type TxClient = Prisma.TransactionClient;
import { validateBall, deriveFreeHit } from "./ballValidation";

// ── Guards ───────────────────────────────────────────────────────────────────

function canManage(role: string) {
  return role === "organizer" || role === "admin" || role === "scorer";
}

async function assertManager(tournamentId: string, actorId: string, actorRole: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw NotFound("Tournament not found");
  // Admins and scorers can manage any tournament; organizers must own it
  if (actorRole === "admin" || actorRole === "scorer") return t;
  if (t.created_by !== actorId) throw Forbidden("Not authorized to manage this tournament");
  return t;
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export async function listTournaments(sport?: string, status?: string, page = 1, limit = 20, actorId?: string, actorRole?: string) {
  // Organizers and admins can see their own private tournaments
  const canSeePrivate = actorId && (actorRole === "organizer" || actorRole === "admin");
  const where: any = canSeePrivate
    ? { OR: [{ is_public: true }, { created_by: actorId }] }
    : { is_public: true };
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

function nullIfEmpty(v: any): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

export async function createTournament(actorId: string, actorRole: string, input: any) {
  if (!canManage(actorRole)) throw Forbidden("Only organizers can create tournaments");
  if (!input.name?.trim()) throw BadRequest("Tournament name is required");
  if (!input.sport) throw BadRequest("Sport is required");
  return prisma.tournament.create({
    data: {
      name: input.name,
      sport: input.sport.toLowerCase(),
      format: nullIfEmpty(input.format),
      season: nullIfEmpty(input.season),
      match_type: nullIfEmpty(input.match_type),
      description: nullIfEmpty(input.description),
      start_date: nullIfEmpty(input.start_date),
      end_date: nullIfEmpty(input.end_date),
      location: nullIfEmpty(input.location),
      logo_url: nullIfEmpty(input.logo_url),
      banner_url: nullIfEmpty(input.banner_url),
      is_public: input.is_public ?? true,
      opportunity_id: nullIfEmpty(input.opportunity_id),
      created_by: actorId
    }
  });
}

export async function updateTournament(id: string, actorId: string, actorRole: string, patch: any) {
  await assertManager(id, actorId, actorRole);
  const stringFields = ["format", "season", "match_type", "description", "start_date", "end_date", "location", "logo_url", "banner_url", "opportunity_id"];
  const data: any = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.sport !== undefined) data.sport = patch.sport.toLowerCase();
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.is_public !== undefined) data.is_public = patch.is_public;
  for (const k of stringFields) if (patch[k] !== undefined) data[k] = nullIfEmpty(patch[k]);
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

// Look up all player entries linked to a Sportivox user ID and aggregate stats
export async function getPlayerStatsByUserId(sportivoxUserId: string) {
  const players = await prisma.player.findMany({
    where: { sportivox_user_id: sportivoxUserId },
    include: {
      team: { select: { id: true, name: true, short_name: true } },
      career_stats: true,
      batting_entries: {
        include: { innings: { select: { match_id: true, innings_number: true } } }
      },
      bowling_entries: {
        include: { innings: { select: { match_id: true } } }
      }
    }
  });

  if (players.length === 0) return null;

  // Aggregate across all player records for this user
  const allBat  = players.flatMap(p => p.batting_entries.filter(b => b.status !== "yet_to_bat"));
  const allBowl = players.flatMap(p => p.bowling_entries.filter(b => b.balls > 0));

  const matchIds = new Set([
    ...allBat.map(b => b.innings.match_id),
    ...allBowl.map(b => b.innings.match_id)
  ]);

  const inningsBatted  = allBat.length;
  const totalRuns      = allBat.reduce((s, b) => s + b.runs, 0);
  const ballsFaced     = allBat.reduce((s, b) => s + b.balls_faced, 0);
  const fours          = allBat.reduce((s, b) => s + b.fours, 0);
  const sixes          = allBat.reduce((s, b) => s + b.sixes, 0);
  const dismissals     = allBat.filter(b => b.status === "out").length;
  const notOuts        = allBat.filter(b => b.status === "not_out" || b.status === "retired_hurt").length;
  const highestScore   = allBat.length > 0 ? Math.max(...allBat.map(b => b.runs)) : 0;
  const highestNotOut  = allBat.find(b => b.runs === highestScore && b.status !== "out");
  const fifties        = allBat.filter(b => b.runs >= 50 && b.runs < 100).length;
  const hundreds       = allBat.filter(b => b.runs >= 100).length;
  const batAvg         = dismissals > 0 ? parseFloat((totalRuns / dismissals).toFixed(2)) : (totalRuns > 0 ? totalRuns : 0);
  const batSR          = ballsFaced > 0 ? parseFloat(((totalRuns / ballsFaced) * 100).toFixed(2)) : 0;

  const ballsBowled    = allBowl.reduce((s, b) => s + b.balls, 0);
  const runsConceded   = allBowl.reduce((s, b) => s + b.runs_conceded, 0);
  const wickets        = allBowl.reduce((s, b) => s + b.wickets, 0);
  const maidens        = allBowl.reduce((s, b) => s + b.maidens, 0);
  const fiveWickets    = allBowl.filter(b => b.wickets >= 5).length;
  const economy        = ballsBowled > 0 ? parseFloat(((runsConceded / ballsBowled) * 6).toFixed(2)) : 0;
  const bowlAvg        = wickets > 0 ? parseFloat((runsConceded / wickets).toFixed(2)) : 0;
  const bowlSR         = wickets > 0 ? parseFloat((ballsBowled / wickets).toFixed(2)) : 0;
  const bestBowling    = allBowl.reduce<{ w: number; r: number } | null>((best, e) => {
    if (!best) return { w: e.wickets, r: e.runs_conceded };
    if (e.wickets > best.w || (e.wickets === best.w && e.runs_conceded < best.r)) return { w: e.wickets, r: e.runs_conceded };
    return best;
  }, null);

  // Use career_stats if available (persisted after match completion)
  const careerStats = players.find(p => p.career_stats)?.career_stats;

  return {
    players: players.map(p => ({ id: p.id, name: p.name, team: p.team })),
    batting: {
      matches:      matchIds.size,
      innings:      inningsBatted,
      not_outs:     notOuts,
      runs:         totalRuns,
      highest_score: `${highestScore}${highestNotOut ? "*" : ""}`,
      average:      batAvg,
      strike_rate:  batSR,
      hundreds,
      fifties,
      fours,
      sixes,
      balls_faced:  ballsFaced
    },
    bowling: ballsBowled > 0 ? {
      matches:     matchIds.size,
      innings:     allBowl.length,
      balls:       ballsBowled,
      overs:       `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`,
      runs:        runsConceded,
      wickets,
      maidens,
      best_bowling: bestBowling ? `${bestBowling.w}/${bestBowling.r}` : "–",
      average:     bowlAvg,
      economy,
      strike_rate: bowlSR,
      five_wickets: fiveWickets
    } : null,
    career: careerStats ?? null
  };
}

export async function getSuggestedPlayers(tournamentId: string, teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw NotFound("Team not found");

  // Find other tournaments by same team (same name or same sport)
  const otherTournaments = await prisma.tournament.findMany({
    where: {
      id: { not: tournamentId },
      sport: "cricket"
    },
    include: {
      teams: {
        where: { name: team.name },
        include: { players: true }
      }
    }
  });

  // Collect unique players from other tournament matches
  const suggestedPlayerIds = new Set<string>();
  for (const t of otherTournaments) {
    for (const sameTeam of t.teams) {
      for (const player of sameTeam.players) {
        suggestedPlayerIds.add(player.id);
      }
    }
  }

  // Fetch actual player records
  const players = await prisma.player.findMany({
    where: { id: { in: Array.from(suggestedPlayerIds) } }
  });

  return players;
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

  const career = await prisma.playerCareerStats.findUnique({ where: { player_id: playerId } });

  const careerBatAvg = career && career.innings_batted > career.not_outs
    ? parseFloat((career.total_runs / (career.innings_batted - career.not_outs)).toFixed(2))
    : career?.total_runs ?? 0;
  const careerSR = career && career.balls_faced > 0
    ? parseFloat(((career.total_runs / career.balls_faced) * 100).toFixed(2))
    : 0;
  const careerBowlEcon = career && career.balls_bowled > 0
    ? parseFloat(((career.runs_conceded / career.balls_bowled) * 6).toFixed(2))
    : 0;
  const careerBowlAvg = career && career.wickets > 0
    ? parseFloat((career.runs_conceded / career.wickets).toFixed(2))
    : 0;

  const careerStats = career ? {
    matches_played: career.matches_played,
    innings_batted: career.innings_batted,
    total_runs: career.total_runs,
    balls_faced: career.balls_faced,
    highest_score: career.highest_score,
    not_outs: career.not_outs,
    hundreds: career.hundreds,
    fifties: career.fifties,
    fours: career.fours,
    sixes: career.sixes,
    batting_average: careerBatAvg,
    strike_rate: careerSR,
    innings_bowled: career.innings_bowled,
    balls_bowled: career.balls_bowled,
    overs_bowled: parseFloat(`${Math.floor(career.balls_bowled / 6)}.${career.balls_bowled % 6}`),
    runs_conceded: career.runs_conceded,
    wickets: career.wickets,
    maidens: career.maidens,
    five_wicket_hauls: career.five_wicket_hauls,
    best_bowling: career.best_bowling_wickets > 0 ? `${career.best_bowling_wickets}/${career.best_bowling_runs}` : "-",
    bowling_average: careerBowlAvg,
    bowling_economy: careerBowlEcon,
    catches: career.catches,
    run_outs: career.run_outs,
    stumpings: career.stumpings
  } : null;

  return {
    player: {
      id: player.id, name: player.name, role: player.role,
      batting_style: player.batting_style, bowling_style: player.bowling_style,
      is_captain: player.is_captain, jersey_number: player.jersey_number,
      photo_url: player.photo_url, team: player.team
    },
    battingStats,
    bowlingStats,
    careerStats
  };
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function createMatch(tournamentId: string, actorId: string, actorRole: string, input: any) {
  if (!input.team1_id) throw BadRequest("team1_id is required");
  if (!input.team2_id) throw BadRequest("team2_id is required");
  if (input.team1_id === input.team2_id) throw BadRequest("A match cannot have the same team on both sides");
  const t = await assertManager(tournamentId, actorId, actorRole);
  return prisma.match.create({
    data: {
      tournament_id: tournamentId,
      sport: t.sport,
      format: input.format ?? t.format,
      match_type: input.match_type ?? t.match_type,
      team1_id: input.team1_id,
      team2_id: input.team2_id,
      title: input.title,
      match_number: input.match_number,
      venue: input.venue,
      scheduled_at: input.scheduled_at ? new Date(input.scheduled_at) : undefined,
      umpire1: input.umpire1 ?? null,
      umpire2: input.umpire2 ?? null,
      tv_umpire: input.tv_umpire ?? null,
      match_referee: input.match_referee ?? null
    },
    include: {
      team1: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      team2: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } }
    }
  });
}

export async function listAllMatches(status?: string, sport?: string, tournamentId?: string, limit = 20, cursor?: string) {
  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (sport) where.sport = sport.toLowerCase();
  if (tournamentId) where.tournament_id = tournamentId;

  const matches = await prisma.match.findMany({
    where,
    orderBy: [{ scheduled_at: "desc" }, { created_at: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      tournament: { select: { id: true, name: true, sport: true, format: true, season: true, location: true } },
      team1: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      team2: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      innings: {
        select: { id: true, innings_number: true, batting_team_id: true, total_runs: true, total_wickets: true, total_balls: true, is_completed: true }
      }
    }
  });

  let nextCursor: string | null = null;
  if (matches.length > limit) {
    nextCursor = matches[limit].id;
    matches.pop();
  }
  return { matches, nextCursor };
}

export async function getMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, name: true, overs_per_innings: true, format: true, ball_type: true, season: true, location: true, powerplay_overs: true } },
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
          },
          partnerships: {
            orderBy: { wicket_number: "asc" }
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
      tournament: { select: { id: true, name: true, sport: true, overs_per_innings: true, format: true } },
      team1: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      team2: { select: { id: true, name: true, short_name: true, logo_url: true, color: true } },
      innings: {
        orderBy: { innings_number: "asc" },
        include: {
          batting_entries: {
            orderBy: { batting_position: "asc" },
            include: { player: { select: { id: true, name: true, is_captain: true, is_keeper: true } } }
          },
          bowling_entries: {
            where: { balls: { gt: 0 } },
            orderBy: { balls: "desc" },
            include: { player: { select: { id: true, name: true } } }
          },
          partnerships: {
            where: { is_unbroken: true },
            take: 1
          }
        }
      }
    }
  });
}

// Same shape as PlayerCareerStats/PlayerSeasonStats/PlayerTournamentStats —
// shared so the one aggregation pass below can fan out to all three tables
// without tripling the upsert logic.
type StatDelegate = {
  findUnique: (args: { where: any }) => Promise<any>;
  update: (args: { where: any; data: any }) => Promise<any>;
  create: (args: { data: any }) => Promise<any>;
};

type StatIncrement = {
  inningsBatted: number; totalRuns: number; ballsFaced: number; highestScore: number;
  notOuts: number; hundreds: number; fifties: number; fours: number; sixes: number;
  inningsBowled: number; ballsBowled: number; runsConceded: number; wickets: number;
  maidens: number; fiveWicketHauls: number; bestInnings: { w: number; r: number } | null;
  catches: number; runOuts: number; stumpings: number;
};

async function upsertStatRow(delegate: StatDelegate, whereUnique: any, createExtra: Record<string, any>, s: StatIncrement) {
  const existing = await delegate.findUnique({ where: whereUnique });
  if (existing) {
    const bestBetter = !!s.bestInnings && (
      s.bestInnings.w > existing.best_bowling_wickets ||
      (s.bestInnings.w === existing.best_bowling_wickets && s.bestInnings.r < existing.best_bowling_runs)
    );
    await delegate.update({
      where: whereUnique,
      data: {
        matches_played: { increment: 1 },
        innings_batted: { increment: s.inningsBatted },
        total_runs: { increment: s.totalRuns },
        balls_faced: { increment: s.ballsFaced },
        highest_score: Math.max(existing.highest_score, s.highestScore),
        not_outs: { increment: s.notOuts },
        hundreds: { increment: s.hundreds },
        fifties: { increment: s.fifties },
        fours: { increment: s.fours },
        sixes: { increment: s.sixes },
        innings_bowled: { increment: s.inningsBowled },
        balls_bowled: { increment: s.ballsBowled },
        runs_conceded: { increment: s.runsConceded },
        wickets: { increment: s.wickets },
        maidens: { increment: s.maidens },
        five_wicket_hauls: { increment: s.fiveWicketHauls },
        best_bowling_wickets: bestBetter ? s.bestInnings!.w : existing.best_bowling_wickets,
        best_bowling_runs: bestBetter ? s.bestInnings!.r : existing.best_bowling_runs,
        catches: { increment: s.catches },
        run_outs: { increment: s.runOuts },
        stumpings: { increment: s.stumpings }
      }
    });
  } else {
    await delegate.create({
      data: {
        ...createExtra,
        matches_played: 1,
        innings_batted: s.inningsBatted,
        total_runs: s.totalRuns,
        balls_faced: s.ballsFaced,
        highest_score: s.highestScore,
        not_outs: s.notOuts,
        hundreds: s.hundreds,
        fifties: s.fifties,
        fours: s.fours,
        sixes: s.sixes,
        innings_bowled: s.inningsBowled,
        balls_bowled: s.ballsBowled,
        runs_conceded: s.runsConceded,
        wickets: s.wickets,
        maidens: s.maidens,
        five_wicket_hauls: s.fiveWicketHauls,
        best_bowling_wickets: s.bestInnings?.w ?? 0,
        best_bowling_runs: s.bestInnings?.r ?? 9999,
        catches: s.catches,
        run_outs: s.runOuts,
        stumpings: s.stumpings
      }
    });
  }
}

export async function aggregateMatchStats(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: true,
      playing_xi: true,
      innings: {
        include: {
          batting_entries: true,
          bowling_entries: true,
          fielding_entries: true
        }
      }
    }
  });
  if (!match) return;

  // Get XI players to count only those (not substitute fielders)
  const xiPlayerIds = new Set(match.playing_xi.map(mp => mp.player_id));

  // Collect per-player data across all innings in this match
  const playerBatting = new Map<string, { runs: number; balls: number; fours: number; sixes: number; isOut: boolean; notOut: boolean }[]>();
  const playerBowling = new Map<string, { balls: number; runs: number; wickets: number; maidens: number }[]>();
  const playerFielding = new Map<string, { catches: number; runOuts: number; stumpings: number }[]>();

  for (const inn of match.innings) {
    for (const b of inn.batting_entries) {
      if (b.status === "yet_to_bat") continue;
      if (!xiPlayerIds.has(b.player_id)) continue; // Only count XI players
      if (!playerBatting.has(b.player_id)) playerBatting.set(b.player_id, []);
      playerBatting.get(b.player_id)!.push({
        runs: b.runs,
        balls: b.balls_faced,
        fours: b.fours,
        sixes: b.sixes,
        isOut: b.status === "out",
        notOut: b.status === "not_out" || b.status === "retired_hurt"
      });
    }
    for (const b of inn.bowling_entries) {
      if (b.balls === 0) continue;
      if (!xiPlayerIds.has(b.player_id)) continue; // Only count XI players
      if (!playerBowling.has(b.player_id)) playerBowling.set(b.player_id, []);
      playerBowling.get(b.player_id)!.push({
        balls: b.balls, runs: b.runs_conceded, wickets: b.wickets, maidens: b.maidens
      });
    }
    for (const f of inn.fielding_entries) {
      if (!xiPlayerIds.has(f.player_id)) continue; // Only count XI players
      if (!playerFielding.has(f.player_id)) playerFielding.set(f.player_id, []);
      playerFielding.get(f.player_id)!.push({
        catches: f.catches,
        runOuts: f.run_outs_direct + f.run_outs_assist,
        stumpings: f.stumpings
      });
    }
  }

  // All unique XI player IDs who participated
  const allPlayerIds = new Set(xiPlayerIds);

  for (const playerId of allPlayerIds) {
    const batEntries = playerBatting.get(playerId) ?? [];
    const bowlEntries = playerBowling.get(playerId) ?? [];
    const fieldEntries = playerFielding.get(playerId) ?? [];

    // Batting increments
    const inningsBatted = batEntries.length;
    const totalRuns = batEntries.reduce((s, e) => s + e.runs, 0);
    const ballsFaced = batEntries.reduce((s, e) => s + e.balls, 0);
    const highestScore = batEntries.length > 0 ? Math.max(...batEntries.map(e => e.runs)) : 0;
    const notOuts = batEntries.filter(e => e.notOut).length;
    const hundreds = batEntries.filter(e => e.runs >= 100).length;
    const fifties = batEntries.filter(e => e.runs >= 50 && e.runs < 100).length;
    const fours = batEntries.reduce((s, e) => s + e.fours, 0);
    const sixes = batEntries.reduce((s, e) => s + e.sixes, 0);

    // Bowling increments
    const inningsBowled = bowlEntries.length;
    const ballsBowled = bowlEntries.reduce((s, e) => s + e.balls, 0);
    const runsConceded = bowlEntries.reduce((s, e) => s + e.runs, 0);
    const wickets = bowlEntries.reduce((s, e) => s + e.wickets, 0);
    const maidens = bowlEntries.reduce((s, e) => s + e.maidens, 0);
    const fiveWicketHauls = bowlEntries.filter(e => e.wickets >= 5).length;
    const bestInnings = bowlEntries.reduce<{ w: number; r: number } | null>((best, e) => {
      if (!best) return { w: e.wickets, r: e.runs };
      if (e.wickets > best.w || (e.wickets === best.w && e.runs < best.r)) return { w: e.wickets, r: e.runs };
      return best;
    }, null);

    // Fielding increments
    const catches = fieldEntries.reduce((s, e) => s + e.catches, 0);
    const runOuts = fieldEntries.reduce((s, e) => s + e.runOuts, 0);
    const stumpings = fieldEntries.reduce((s, e) => s + e.stumpings, 0);

    const computed: StatIncrement = {
      inningsBatted, totalRuns, ballsFaced, highestScore, notOuts, hundreds, fifties, fours, sixes,
      inningsBowled, ballsBowled, runsConceded, wickets, maidens, fiveWicketHauls, bestInnings,
      catches, runOuts, stumpings
    };

    await upsertStatRow(prisma.playerCareerStats, { player_id: playerId }, { player_id: playerId }, computed);

    await upsertStatRow(
      prisma.playerTournamentStats,
      { player_id_tournament_id: { player_id: playerId, tournament_id: match.tournament_id } },
      { player_id: playerId, tournament_id: match.tournament_id },
      computed
    );

    if (match.tournament?.season) {
      await upsertStatRow(
        prisma.playerSeasonStats,
        { player_id_season: { player_id: playerId, season: match.tournament.season } },
        { player_id: playerId, season: match.tournament.season },
        computed
      );
    }
  }
}

// Updates Organization-owned tournament standings (OrgTournament/OrgTeam,
// public schema) for a completed match — only runs if the match was tagged
// with org_tournament_id (most matches won't be; this is opt-in, separate
// from the match's own scoring-engine Tournament grouping). Called from the
// same two guarded call sites as aggregateMatchStats, so it inherits the
// same status-transition-edge idempotency guard — no new guard needed.
async function updateOrgTournamentStandings(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match?.org_tournament_id) return;

  for (const teamId of [match.team1_id, match.team2_id]) {
    const orgTeam = await prisma.orgTeam.findFirst({
      where: { org_tournament_id: match.org_tournament_id, scoring_team_id: teamId }
    });
    if (!orgTeam) continue; // team not mapped to an OrgTeam — skip silently, not an error

    const outcome: "win" | "loss" | "tie" =
      !match.winner_team_id ? "tie" : match.winner_team_id === teamId ? "win" : "loss";
    const points = outcome === "win" ? 2 : outcome === "tie" ? 1 : 0;

    await prisma.orgTournamentStandings.upsert({
      where: { org_team_id: orgTeam.id },
      create: {
        org_tournament_id: match.org_tournament_id,
        org_team_id: orgTeam.id,
        matches_played: 1,
        wins: outcome === "win" ? 1 : 0,
        losses: outcome === "loss" ? 1 : 0,
        ties: outcome === "tie" ? 1 : 0,
        points
      },
      update: {
        matches_played: { increment: 1 },
        wins: outcome === "win" ? { increment: 1 } : undefined,
        losses: outcome === "loss" ? { increment: 1 } : undefined,
        ties: outcome === "tie" ? { increment: 1 } : undefined,
        points: { increment: points }
      }
    });
  }
}

// Auto-finishes a match once its last innings ends, so it stops sitting stuck
// as "live" when nobody remembers to press End Match.
async function maybeAutoCompleteMatch(matchId: string, finishedInningsNumber: number, totalInnings: number, maxWickets: number) {
  if (finishedInningsNumber < totalInnings) return;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status === "completed") return;

  const data: any = { status: "completed" };

  if (totalInnings === 2) {
    const innings = await prisma.innings.findMany({ where: { match_id: matchId } });
    const inn1 = innings.find(i => i.innings_number === 1);
    const inn2 = innings.find(i => i.innings_number === 2);
    if (inn1 && inn2) {
      if (inn2.total_runs > inn1.total_runs) {
        const team = await prisma.team.findUnique({ where: { id: inn2.batting_team_id }, select: { name: true } });
        data.winner_team_id = inn2.batting_team_id;
        data.result_summary = `${team?.name ?? "Team"} won by ${maxWickets - inn2.total_wickets} wicket(s)`;
      } else if (inn1.total_runs > inn2.total_runs) {
        const team = await prisma.team.findUnique({ where: { id: inn1.batting_team_id }, select: { name: true } });
        data.winner_team_id = inn1.batting_team_id;
        data.result_summary = `${team?.name ?? "Team"} won by ${inn1.total_runs - inn2.total_runs} run(s)`;
      } else {
        data.result_summary = "Match tied";
      }
    }
  }

  await prisma.match.update({ where: { id: matchId }, data });
  await aggregateMatchStats(matchId);
  await updateOrgTournamentStandings(matchId);
}

// ── Playing XI ────────────────────────────────────────────────────────────────

export async function getPlayingXI(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      playing_xi: true,
      team1: { include: { players: { orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }] } } },
      team2: { include: { players: { orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }] } } }
    }
  });
  if (!match) throw NotFound("Match not found");

  const xiIds = new Set(match.playing_xi.map((p: any) => p.player_id));

  const enrich = (teamPlayers: any[], teamId: string) =>
    teamPlayers.map(p => ({ ...p, in_xi: xiIds.has(p.id), xi_team_id: teamId }));

  return {
    match_id: matchId,
    team1: { ...match.team1, players: enrich(match.team1.players, match.team1.id) },
    team2: { ...match.team2, players: enrich(match.team2.players, match.team2.id) },
    xi_locked: match.playing_xi.length > 0
  };
}

export async function setPlayingXI(
  matchId: string, actorId: string, actorRole: string,
  team1PlayerIds: string[], team2PlayerIds: string[]
) {
  if (team1PlayerIds.length !== 11 || team2PlayerIds.length !== 11) {
    throw BadRequest("Each team must have exactly 11 players");
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { team1: { include: { players: true } }, team2: { include: { players: true } } }
  });
  if (!match) throw NotFound("Match not found");
  if (match.status !== "upcoming") throw BadRequest("XI can only be set before match starts");
  await assertManager(match.tournament_id, actorId, actorRole);

  // Validate all player IDs belong to their respective teams
  const team1PlayerSet = new Set(match.team1.players.map(p => p.id));
  const team2PlayerSet = new Set(match.team2.players.map(p => p.id));

  for (const pid of team1PlayerIds) {
    if (!team1PlayerSet.has(pid)) throw BadRequest(`Player ${pid} is not in team ${match.team1.name}`);
  }
  for (const pid of team2PlayerIds) {
    if (!team2PlayerSet.has(pid)) throw BadRequest(`Player ${pid} is not in team ${match.team2.name}`);
  }

  // Clear existing XI and replace in transaction
  await prisma.$transaction([
    prisma.matchPlayer.deleteMany({ where: { match_id: matchId } }),
    prisma.matchPlayer.createMany({
      data: [
        ...team1PlayerIds.map((pid, i) => ({ match_id: matchId, team_id: match.team1_id, player_id: pid, batting_position: i + 1 })),
        ...team2PlayerIds.map((pid, i) => ({ match_id: matchId, team_id: match.team2_id, player_id: pid, batting_position: i + 1 }))
      ]
    })
  ]);

  return { ok: true, count: 22 };
}

export async function updateMatch(matchId: string, actorId: string, actorRole: string, patch: any) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const data: any = {};
  for (const k of ["title", "venue", "status", "winner_team_id", "result_summary", "toss_winner_id", "toss_decision", "match_type", "umpire1", "umpire2", "tv_umpire", "match_referee", "org_tournament_id"]) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (patch.scheduled_at) data.scheduled_at = new Date(patch.scheduled_at);

  const updated = await prisma.match.update({ where: { id: matchId }, data });

  if (patch.status === "completed" && match.status !== "completed") {
    await aggregateMatchStats(matchId);
    await updateOrgTournamentStandings(matchId);
  }

  return updated;
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
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { team1: true, team2: true } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const xiCount = await prisma.matchPlayer.count({ where: { match_id: matchId } });
  if (xiCount === 0) {
    throw BadRequest("Playing XI must be selected for both teams before starting an innings");
  }

  if (input.batting_team_id !== match.team1_id && input.batting_team_id !== match.team2_id) {
    throw BadRequest("Batting team is not in this match");
  }
  if (input.bowling_team_id !== match.team1_id && input.bowling_team_id !== match.team2_id) {
    throw BadRequest("Bowling team is not in this match");
  }
  if (input.batting_team_id === input.bowling_team_id) {
    throw BadRequest("Batting and bowling teams must be different");
  }

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

  // Use Playing XI if set; otherwise fall back to full squad
  const xiRecords = await prisma.matchPlayer.findMany({ where: { match_id: matchId } });
  const battingXI = xiRecords.filter(x => x.team_id === input.batting_team_id);
  const bowlingXI = xiRecords.filter(x => x.team_id === input.bowling_team_id);

  const battingPlayerIds = battingXI.length > 0
    ? battingXI.sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99)).map(x => x.player_id)
    : (await prisma.player.findMany({
        where: { team_id: input.batting_team_id },
        orderBy: [{ is_captain: "desc" }, { jersey_number: "asc" }]
      })).map(p => p.id);

  if (battingPlayerIds.length > 0) {
    await prisma.battingEntry.createMany({
      data: battingPlayerIds.map((pid, i) => ({
        innings_id: innings.id,
        player_id: pid,
        batting_position: i + 1
      })),
      skipDuplicates: true
    });
  }

  // Bowling stubs — use XI or fall back to full squad
  const bowlingPlayerIds = bowlingXI.length > 0
    ? bowlingXI.map(x => x.player_id)
    : (await prisma.player.findMany({
        where: { team_id: input.bowling_team_id },
        orderBy: { jersey_number: "asc" }
      })).map(p => p.id);

  if (bowlingPlayerIds.length > 0) {
    await prisma.bowlingEntry.createMany({
      data: bowlingPlayerIds.map(pid => ({ innings_id: innings.id, player_id: pid })),
      skipDuplicates: true
    });
  }

  return innings;
}

// ── Retired Hurt ──────────────────────────────────────────────────────────────
// Retired hurt is NOT a dismissal — the wicket count does not increase.
// The batsman can return to bat later in the same innings.

export async function retireHurt(inningsId: string, actorId: string, actorRole: string, playerId: string) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  // Ensure the player has a batting entry in this innings
  const entry = await prisma.battingEntry.findUnique({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: playerId } }
  });
  if (!entry) throw NotFound("Batting entry not found for this player in this innings");
  if (entry.status === "out") throw BadRequest("Player is already out and cannot retire hurt");

  // Record current over so commentary can be positioned correctly
  const currentOver = Math.floor(innings.total_balls / 6);
  const currentBall = innings.total_balls % 6;

  // Mark as retired_hurt — NOT a wicket, wicket count stays the same
  await prisma.battingEntry.update({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: playerId } },
    data: {
      status: "retired_hurt",
      dismissal_type: "retired_hurt",
      dismissal_desc: `retired_hurt_at:${currentOver}.${currentBall}:runs:${entry.runs}`
    }
  });

  return {
    ok: true,
    player_id: playerId,
    status: "retired_hurt",
    at_over: currentOver,
    at_ball: currentBall,
    runs: entry.runs
  };
}

export async function returnFromRetiredHurt(inningsId: string, actorId: string, actorRole: string, playerId: string) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const entry = await prisma.battingEntry.findUnique({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: playerId } }
  });
  if (!entry) throw NotFound("Batting entry not found");
  if (entry.status !== "retired_hurt") throw BadRequest("Player is not currently retired hurt");

  // Restore to not_out — clear dismissal fields so scorecard is accurate
  await prisma.battingEntry.update({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: playerId } },
    data: {
      status: "not_out",
      dismissal_type: null,
      dismissal_desc: null
    }
  });

  return { ok: true, player_id: playerId, status: "not_out" };
}

export async function getRetiredHurtPlayers(inningsId: string) {
  return prisma.battingEntry.findMany({
    where: { innings_id: inningsId, status: "retired_hurt" },
    include: { player: { select: { id: true, name: true, jersey_number: true } } }
  });
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

  // ── Cricket-law validation (authoritative — runs before any write) ─────────
  // Free hit follows a no-ball and persists through wides until the next legal ball.
  const freeHitEnabled = tournament?.free_hit_enabled ?? (match.format !== "Test");
  const recentForFreeHit = await prisma.ballEvent.findMany({
    where: { innings_id: inningsId, voided: false },
    orderBy: { created_at: "desc" }, take: 6,
    select: { is_no_ball: true, is_wide: true }
  });
  const freeHitActive = deriveFreeHit(recentForFreeHit, freeHitEnabled);

  // Max wickets = batting squad size − 1, capped at 10 (standard all-out).
  const battingSquad = await prisma.matchPlayer.count({
    where: { match_id: innings.match_id, team_id: innings.batting_team_id }
  });
  const squadFallback = battingSquad > 0
    ? battingSquad
    : await prisma.player.count({ where: { team_id: innings.batting_team_id } });
  const maxWickets = Math.min(Math.max((squadFallback || 11) - 1, 1), 10);

  const violations = validateBall(input, {
    freeHitActive,
    wicketsSoFar: innings.total_wickets,
    maxWickets
  });
  if (violations.length) throw BadRequest(violations.join(" "));

  const isLegal = !is_wide && !is_no_ball;
  // On a wide ALL runs go to extras — batsman scores nothing. On a bye/lb off a legal ball, same.
  const batsmanRuns = (is_wide || is_bye || is_leg_bye) ? 0 : runs;
  const extraRuns = is_wide ? runs + 1 : is_no_ball ? 1 : 0;
  const byeRuns = !is_wide && (is_bye || is_leg_bye) ? runs : 0;
  const totalRuns = batsmanRuns + extraRuns + byeRuns + (is_penalty ? 5 : 0);
  const isDot = isLegal && totalRuns === 0 && !is_wicket;
  const phase = computePhase(over_number, match.format, (tournament?.powerplay_overs as any) ?? null);
  // The server decides free-hit status from the previous delivery — not the client.
  const effectiveFreeHit = freeHitActive;

  // Phase increment helpers
  const phaseInc = (key: "pp" | "mid" | "death") => ({
    [`${key}_runs`]: phase === key ? { increment: totalRuns } : undefined,
    [`${key}_balls`]: phase === key && isLegal ? { increment: 1 } : undefined,
    [`${key}_wickets`]: phase === key && is_wicket ? { increment: 1 } : undefined
  });
  const oneRun = batsmanRuns === 1;
  const twoRun = batsmanRuns === 2;
  const threeRun = batsmanRuns === 3;
  const bowlerRunsConceded = batsmanRuns + (is_no_ball ? byeRuns : 0) + (is_wide ? runs + 1 : 0) + (is_no_ball ? 1 : 0);
  const bowlerWicket = is_wicket && !["run_out", "obstructing_field", "handled_ball", "retired_hurt"].includes(wicket_type ?? "");
  const bowlPhaseInc = (key: "pp" | "mid" | "death") => ({
    [`${key}_runs`]: phase === key ? { increment: bowlerRunsConceded } : undefined,
    [`${key}_balls`]: phase === key && isLegal ? { increment: 1 } : undefined,
    [`${key}_wickets`]: phase === key && bowlerWicket ? { increment: 1 } : undefined
  });

  // Ledger + all stat deltas as one atomic unit — a partial failure here must
  // never leave the ball recorded without its Innings/entry/partnership deltas
  // (or vice versa).
  const ball = await prisma.$transaction(async (tx) => {
    // Ball event row with full PPTX fields
    const ball = await tx.ballEvent.create({
      data: {
        innings_id: inningsId,
        over_number, ball_number,
        batsman_id, bowler_id, non_striker_id,
        runs,
        is_wide, is_no_ball, is_bye, is_leg_bye, is_penalty,
        is_wicket, is_four, is_six, is_free_hit: effectiveFreeHit, is_dot: isDot,
        shot_type, ball_line, ball_length, bowler_variant, delivery_outcome,
        phase,
        wicket_type, dismissed_player_id, fielder_id, fielder_name,
        fielding_position, dismissal_zone, ball_trajectory,
        commentary
      }
    });

    // Innings totals + phase splits + counters
    await tx.innings.update({
      where: { id: inningsId },
      data: {
        total_runs: { increment: totalRuns },
        total_wickets: is_wicket ? { increment: 1 } : undefined,
        total_balls: isLegal ? { increment: 1 } : undefined,
        extras: { increment: extraRuns + byeRuns + (is_penalty ? 5 : 0) },
        wides: is_wide ? { increment: runs + 1 } : undefined,
        no_balls: is_no_ball ? { increment: 1 } : undefined,
        byes: !is_wide && is_bye ? { increment: runs } : undefined,
        leg_byes: !is_wide && is_leg_bye ? { increment: runs } : undefined,
        penalty_runs: is_penalty ? { increment: 5 } : undefined,
        boundary_4s: is_four ? { increment: 1 } : undefined,
        boundary_6s: is_six ? { increment: 1 } : undefined,
        dot_balls: isDot ? { increment: 1 } : undefined,
        ...phaseInc("pp"), ...phaseInc("mid"), ...phaseInc("death")
      }
    });

    // Batsman stats with PPTX shot detail counters
    await tx.battingEntry.upsert({
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

    // Mark non-striker as "not_out" so they appear on public scoreboards immediately.
    // Without this, a non-striker who hasn't faced a ball stays "yet_to_bat" and is
    // invisible on the live scores page until they take strike.
    if (non_striker_id) {
      await tx.battingEntry.upsert({
        where: { innings_id_player_id: { innings_id: inningsId, player_id: non_striker_id } },
        create: {
          innings_id: inningsId, player_id: non_striker_id, batting_position: 99,
          runs: 0, balls_faced: 0, fours: 0, sixes: 0, dot_balls: 0,
          singles: 0, doubles: 0, threes: 0, status: "not_out"
        },
        update: { status: "not_out" }
      });
    }

    // Dismiss out batsman + capture dismissal context for scorecard view
    if (is_wicket && dismissed_player_id) {
      const bowlerCredit = ["caught", "bowled", "lbw", "stumped", "hit_wicket", "cb"].includes(wicket_type ?? "");
      await tx.battingEntry.updateMany({
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
    // On a no-ball+bye, the bowler is charged the penalty (1) + the bye runs; on a wide all extras are already in extraRuns
    await tx.bowlingEntry.upsert({
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
        await tx.fieldingEntry.upsert({
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
    await updatePartnerships(tx, inningsId, {
      runs: totalRuns, isLegal, batsman_id, non_striker_id,
      is_wicket, dismissed_player_id, over_number, ball_number,
      is_four, is_six
    });

    return ball;
  });

  // Recompute derived: projected score / win probability / momentum
  const recent = await prisma.ballEvent.findMany({
    where: { innings_id: inningsId, voided: false },
    orderBy: { created_at: "desc" }, take: 12,
    select: { is_wicket: true, runs: true, is_four: true, is_six: true, is_dot: true }
  });
  const fresh = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (fresh) {
    const oversTotal = tournament?.overs_per_innings ?? (match.format === "T20" ? 20 : match.format === "ODI" ? 50 : null);
    const proj = projectedScore(fresh.total_runs, fresh.total_balls, oversTotal ?? 0);
    const wp = winProbability(fresh.total_runs, fresh.total_balls, fresh.total_wickets, fresh.target, oversTotal);
    const mom = momentumIndex(recent);

    const allOut     = fresh.total_wickets >= maxWickets;
    const oversDone   = oversTotal != null && fresh.total_balls >= oversTotal * 6;
    const chaseDone   = fresh.target != null && fresh.total_runs >= fresh.target;
    const inningsDone = !fresh.is_completed && (allOut || oversDone || chaseDone);

    await prisma.innings.update({
      where: { id: inningsId },
      data: {
        projected_score: proj, win_probability: wp, momentum_index: mom,
        is_completed: inningsDone ? true : undefined
      }
    });

    if (inningsDone) {
      await maybeAutoCompleteMatch(match.id, innings.innings_number, tournament?.number_of_innings ?? 2, maxWickets);
    }
  }

  return { ball, innings_id: inningsId };
}

// ── Partnerships ─────────────────────────────────────────────────────────────

async function updatePartnerships(
  tx: TxClient,
  inningsId: string,
  ev: {
    runs: number; isLegal: boolean; batsman_id: string; non_striker_id?: string;
    is_wicket: boolean; dismissed_player_id?: string; over_number: number; ball_number: number;
    is_four: boolean; is_six: boolean;
  }
) {
  // find unbroken partnership
  let pship = await tx.partnership.findFirst({
    where: { innings_id: inningsId, is_unbroken: true },
    orderBy: { wicket_number: "desc" }
  });

  if (!pship) {
    // open one with current batsman and non-striker (if known)
    const wicketsSoFar = (await tx.innings.findUnique({ where: { id: inningsId } }))?.total_wickets ?? 0;
    pship = await tx.partnership.create({
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
    await tx.partnership.update({
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
    await tx.partnership.update({
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

  const balls = await prisma.ballEvent.findMany({ where: { innings_id: inningsId, voided: false } });

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
      id: innings.id, match_id: innings.match_id,
      runs: innings.total_runs, wickets: innings.total_wickets,
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
  const balls = await prisma.ballEvent.findMany({ where: { batsman_id: playerId, voided: false } });
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

export async function undoLastBall(inningsId: string, actorId: string, actorRole: string, reason?: string) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const last = await prisma.ballEvent.findFirst({
    where: { innings_id: inningsId, voided: false },
    orderBy: { created_at: "desc" }
  });
  if (!last) throw BadRequest("No balls to undo");

  // Reverse the stats deltas the same way addBall applied them.
  const isLegal = !last.is_wide && !last.is_no_ball;
  const batsmanRuns = (last.is_wide || last.is_bye || last.is_leg_bye) ? 0 : last.runs;
  const extraRuns = last.is_wide ? last.runs + 1 : last.is_no_ball ? 1 : 0;
  const byeRuns = !last.is_wide && (last.is_bye || last.is_leg_bye) ? last.runs : 0;
  const totalRuns = batsmanRuns + extraRuns + byeRuns + (last.is_penalty ? 5 : 0);

  return prisma.$transaction(async (tx) => {
  await tx.innings.update({
    where: { id: inningsId },
    data: {
      total_runs: { decrement: totalRuns },
      total_wickets: last.is_wicket ? { decrement: 1 } : undefined,
      total_balls: isLegal ? { decrement: 1 } : undefined,
      extras: { decrement: extraRuns + byeRuns + (last.is_penalty ? 5 : 0) },
      wides: last.is_wide ? { decrement: last.runs + 1 } : undefined,
      no_balls: last.is_no_ball ? { decrement: 1 } : undefined,
      byes: !last.is_wide && last.is_bye ? { decrement: last.runs } : undefined,
      leg_byes: !last.is_wide && last.is_leg_bye ? { decrement: last.runs } : undefined,
      boundary_4s: last.is_four ? { decrement: 1 } : undefined,
      boundary_6s: last.is_six ? { decrement: 1 } : undefined,
      dot_balls: last.is_dot ? { decrement: 1 } : undefined,
      penalty_runs: last.is_penalty ? { decrement: 5 } : undefined,
      // Reverse phase-split counters
      pp_runs:     last.phase === "pp"    ? { decrement: totalRuns } : undefined,
      pp_balls:    last.phase === "pp"    && isLegal ? { decrement: 1 } : undefined,
      pp_wickets:  last.phase === "pp"    && last.is_wicket ? { decrement: 1 } : undefined,
      mid_runs:    last.phase === "mid"   ? { decrement: totalRuns } : undefined,
      mid_balls:   last.phase === "mid"   && isLegal ? { decrement: 1 } : undefined,
      mid_wickets: last.phase === "mid"   && last.is_wicket ? { decrement: 1 } : undefined,
      death_runs:   last.phase === "death" ? { decrement: totalRuns } : undefined,
      death_balls:  last.phase === "death" && isLegal ? { decrement: 1 } : undefined,
      death_wickets: last.phase === "death" && last.is_wicket ? { decrement: 1 } : undefined,
    }
  });

  const oneRun = batsmanRuns === 1;
  const twoRun = batsmanRuns === 2;
  const threeRun = batsmanRuns === 3;

  // Reverse batsman + bowler entries
  await tx.battingEntry.updateMany({
    where: { innings_id: inningsId, player_id: last.batsman_id },
    data: {
      runs: { decrement: batsmanRuns },
      balls_faced: isLegal ? { decrement: 1 } : undefined,
      fours: last.is_four ? { decrement: 1 } : undefined,
      sixes: last.is_six ? { decrement: 1 } : undefined,
      dot_balls: last.is_dot ? { decrement: 1 } : undefined,
      singles: oneRun ? { decrement: 1 } : undefined,
      doubles: twoRun ? { decrement: 1 } : undefined,
      threes: threeRun ? { decrement: 1 } : undefined,
    }
  });

  if (last.is_wicket && last.dismissed_player_id) {
    await tx.battingEntry.updateMany({
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

  const bowlerRunsConceded = batsmanRuns + (last.is_no_ball ? byeRuns : 0) + (last.is_wide ? last.runs + 1 : 0) + (last.is_no_ball ? 1 : 0);
  const bowlerWicket = last.is_wicket && !["run_out", "obstructing_field", "handled_ball", "retired_hurt"].includes(last.wicket_type ?? "");
  await tx.bowlingEntry.updateMany({
    where: { innings_id: inningsId, player_id: last.bowler_id },
    data: {
      balls: isLegal ? { decrement: 1 } : undefined,
      runs_conceded: { decrement: bowlerRunsConceded },
      wickets: bowlerWicket ? { decrement: 1 } : undefined,
      wides: last.is_wide ? { decrement: 1 } : undefined,
      no_balls: last.is_no_ball ? { decrement: 1 } : undefined,
      dot_balls: last.is_dot ? { decrement: 1 } : undefined,
      boundaries_4s: last.is_four ? { decrement: 1 } : undefined,
      boundaries_6s: last.is_six ? { decrement: 1 } : undefined,
      // Reverse phase-split counters
      pp_runs:      last.phase === "pp"    ? { decrement: bowlerRunsConceded } : undefined,
      pp_balls:     last.phase === "pp"    && isLegal ? { decrement: 1 } : undefined,
      pp_wickets:   last.phase === "pp"    && bowlerWicket ? { decrement: 1 } : undefined,
      mid_runs:     last.phase === "mid"   ? { decrement: bowlerRunsConceded } : undefined,
      mid_balls:    last.phase === "mid"   && isLegal ? { decrement: 1 } : undefined,
      mid_wickets:  last.phase === "mid"   && bowlerWicket ? { decrement: 1 } : undefined,
      death_runs:   last.phase === "death" ? { decrement: bowlerRunsConceded } : undefined,
      death_balls:  last.phase === "death" && isLegal ? { decrement: 1 } : undefined,
      death_wickets: last.phase === "death" && bowlerWicket ? { decrement: 1 } : undefined,
    }
  });

  // Reverse fielding entry for wicket balls
  if (last.is_wicket && last.fielder_id) {
    const isCatch = last.wicket_type === "caught" || last.wicket_type === "cb";
    const isRunOut = last.wicket_type === "run_out";
    const isStump = last.wicket_type === "stumped";
    if (isCatch || isRunOut || isStump) {
      await tx.fieldingEntry.updateMany({
        where: { innings_id: inningsId, player_id: last.fielder_id },
        data: {
          catches: isCatch ? { decrement: 1 } : undefined,
          run_outs_direct: isRunOut ? { decrement: 1 } : undefined,
          stumpings: isStump ? { decrement: 1 } : undefined,
          direct_hits: isRunOut ? { decrement: 1 } : undefined,
          impact_score: { decrement: 1 }
        }
      });
    }
  }

  // Reverse partnership state
  if (last.is_wicket) {
    // Reopen the most recently closed partnership and reverse its contribution
    const closedPship = await tx.partnership.findFirst({
      where: { innings_id: inningsId, is_unbroken: false },
      orderBy: [{ ended_over: "desc" }, { ended_ball: "desc" }]
    });
    if (closedPship) {
      const newRuns = closedPship.runs - totalRuns;
      const newBalls = closedPship.balls - (isLegal ? 1 : 0);
      if (newRuns <= 0 && newBalls <= 0) {
        // Partnership was created and immediately closed by this ball — delete it
        await tx.partnership.delete({ where: { id: closedPship.id } });
      } else {
        await tx.partnership.update({
          where: { id: closedPship.id },
          data: {
            is_unbroken: true,
            ended_over: null,
            ended_ball: null,
            runs: { decrement: totalRuns },
            balls: isLegal ? { decrement: 1 } : undefined,
            fours: last.is_four ? { decrement: 1 } : undefined,
            sixes: last.is_six ? { decrement: 1 } : undefined,
          }
        });
      }
    }
  } else {
    // Reverse contribution to the active (unbroken) partnership
    const activePship = await tx.partnership.findFirst({
      where: { innings_id: inningsId, is_unbroken: true },
      orderBy: { wicket_number: "desc" }
    });
    if (activePship) {
      const newRuns = activePship.runs - totalRuns;
      const newBalls = activePship.balls - (isLegal ? 1 : 0);
      if (newRuns <= 0 && newBalls <= 0) {
        // This was the first ball of this partnership — delete it
        await tx.partnership.delete({ where: { id: activePship.id } });
      } else {
        await tx.partnership.update({
          where: { id: activePship.id },
          data: {
            runs: { decrement: totalRuns },
            balls: isLegal ? { decrement: 1 } : undefined,
            fours: last.is_four ? { decrement: 1 } : undefined,
            sixes: last.is_six ? { decrement: 1 } : undefined,
          }
        });
      }
    }
  }

  // Void, don't delete — keeps the delivery as an audit trail instead of
  // erasing it. `correction_of_id` stays null: a pure undo has no
  // replacement ball.
  await tx.ballEvent.update({
    where: { id: last.id },
    data: { voided: true, voided_reason: reason?.trim() || "Corrected by scorer" }
  });
  return { voided: last.id };
  });
}

export async function getOverSummary(inningsId: string, overNumber?: number) {
  const where: any = { innings_id: inningsId, voided: false };
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
