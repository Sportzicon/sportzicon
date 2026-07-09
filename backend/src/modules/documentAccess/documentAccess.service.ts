import { prisma } from "../../config/prisma";
import { StateMachine } from "../../lib/StateMachine";
import { eventBus } from "../../lib/EventBus";
import { DOC_ACCESS_TRANSITIONS } from "../../workflows/documentAccessWorkflow";
import { BadRequest, Conflict, Forbidden, NotFound, UnprocessableEntity } from "../../utils/errors";
import {
  DOC_ACCESS_REQUESTED,
  DOC_ACCESS_DECIDED,
  type DocumentAccessRequestedEvent,
  type DocumentAccessDecidedEvent,
} from "../../events/types";
import type { DocAccessStatus } from "@prisma/client";
import type { Role } from "../../types/domain";

const REQUESTER_SELECT = {
  id: true,
  full_name: true,
  role: true,
  profile_photo_url: true,
} as const;

export async function requestAccess(
  requesterId: string,
  requesterRole: string,
  athleteId: string,
  reason?: string
) {
  if (requesterId === athleteId) throw BadRequest("You cannot request access to your own documents");

  const athlete = await prisma.user.findUnique({
    where: { id: athleteId },
    select: { id: true, role: true },
  });
  if (!athlete) throw NotFound("Athlete not found");
  if (athlete.role !== "athlete") throw BadRequest("Document access requests can only target athlete profiles");

  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { full_name: true },
  });
  if (!requester) throw NotFound("Requester not found");

  const existing = await prisma.documentAccessRequest.findUnique({
    where: { requester_id_athlete_id: { requester_id: requesterId, athlete_id: athleteId } },
  });

  let record;
  if (!existing) {
    record = await prisma.documentAccessRequest.create({
      data: { requester_id: requesterId, athlete_id: athleteId, reason },
    });
  } else if (existing.status === "pending") {
    throw Conflict("Access request already pending");
  } else if (existing.status === "approved") {
    throw Conflict("You already have access to this athlete's documents");
  } else {
    const machine = new StateMachine<DocAccessStatus>(existing.status, DOC_ACCESS_TRANSITIONS);
    if (!machine.can("pending")) throw UnprocessableEntity(`Invalid status transition: ${existing.status} → pending`);
    record = await prisma.documentAccessRequest.update({
      where: { id: existing.id },
      data: { status: "pending", reason, requested_at: new Date(), decided_at: null, decided_by: null },
    });
  }

  eventBus.emit<DocumentAccessRequestedEvent>(DOC_ACCESS_REQUESTED, {
    requestId: record.id,
    requesterId,
    requesterName: requester.full_name,
    requesterRole,
    athleteId,
  });

  return record;
}

export async function listForAthlete(
  athleteId: string,
  actor: { id: string; role: Role },
  status?: DocAccessStatus
) {
  if (actor.id !== athleteId && actor.role !== "admin")
    throw Forbidden("Only the athlete or an admin can view these requests");

  return prisma.documentAccessRequest.findMany({
    where: { athlete_id: athleteId, ...(status ? { status } : {}) },
    include: { requester: { select: REQUESTER_SELECT } },
    orderBy: { requested_at: "desc" },
  });
}

export async function getMyStatus(requesterId: string, athleteId: string) {
  const record = await prisma.documentAccessRequest.findUnique({
    where: { requester_id_athlete_id: { requester_id: requesterId, athlete_id: athleteId } },
    select: { status: true },
  });
  return { status: record?.status ?? null };
}

export async function decide(
  requestId: string,
  actor: { id: string; role: Role },
  newStatus: "approved" | "rejected" | "revoked"
) {
  const record = await prisma.documentAccessRequest.findUnique({ where: { id: requestId } });
  if (!record) throw NotFound("Access request not found");

  if (actor.id !== record.athlete_id && actor.role !== "admin")
    throw Forbidden("Only the athlete or an admin can decide on this request");

  const machine = new StateMachine<DocAccessStatus>(record.status, DOC_ACCESS_TRANSITIONS);
  if (!machine.can(newStatus)) throw UnprocessableEntity(`Invalid status transition: ${record.status} → ${newStatus}`);

  await prisma.$transaction([
    prisma.documentAccessRequest.update({
      where: { id: requestId },
      data: { status: newStatus, decided_at: new Date(), decided_by: actor.id },
    }),
    prisma.auditLog.create({
      data: {
        actor_id: actor.id,
        actor_role: actor.role,
        action: `doc_access_${newStatus}`,
        target_type: "document_access_request",
        target_id: requestId,
        details: { athleteId: record.athlete_id, requesterId: record.requester_id },
      },
    }),
  ]);

  eventBus.emit<DocumentAccessDecidedEvent>(DOC_ACCESS_DECIDED, {
    requestId,
    requesterId: record.requester_id,
    athleteId: record.athlete_id,
    status: newStatus,
    actorId: actor.id,
  });

  return prisma.documentAccessRequest.findUnique({ where: { id: requestId } });
}

export async function hasApprovedAccess(requesterId: string, athleteId: string): Promise<boolean> {
  const record = await prisma.documentAccessRequest.findUnique({
    where: { requester_id_athlete_id: { requester_id: requesterId, athlete_id: athleteId } },
    select: { status: true },
  });
  return record?.status === "approved";
}
