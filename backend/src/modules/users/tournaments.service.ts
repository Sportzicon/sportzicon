import { prisma } from "../../config/prisma";
import { newId } from "../../utils/ids";
import { Forbidden, NotFound } from "../../utils/errors";

export async function listTournaments(userId: string) {
  return prisma.athleteTournament.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
}

export async function createTournament(
  userId: string,
  data: { name: string; year: string; team?: string; format?: string; result?: string }
) {
  return prisma.athleteTournament.create({
    data: { id: newId(), user_id: userId, ...data },
  });
}

export async function updateTournament(
  userId: string,
  tournamentId: string,
  actorRole: string,
  data: { name: string; year: string; team?: string; format?: string; result?: string }
) {
  const t = await prisma.athleteTournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw NotFound("Tournament not found");
  if (t.user_id !== userId && actorRole !== "admin") throw Forbidden("Not your tournament");

  return prisma.athleteTournament.update({
    where: { id: tournamentId },
    data: { name: data.name, year: data.year, team: data.team ?? null, format: data.format ?? null, result: data.result ?? null },
  });
}

export async function deleteTournament(userId: string, tournamentId: string, actorRole: string) {
  const t = await prisma.athleteTournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw NotFound("Tournament not found");
  if (t.user_id !== userId && actorRole !== "admin") throw Forbidden("Not your tournament");

  await prisma.athleteTournament.delete({ where: { id: tournamentId } });
}
