import { repositories } from "../../repositories";
import { eventBus } from "../../lib/EventBus";
import { StateMachine } from "../../lib/StateMachine";
import { APPLICATION_TRANSITIONS } from "../../workflows/applicationWorkflow";
import { OPPORTUNITY_TRANSITIONS } from "../../workflows/opportunityWorkflow";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../utils/errors";
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
  const [opp, user] = await Promise.all([
    repositories.opportunity.findById(opportunityId),
    repositories.user.findById(applicantId, {
      id: true, full_name: true, dob: true, gender: true, role: true, athlete_data: true,
    }),
  ]);

  if (!opp)  throw NotFound("Opportunity not found");
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

  // Sport compatibility check — athletes must match the opportunity's sport
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

  const existing = await repositories.application.findByOpportunityAndApplicant(opportunityId, applicantId);
  if (existing && existing.status !== "withdrawn") throw Conflict("You have already applied to this opportunity");

  // Allow reapplication after withdrawal: reset existing record to pending with new cover note
  const application = existing?.status === "withdrawn"
    ? await repositories.application.update(existing.id, {
        status: "pending",
        cover_note: input.cover_note ?? null,
        documents: input.documents ?? [],
        rejection_reason: null,
        history: [],
      })
    : await repositories.application.create({
        opportunity_id: opportunityId,
        applicant_user_id: applicantId,
        cover_note: input.cover_note,
        documents: input.documents ?? [],
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

  const isApplicant = actor.id === app.applicant_user_id;
  const isPoster    = actor.id === opp.posted_by_user_id;
  const isAdmin     = actor.role === "admin";

  if (next === "withdrawn" && !isApplicant && !isAdmin)
    throw Forbidden("Only the applicant can withdraw");
  if (next !== "withdrawn" && !isPoster && !isAdmin)
    throw Forbidden("Only the opportunity poster can change this status");

  // ── StateMachine validates the transition ──────────────────────────────────
  const machine = new StateMachine<ApplicationStatus>(
    app.status as ApplicationStatus,
    APPLICATION_TRANSITIONS
  );

  // Register vacancy/status side-effects on the machine before transitioning
  machine.on("selected", async () => {
    if (opp.vacancies) {
      const updated = await repositories.opportunity.updateVacanciesFilled(opp.id, 1);
      if (updated.vacancies_filled >= (opp.vacancies ?? 0)) {
        const oppMachine = new StateMachine("open", OPPORTUNITY_TRANSITIONS);
        await oppMachine.transition("filled");
        await repositories.opportunity.updateStatus(opp.id, "filled");
      }
    }
  });

  machine.on("selected", async () => {
    try {
      await repositories.user.updateAthleteData(app.applicant_user_id, { availability: "not_available" });
    } catch (err) {
      logger.warn({ err }, "failed to update athlete availability after selection");
    }
  });

  machine.on("withdrawn", async () => {
    if (app.status === "selected" && opp.vacancies) {
      const updated = await repositories.opportunity.updateVacanciesFilled(opp.id, -1);
      if (updated.vacancies_filled < (opp.vacancies ?? 0)) {
        await repositories.opportunity.updateStatus(opp.id, "open");
      }
    }
  });

  await machine.transition(next, { actor, app, opp });

  // ── Persist the new state and history ─────────────────────────────────────
  const newHistory = [
    ...(app.history as object[]),
    { status: next, at: new Date(), by: actor.id, ...(reason ? { reason } : {}) },
  ];

  const updated = await repositories.application.update(appId, {
    status: next,
    rejection_reason: next === "rejected" ? reason : (app.rejection_reason ?? null),
    history: newHistory,
  });

  // ── Emit domain event — notification handler will react ───────────────────
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
  if (opp.posted_by_user_id !== actor.id && actor.role !== "admin")
    throw Forbidden("Only the poster or an admin can view applicants");

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
