import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { createNotification } from "../notifications/notifications.service";
import { eventBus } from "../../lib/EventBus";
import { cacheDel } from "../../config/redis";
import type { EntityType } from "../../types/domain";

const VALID_TYPES: Record<EntityType, string[]> = {
  user: ["athlete_id", "coach_license", "scout_id", "stats_endorsement"],
  organization: ["org_registration"]
};

const BADGE_MAP: Record<string, string> = {
  athlete_id: "verified_player",
  coach_license: "verified_coach",
  scout_id: "verified_scout",
  stats_endorsement: "verified_stats",
  org_registration: "verified_org"
};

export async function submit(input: {
  actorId: string;
  actorRole: string;
  entity_type: EntityType;
  entity_id: string;
  verification_type: string;
  documents: string[];
  notes?: string;
}) {
  if (!VALID_TYPES[input.entity_type]?.includes(input.verification_type))
    throw BadRequest(`Invalid verification_type for ${input.entity_type}`);
  if (input.documents.length === 0) throw BadRequest("At least one document is required");

  if (input.entity_type === "user" && input.entity_id !== input.actorId && input.actorRole !== "admin")
    throw Forbidden("Cannot submit verification for another user");

  if (input.entity_type === "organization") {
    const org = await prisma.organization.findUnique({
      where: { id: input.entity_id },
      select: { owner_user_id: true }
    });
    if (!org) throw NotFound("Organization not found");
    if (org.owner_user_id !== input.actorId && input.actorRole !== "admin")
      throw Forbidden("Cannot submit verification for an organization you do not own");
  }

  const verification = await prisma.verification.create({
    data: {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      verification_type: input.verification_type,
      documents: input.documents,
      notes: input.notes,
      submitted_by: input.actorId
    }
  });

  // Reflect pending status on the target entity.
  if (input.entity_type === "user") {
    await prisma.user.update({
      where: { id: input.entity_id },
      data: { verification_status: "pending" }
    });
  } else {
    await prisma.organization.update({
      where: { id: input.entity_id },
      data: { verification_status: "pending" }
    });
  }

  return verification;
}

export async function listPending(limit = 100) {
  return prisma.verification.findMany({
    where: { status: "pending" },
    orderBy: { created_at: "desc" },
    take: limit
  });
}

export async function review(id: string, reviewerId: string, decision: "approve" | "reject", reason?: string) {
  const v = await prisma.verification.findUnique({ where: { id } });
  if (!v) throw NotFound("Verification not found");
  if (v.status !== "pending") throw BadRequest("Verification already reviewed");

  const newStatus = decision === "approve" ? "approved" : "rejected";
  const badge = BADGE_MAP[v.verification_type];

  await prisma.verification.update({
    where: { id },
    data: {
      status: newStatus,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
      rejection_reason: decision === "reject" ? reason : undefined
    }
  });

  // Update target entity with new status and badge.
  if (v.entity_type === "user") {
    const user = await prisma.user.findUnique({
      where: { id: v.entity_id },
      select: { verification_badges: true }
    });
    const existing = user?.verification_badges ?? [];
    const badges = decision === "approve" && badge && !existing.includes(badge)
      ? [...existing, badge]
      : existing;
    await prisma.user.update({
      where: { id: v.entity_id },
      data: { verification_status: newStatus, verification_badges: badges }
    });
  } else {
    const org = await prisma.organization.findUnique({
      where: { id: v.entity_id },
      select: { verification_badges: true, owner_user_id: true }
    });
    const existing = org?.verification_badges ?? [];
    const badges = decision === "approve" && badge && !existing.includes(badge)
      ? [...existing, badge]
      : existing;
    await prisma.organization.update({
      where: { id: v.entity_id },
      data: { verification_status: newStatus, verification_badges: badges }
    });
  }

  // Notify the entity owner.
  const notifyUserId =
    v.entity_type === "user"
      ? v.entity_id
      : (await prisma.organization.findUnique({ where: { id: v.entity_id }, select: { owner_user_id: true } }))?.owner_user_id ?? v.entity_id;

  const verifyLink = v.entity_type === "user"
    ? `/profile/${v.entity_id}`
    : `/organizations/${v.entity_id}`;

  await createNotification({
    user_id: notifyUserId,
    type: `verification_${newStatus}`,
    title: decision === "approve" ? "Verification approved ✓" : "Verification update",
    body: decision === "approve"
      ? "Your verification has been approved and your badge is now visible on your profile."
      : `Your verification was rejected.${reason ? " Reason: " + reason : ""}`,
    link: verifyLink,
    email: true
  });

  return { ...v, status: newStatus };
}

export async function approveOrg(orgId: string, adminId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { owner_user_id: true, verification_status: true, org_name: true, verification_badges: true }
  });
  if (!org) throw NotFound("Organization not found");

  const existing = org.verification_badges ?? [];
  const badges = existing.includes("verified_org") ? existing : [...existing, "verified_org"];

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { verification_status: "approved", verification_badges: badges }
    }),
    prisma.auditLog.create({
      data: {
        actor_id: adminId,
        actor_role: "admin",
        action: "org_verified",
        target_type: "organization",
        target_id: orgId
      }
    })
  ]);

  eventBus.emit("org.verified", { orgId, adminId });
  await cacheDel(`org:${orgId}`);

  await createNotification({
    user_id: org.owner_user_id,
    type: "org.verified",
    title: "Organization verified ✓",
    body: `${org.org_name} has been verified and now displays the verified badge.`,
    link: `/organizations/${orgId}`,
    email: true
  });

  return { ok: true };
}

export async function rejectOrg(orgId: string, adminId: string, reason: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { owner_user_id: true, org_name: true }
  });
  if (!org) throw NotFound("Organization not found");

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { verification_status: "rejected" }
    }),
    prisma.auditLog.create({
      data: {
        actor_id: adminId,
        actor_role: "admin",
        action: "org_verification_rejected",
        target_type: "organization",
        target_id: orgId,
        details: { reason }
      }
    })
  ]);

  eventBus.emit("org.verification_rejected", { orgId, adminId, reason });
  await cacheDel(`org:${orgId}`);

  await createNotification({
    user_id: org.owner_user_id,
    type: "org.verification_rejected",
    title: "Verification update",
    body: `Verification for ${org.org_name} was not approved. Reason: ${reason}`,
    link: `/organizations/${orgId}`,
    email: true
  });

  return { ok: true };
}
