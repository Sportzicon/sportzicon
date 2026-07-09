import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";
import type { Role } from "../../types/domain";

async function assertOrgOwner(orgId: string, actorId: string, actorRole: Role) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { owner_user_id: true } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the org owner or an admin can manage this organization's tournaments");
}

// Loads the tournament plus its parent org's owner, for ownership checks on
// routes that only have the tournament id (not the org id) in the URL.
async function loadTournamentForOwnerCheck(tournamentId: string) {
  const tournament = await prisma.orgTournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { owner_user_id: true } } }
  });
  if (!tournament) throw NotFound("Tournament not found");
  return tournament;
}

function assertOwnerOrAdmin(ownerUserId: string, actorId: string, actorRole: Role) {
  if (ownerUserId !== actorId && actorRole !== "admin")
    throw Forbidden("Only the org owner or an admin can manage this organization's tournaments");
}

export async function createOrgTournament(orgId: string, actorId: string, actorRole: Role, input: Record<string, unknown>) {
  await assertOrgOwner(orgId, actorId, actorRole);
  return prisma.orgTournament.create({
    data: {
      organization_id: orgId,
      name: input.name as string,
      sport: input.sport as string,
      season: input.season as string | undefined,
      scoring_tournament_id: input.scoring_tournament_id as string | undefined
    }
  });
}

export async function listOrgTournaments(orgId: string) {
  return prisma.orgTournament.findMany({
    where: { organization_id: orgId },
    orderBy: { created_at: "desc" }
  });
}

// Cross-org feed for the Tournaments tab's Live/Upcoming groupings —
// unlike listOrgTournaments above, this isn't scoped to a single org.
export async function listAllOrgTournaments(params: { status?: string; sport?: string; cursor?: string; limit: number }) {
  const { status, sport, cursor, limit } = params;
  const items = await prisma.orgTournament.findMany({
    where: { ...(status && { status }), ...(sport && { sport }) },
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: { organization: { select: { org_name: true, owner_user_id: true } } }
  });

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function getOrgTournament(tournamentId: string) {
  const tournament = await prisma.orgTournament.findUnique({
    where: { id: tournamentId },
    include: { teams: { include: { standing: true } } }
  });
  if (!tournament) throw NotFound("Tournament not found");
  return tournament;
}

export async function updateOrgTournament(tournamentId: string, actorId: string, actorRole: Role, patch: Record<string, unknown>) {
  const tournament = await loadTournamentForOwnerCheck(tournamentId);
  assertOwnerOrAdmin(tournament.organization.owner_user_id, actorId, actorRole);

  const allowed = ["name", "sport", "season", "status", "scoring_tournament_id"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  return prisma.orgTournament.update({ where: { id: tournamentId }, data });
}

export async function deleteOrgTournament(tournamentId: string, actorId: string, actorRole: Role) {
  const tournament = await loadTournamentForOwnerCheck(tournamentId);
  assertOwnerOrAdmin(tournament.organization.owner_user_id, actorId, actorRole);
  await prisma.orgTournament.delete({ where: { id: tournamentId } });
  return { ok: true };
}

export async function addOrgTeam(tournamentId: string, actorId: string, actorRole: Role, input: Record<string, unknown>) {
  const tournament = await loadTournamentForOwnerCheck(tournamentId);
  assertOwnerOrAdmin(tournament.organization.owner_user_id, actorId, actorRole);

  return prisma.orgTeam.create({
    data: {
      org_tournament_id: tournamentId,
      name: input.name as string,
      scoring_team_id: input.scoring_team_id as string | undefined
    }
  });
}

export async function deleteOrgTeam(tournamentId: string, teamId: string, actorId: string, actorRole: Role) {
  const tournament = await loadTournamentForOwnerCheck(tournamentId);
  assertOwnerOrAdmin(tournament.organization.owner_user_id, actorId, actorRole);

  const team = await prisma.orgTeam.findUnique({ where: { id: teamId } });
  if (!team || team.org_tournament_id !== tournamentId) throw NotFound("Team not found in this tournament");

  await prisma.orgTeam.delete({ where: { id: teamId } });
  return { ok: true };
}
