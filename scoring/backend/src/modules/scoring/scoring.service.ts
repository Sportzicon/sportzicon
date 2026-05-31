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

// ── Ball-by-ball live scoring ─────────────────────────────────────────────────

export async function addBall(inningsId: string, actorId: string, actorRole: string, input: any) {
  const innings = await prisma.innings.findUnique({ where: { id: inningsId } });
  if (!innings) throw NotFound("Innings not found");
  if (innings.is_completed) throw BadRequest("Innings is already completed");

  const match = await prisma.match.findUnique({ where: { id: innings.match_id } });
  if (!match) throw NotFound("Match not found");
  await assertManager(match.tournament_id, actorId, actorRole);

  const {
    over_number, ball_number, batsman_id, bowler_id,
    runs = 0, is_wide = false, is_no_ball = false, is_bye = false, is_leg_bye = false,
    is_wicket = false, is_four = false, is_six = false,
    wicket_type, dismissed_player_id, fielder_id
  } = input;

  const ball = await prisma.ballEvent.create({
    data: {
      innings_id: inningsId,
      over_number, ball_number,
      batsman_id, bowler_id,
      runs, is_wide, is_no_ball, is_bye, is_leg_bye,
      is_wicket, is_four, is_six,
      wicket_type, dismissed_player_id, fielder_id
    }
  });

  const isLegal = !is_wide && !is_no_ball;
  const batsmanRuns = (is_bye || is_leg_bye) ? 0 : runs;
  const extraRuns = is_wide ? runs + 1 : is_no_ball ? 1 : 0;
  const byeRuns = (is_bye || is_leg_bye) ? runs : 0;
  const totalRuns = batsmanRuns + extraRuns + byeRuns;

  // Innings totals
  await prisma.innings.update({
    where: { id: inningsId },
    data: {
      total_runs: { increment: totalRuns },
      total_wickets: is_wicket ? { increment: 1 } : undefined,
      total_balls: isLegal ? { increment: 1 } : undefined,
      extras: { increment: extraRuns + byeRuns },
      wides: is_wide ? { increment: runs + 1 } : undefined,
      no_balls: is_no_ball ? { increment: 1 } : undefined,
      byes: is_bye ? { increment: runs } : undefined,
      leg_byes: is_leg_bye ? { increment: runs } : undefined
    }
  });

  // Batsman stats — create if missing (in case lineup wasn't set)
  await prisma.battingEntry.upsert({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: batsman_id } },
    create: {
      innings_id: inningsId, player_id: batsman_id, batting_position: 99,
      runs: batsmanRuns, balls_faced: isLegal ? 1 : 0,
      fours: is_four ? 1 : 0, sixes: is_six ? 1 : 0, status: "not_out"
    },
    update: {
      runs: { increment: batsmanRuns },
      balls_faced: isLegal ? { increment: 1 } : undefined,
      fours: is_four ? { increment: 1 } : undefined,
      sixes: is_six ? { increment: 1 } : undefined,
      status: "not_out"
    }
  });

  // Dismiss out batsman
  if (is_wicket && dismissed_player_id) {
    const bowlerCredit = ["caught", "bowled", "lbw", "stumped", "hit_wicket"].includes(wicket_type ?? "");
    await prisma.battingEntry.updateMany({
      where: { innings_id: inningsId, player_id: dismissed_player_id },
      data: {
        status: "out",
        dismissal_type: wicket_type,
        dismissed_by_id: bowlerCredit ? bowler_id : undefined,
        fielder_id
      }
    });
  }

  // Bowler stats
  const bowlerRunsConceded = batsmanRuns + (is_wide ? runs + 1 : 0) + (is_no_ball ? 1 : 0);
  const bowlerWicket = is_wicket && !["run_out", "obstructing_field", "handled_ball"].includes(wicket_type ?? "");
  await prisma.bowlingEntry.upsert({
    where: { innings_id_player_id: { innings_id: inningsId, player_id: bowler_id } },
    create: {
      innings_id: inningsId, player_id: bowler_id,
      balls: isLegal ? 1 : 0, runs_conceded: bowlerRunsConceded,
      wickets: bowlerWicket ? 1 : 0,
      wides: is_wide ? 1 : 0, no_balls: is_no_ball ? 1 : 0
    },
    update: {
      balls: isLegal ? { increment: 1 } : undefined,
      runs_conceded: { increment: bowlerRunsConceded },
      wickets: bowlerWicket ? { increment: 1 } : undefined,
      wides: is_wide ? { increment: 1 } : undefined,
      no_balls: is_no_ball ? { increment: 1 } : undefined
    }
  });

  return { ball, innings_id: inningsId };
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
