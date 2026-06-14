import { prisma } from "../../config/prisma";
import { repositories } from "../../repositories";
import { eventBus } from "../../lib/EventBus";
import { StateMachine } from "../../lib/StateMachine";
import { APPLICATION_TRANSITIONS } from "../../workflows/applicationWorkflow";
import { BadRequest, Conflict, Forbidden, NotFound, UnprocessableEntity } from "../../utils/errors";
import { logger } from "../../config/logger";
import {
  APP_APPLIED,
  APP_TRANSITIONED,
  type ApplicationAppliedEvent,
  type ApplicationTransitionedEvent,
} from "../../events/types";
import type { ApplicationStatus, Role } from "../../types/domain";

// ─── Apply ───────────────────────────────────────────────────────────────────

export async function apply(
  applicantId: string,
  opportunityId: string,
  input: { cover_note?: string; documents?: string[] }
) {
  // a. Opportunity exists and status === "open"
  const opp = await repositories.opportunity.findById(opportunityId);
  if (!opp) throw NotFound("Opportunity not found");
  if (opp.status !== "open") throw BadRequest("Opportunity is not open");

  // b. application_deadline >= now()
  if (new Date(opp.application_deadline) < new Date()) throw BadRequest("Application deadline has passed");

  const user = await repositories.user.findById(applicantId, {
    id: true, full_name: true, dob: true, gender: true, role: true, athlete_data: true,
  });
  if (!user) throw NotFound("Applicant not found");

  // Eligibility checks (age, gender, sport)
  if (user.dob) {
    const age = Math.floor((Date.now() - new Date(user.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    if (age < opp.age_min || age > opp.age_max)
      throw BadRequest(`Age eligibility not met (${opp.age_min}-${opp.age_max})`);
  }
  if (opp.gender_eligibility !== "all" && user.gender && user.gender !== opp.gender_eligibility)
    throw BadRequest("Gender eligibility not met");
  if (opp.sport && user.role === "athlete") {
    const athleteData = user.athlete_data as { primary_sport?: string } | null;
    const athleteSport = athleteData?.primary_sport?.toLowerCase().trim();
    const oppSport = opp.sport.toLowerCase().trim();
    if (athleteSport && athleteSport !== oppSport) {
      throw BadRequest(
        `Your primary sport (${athleteData?.primary_sport}) does not match this opportunity's sport (${opp.sport})`
      );
    }
  }

  // c & d: SELECT FOR UPDATE to prevent race conditions on duplicate check and vacancy check
  const application = await prisma.$transaction(async (tx) => {
    const [lockedRow] = await tx.$queryRaw<Array<{
      vacancies: number | null;
      vacancies_filled: number;
      status: string;
      application_deadline: string;
    }>>`
      SELECT vacancies, vacancies_filled, status, application_deadline
      FROM "Opportunity"
      WHERE id = ${opportunityId}::uuid
      FOR UPDATE
    `;

    // Re-check status and deadline inside the lock in case they changed
    if (lockedRow.status !== "open") throw BadRequest("Opportunity is not open");
    if (new Date(lockedRow.application_deadline) < new Date()) throw BadRequest("Application deadline has passed");

    // c. No existing application (other than withdrawn)
    const existing = await tx.application.findUnique({
      where: {
        opportunity_id_applicant_user_id: {
          opportunity_id: opportunityId,
          applicant_user_id: applicantId,
        },
      },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "withdrawn") throw Conflict("Already applied");

    // d. application_count < vacancies
    if (lockedRow.vacancies !== null && lockedRow.vacancies_filled >= lockedRow.vacancies) {
      throw BadRequest("This opportunity is full");
    }

    // Allow reapplication after withdrawal
    if (existing?.status === "withdrawn") {
      return tx.application.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          cover_note: input.cover_note ?? null,
          documents: input.documents ?? [],
          rejection_reason: null,
          history: [{ status: "pending", at: new Date(), by: applicantId }] as object[],
        },
      });
    }

    const app = await tx.application.create({
      data: {
        opportunity_id: opportunityId,
        applicant_user_id: applicantId,
        cover_note: input.cover_note,
        documents: input.documents ?? [],
        history: [{ status: "pending", at: new Date(), by: applicantId }] as object[],
      },
    });
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: { application_count: { increment: 1 } },
    });
    return app;
  });

  eventBus.emit<ApplicationAppliedEvent>(APP_APPLIED, {
    applicationId: application.id,
    applicantId,
    applicantName: user.full_name,
    opportunityId,
    opportunityTitle: opp.title,
    posterId: opp.posted_by_user_id,
  });

  return {
    ...application,
    opportunity_title: opp.title,
    org_id: opp.org_id,
    applicant_name: user.full_name,
    applied_at: (application.applied_at as unknown as Date).getTime(),
    updated_at: (application.updated_at as unknown as Date).getTime(),
  };
}

// ─── Transition ──────────────────────────────────────────────────────────────

export async function transition(
  appId: string,
  actor: { id: string; role: Role },
  next: ApplicationStatus,
  reason?: string
) {
  const app = await repositories.application.findById(appId);
  if (!app) throw NotFound("Application not found");

  const opp = await repositories.opportunity.findById(app.opportunity_id);
  if (!opp) throw NotFound("Opportunity not found");

  const isAdmin     = actor.role === "admin";
  const isApplicant = actor.id === app.applicant_user_id;

  if (next === "withdrawn" && !isApplicant && !isAdmin)
    throw Forbidden("Only the applicant can withdraw");

  if (next !== "withdrawn") {
    // Ownership: verify org.owner_user_id === actor.id OR admin
    const org = await prisma.organization.findUnique({
      where: { id: opp.org_id },
      select: { owner_user_id: true },
    });
    const isOrgOwner = org?.owner_user_id === actor.id;
    if (!isOrgOwner && !isAdmin)
      throw Forbidden("Only the organisation owner or an admin can change this status");
  }

  // ── Validate transition before side effects ────────────────────────────────
  const machine = new StateMachine<ApplicationStatus>(
    app.status as ApplicationStatus,
    APPLICATION_TRANSITIONS
  );

  if (!machine.can(next)) {
    throw UnprocessableEntity(`Invalid status transition: ${app.status} → ${next}`);
  }

  const newHistory = [
    ...(app.history as object[]),
    { status: next, at: new Date(), by: actor.id, ...(reason ? { reason } : {}) },
  ];

  // ── Atomic vacancy management on "selected" ───────────────────────────────
  if (next === "selected") {
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: appId },
        data: {
          status: "selected",
          rejection_reason: null,
          history: newHistory,
        },
      });

      if (opp.vacancies) {
        await tx.$executeRaw`
          UPDATE "Opportunity"
          SET vacancies_filled = vacancies_filled + 1
          WHERE id = ${opp.id}::uuid
        `;
        const [row] = await tx.$queryRaw<Array<{ vacancies_filled: number; vacancies: number | null }>>`
          SELECT vacancies_filled, vacancies FROM "Opportunity" WHERE id = ${opp.id}::uuid
        `;
        if (row && row.vacancies !== null && row.vacancies_filled >= row.vacancies) {
          await tx.opportunity.update({ where: { id: opp.id }, data: { status: "filled" } });
        }
      }
    });

    // Update athlete availability (non-critical, best-effort)
    try {
      await repositories.user.updateAthleteData(app.applicant_user_id, { availability: "not_available" });
    } catch (err) {
      logger.warn({ err }, "failed to update athlete availability after selection");
    }
  } else {
    // ── All other transitions ──────────────────────────────────────────────
    await repositories.application.update(appId, {
      status: next,
      rejection_reason: next === "rejected" ? reason : (app.rejection_reason ?? null),
      history: newHistory,
    });

    // Re-open a filled opportunity if a shortlisted applicant is rejected or withdrawn
    if ((next === "withdrawn" || next === "rejected") && opp.status === "filled") {
      await repositories.opportunity.updateStatus(opp.id, "open");
    }
  }

  // ── Emit domain event ─────────────────────────────────────────────────────
  const updated = await repositories.application.findById(appId);

  eventBus.emit<ApplicationTransitionedEvent>(APP_TRANSITIONED, {
    applicationId: appId,
    applicantId: app.applicant_user_id,
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    from: app.status as ApplicationStatus,
    to: next,
    reason,
    actorId: actor.id,
  });

  return updated;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listMyApplications(userId: string, limit = 50) {
  const rows = await repositories.application.findManyByApplicant(userId, limit);
  return rows.map((r) => ({
    ...r,
    applied_at: (r.applied_at as unknown as Date).getTime(),
    updated_at: (r.updated_at as unknown as Date).getTime(),
  }));
}

export async function listApplicantsForOpportunity(
  opportunityId: string,
  actor: { id: string; role: Role }
) {
  const opp = await repositories.opportunity.findById(opportunityId);
  if (!opp) throw NotFound("Opportunity not found");

  const org = await prisma.organization.findUnique({
    where: { id: opp.org_id },
    select: { owner_user_id: true },
  });
  const isOrgOwner = org?.owner_user_id === actor.id;

  if (!isOrgOwner && opp.posted_by_user_id !== actor.id && actor.role !== "admin")
    throw Forbidden("Only the organisation owner, poster, or an admin can view applicants");

  const rows = await repositories.application.findManyByOpportunity(opportunityId);
  return rows.map((r) => ({
    ...r,
    applied_at: (r.applied_at as unknown as Date).getTime(),
    updated_at: (r.updated_at as unknown as Date).getTime(),
  }));
}

export async function getApplication(appId: string, actor: { id: string; role: Role }) {
  const app = await repositories.application.findById(appId);
  if (!app) throw NotFound("Application not found");

  if (app.applicant_user_id !== actor.id && actor.role !== "admin") {
    const opp = await repositories.opportunity.findById(app.opportunity_id);
    if (opp?.posted_by_user_id !== actor.id) throw Forbidden("Not allowed to view this application");
  }

  return app;
}
