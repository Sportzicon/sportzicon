import { prisma } from "../../config/prisma";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../utils/errors";
import { createNotification } from "../notifications/notifications.service";
import { logger } from "../../config/logger";
import type { ApplicationStatus, Role } from "../../types/domain";

const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ["shortlisted", "rejected", "withdrawn"],
  shortlisted: ["selected", "rejected", "withdrawn"],
  selected: ["withdrawn"],
  rejected: [],
  withdrawn: []
};

export async function apply(applicantId: string, opportunityId: string, input: { cover_note?: string; documents?: string[] }) {
  const [opp, user] = await Promise.all([
    prisma.opportunity.findUnique({ where: { id: opportunityId } }),
    prisma.user.findUnique({ where: { id: applicantId }, select: { id: true, full_name: true, dob: true, gender: true } })
  ]);
  if (!opp) throw NotFound("Opportunity not found");
  if (!user) throw NotFound("Applicant not found");

  if (opp.status !== "open") throw BadRequest("This opportunity is no longer accepting applications");
  if (new Date(opp.application_deadline) < new Date()) throw BadRequest("Application deadline has passed");

  if (user.dob) {
    const age = Math.floor((Date.now() - new Date(user.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    if (age < opp.age_min || age > opp.age_max)
      throw BadRequest(`Age eligibility not met (${opp.age_min}-${opp.age_max})`);
  }
  if (opp.gender_eligibility !== "all" && user.gender && user.gender !== opp.gender_eligibility)
    throw BadRequest("Gender eligibility not met");

  const existing = await prisma.application.findUnique({
    where: { opportunity_id_applicant_user_id: { opportunity_id: opportunityId, applicant_user_id: applicantId } },
    select: { id: true }
  });
  if (existing) throw Conflict("You have already applied to this opportunity");

  const [application] = await prisma.$transaction([
    prisma.application.create({
      data: {
        opportunity_id: opportunityId,
        applicant_user_id: applicantId,
        cover_note: input.cover_note,
        documents: input.documents ?? [],
        history: [{ status: "pending", at: new Date(), by: applicantId }] as object[]
      }
    }),
    prisma.opportunity.update({
      where: { id: opportunityId },
      data: { application_count: { increment: 1 } }
    })
  ]);

  await createNotification({
    user_id: opp.posted_by_user_id,
    type: "new_application",
    title: "New application received",
    body: `${user.full_name} applied to "${opp.title}".`,
    link: `/opportunities/${opp.id}/applicants`,
    email: true
  });

  return {
    ...application,
    opportunity_title: opp.title,
    org_id: opp.org_id,
    applicant_name: user.full_name,
    applied_at: application.applied_at.getTime(),
    updated_at: application.updated_at.getTime()
  };
}

export async function transition(
  appId: string,
  actor: { id: string; role: Role },
  next: ApplicationStatus,
  reason?: string
) {
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) throw NotFound("Application not found");

  const opp = await prisma.opportunity.findUnique({ where: { id: app.opportunity_id } });
  if (!opp) throw NotFound("Opportunity not found");

  const isApplicant = actor.id === app.applicant_user_id;
  const isPoster = actor.id === opp.posted_by_user_id;
  const isAdmin = actor.role === "admin";

  if (next === "withdrawn" && !isApplicant && !isAdmin)
    throw Forbidden("Only the applicant can withdraw");
  if (next !== "withdrawn" && !isPoster && !isAdmin)
    throw Forbidden("Only the opportunity poster can change this status");

  const current = app.status as ApplicationStatus;
  if (!transitions[current].includes(next))
    throw BadRequest(`Illegal transition from ${current} to ${next}`);

  const newHistory = [
    ...(app.history as object[]),
    { status: next, at: new Date(), by: actor.id, ...(reason ? { reason } : {}) }
  ];

  const [updated] = await prisma.$transaction([
    prisma.application.update({
      where: { id: appId },
      data: {
        status: next,
        rejection_reason: next === "rejected" ? reason : app.rejection_reason ?? undefined,
        history: newHistory as object[]
      }
    }),
    ...(next === "selected" && opp.vacancies
      ? [prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            vacancies_filled: { increment: 1 },
            status: (opp.vacancies_filled + 1 >= opp.vacancies) ? "filled" : opp.status
          }
        })]
      : []),
    ...(next === "withdrawn" && current === "selected" && opp.vacancies
      ? [prisma.opportunity.update({
          where: { id: opp.id },
          data: { vacancies_filled: { decrement: 1 }, status: "open" }
        })]
      : [])
  ]);

  const notifyMap: Record<string, { title: string; body: string; email: boolean }> = {
    shortlisted: { title: "You've been shortlisted", body: `Your application for "${opp.title}" has been shortlisted.`, email: true },
    selected: { title: "You've been selected!", body: `Congratulations — you've been selected for "${opp.title}".`, email: true },
    rejected: { title: "Application update", body: `Your application for "${opp.title}" was not successful.${reason ? " Reason: " + reason : ""}`, email: false }
  };
  const n = notifyMap[next];
  if (n) {
    await createNotification({
      user_id: app.applicant_user_id,
      type: `application_${next}`,
      title: n.title,
      body: n.body,
      // Link to the opportunity detail page — athlete can see org contact + full details.
      // (There is no /applications/:id route, so the old link caused a 404.)
      link: `/opportunities/${opp.id}`,
      email: n.email
    });
  }

  // When selected, mark athlete as no longer available so their profile reflects it.
  if (next === "selected") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: app.applicant_user_id },
        select: { athlete_data: true }
      });
      if (user?.athlete_data) {
        await prisma.user.update({
          where: { id: app.applicant_user_id },
          data: {
            athlete_data: { ...(user.athlete_data as object), availability: "not_available" }
          }
        });
      }
    } catch (err) {
      logger.warn({ err }, "failed to update athlete availability after selection");
    }
  }

  return updated;
}

export async function listMyApplications(userId: string, limit = 50) {
  const rows = await prisma.application.findMany({
    where: { applicant_user_id: userId },
    orderBy: { applied_at: "desc" },
    take: limit,
    include: { opportunity: { select: { title: true, org_id: true, type: true, sport: true, status: true } } }
  });
  return rows.map(({ opportunity, applied_at, updated_at, ...r }) => ({
    ...r,
    opportunity_title: opportunity.title,
    org_id: opportunity.org_id,
    applied_at: applied_at.getTime(),
    updated_at: updated_at.getTime()
  }));
}

export async function listApplicantsForOpportunity(opportunityId: string, actor: { id: string; role: Role }) {
  const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { posted_by_user_id: true } });
  if (!opp) throw NotFound("Opportunity not found");
  if (opp.posted_by_user_id !== actor.id && actor.role !== "admin")
    throw Forbidden("Only the poster or an admin can view applicants");

  const rows = await prisma.application.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { applied_at: "desc" },
    include: {
      applicant: {
        select: {
          id: true, full_name: true, profile_photo_url: true,
          country: true, city: true, athlete_data: true,
          verification_status: true, verification_badges: true
        }
      }
    }
  });
  return rows.map(({ applicant, applied_at, updated_at, ...r }) => ({
    ...r,
    applicant_name: applicant.full_name,
    applicant: {
      ...applicant,
      athlete: applicant.athlete_data,
      verification: { status: applicant.verification_status, badges: applicant.verification_badges },
      athlete_data: undefined,
      verification_status: undefined,
      verification_badges: undefined
    },
    applied_at: applied_at.getTime(),
    updated_at: updated_at.getTime()
  }));
}

export async function getApplication(appId: string, actor: { id: string; role: Role }) {
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) throw NotFound("Application not found");

  if (app.applicant_user_id !== actor.id && actor.role !== "admin") {
    const opp = await prisma.opportunity.findUnique({
      where: { id: app.opportunity_id },
      select: { posted_by_user_id: true }
    });
    if (opp?.posted_by_user_id !== actor.id) throw Forbidden("Not allowed to view this application");
  }
  return app;
}
