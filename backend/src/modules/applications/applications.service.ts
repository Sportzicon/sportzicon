import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import { createNotification } from "../notifications/notifications.service";
import type {
  ApplicationDoc,
  ApplicationStatus,
  OpportunityDoc,
  Role,
  UserDoc
} from "../../types/domain";

// SRS 3.5 — State machine. Transitions are explicit; only these are legal.
const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ["shortlisted", "rejected", "withdrawn"],
  shortlisted: ["selected", "rejected", "withdrawn"],
  selected: ["withdrawn"], // applicant may still withdraw post-selection
  rejected: [],
  withdrawn: []
};

export async function apply(applicantId: string, opportunityId: string, input: { cover_note?: string; documents?: string[] }) {
  const oppRef = db.collection(Collections.opportunities).doc(opportunityId);
  const userRef = db.collection(Collections.users).doc(applicantId);

  const [oppSnap, userSnap] = await Promise.all([oppRef.get(), userRef.get()]);
  if (!oppSnap.exists) throw NotFound("Opportunity not found");
  if (!userSnap.exists) throw NotFound("Applicant not found");
  const opp = oppSnap.data() as OpportunityDoc;
  const user = userSnap.data() as UserDoc;

  if (opp.status !== "open") throw BadRequest("This opportunity is no longer accepting applications");
  if (new Date(opp.application_deadline).getTime() < Date.now())
    throw BadRequest("Application deadline has passed");

  // Eligibility — best-effort server-side checks. Athletes are the primary applicant type.
  if (user.dob) {
    const age = Math.floor((Date.now() - new Date(user.dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    if (age < opp.age_min || age > opp.age_max)
      throw BadRequest(`Age eligibility not met (${opp.age_min}-${opp.age_max})`);
  }
  if (
    opp.gender_eligibility !== "all" &&
    user.gender &&
    user.gender !== opp.gender_eligibility
  ) {
    throw BadRequest("Gender eligibility not met");
  }

  // Prevent duplicate application (same applicant + same opportunity).
  const existingSnap = await db
    .collection(Collections.applications)
    .where("opportunity_id", "==", opportunityId)
    .where("applicant_user_id", "==", applicantId)
    .limit(1)
    .get();
  if (!existingSnap.empty) throw Conflict("You have already applied to this opportunity");

  const id = newId();
  const doc: ApplicationDoc = {
    id,
    opportunity_id: opp.id,
    opportunity_title: opp.title,
    org_id: opp.org_id,
    applicant_user_id: applicantId,
    applicant_name: user.full_name,
    cover_note: input.cover_note,
    documents: input.documents ?? [],
    status: "pending",
    history: [{ status: "pending", at: now(), by: applicantId }],
    applied_at: now(),
    updated_at: now()
  };

  await db.runTransaction(async (tx) => {
    tx.set(db.collection(Collections.applications).doc(id), doc);
    tx.update(oppRef, { application_count: FieldValue.increment(1), updated_at: now() });
  });

  // Notify the poster (org owner).
  await createNotification({
    user_id: opp.posted_by_user_id,
    type: "new_application",
    title: "New application received",
    body: `${user.full_name} applied to "${opp.title}".`,
    link: `/opportunities/${opp.id}/applicants`,
    email: true
  });

  return doc;
}

export async function transition(
  appId: string,
  actor: { id: string; role: Role },
  next: ApplicationStatus,
  reason?: string
) {
  const ref = db.collection(Collections.applications).doc(appId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Application not found");
  const app = snap.data() as ApplicationDoc;

  const oppRef = db.collection(Collections.opportunities).doc(app.opportunity_id);
  const oppSnap = await oppRef.get();
  const opp = oppSnap.data() as OpportunityDoc;

  // Authorisation rules:
  //  - withdrawn: only the applicant (or admin) can trigger
  //  - all other states: only the opportunity poster (or admin)
  const isApplicant = actor.id === app.applicant_user_id;
  const isPoster = actor.id === opp.posted_by_user_id;
  const isAdmin = actor.role === "admin";

  if (next === "withdrawn" && !isApplicant && !isAdmin)
    throw Forbidden("Only the applicant can withdraw");
  if (next !== "withdrawn" && !isPoster && !isAdmin)
    throw Forbidden("Only the opportunity poster can change this status");

  if (!transitions[app.status].includes(next))
    throw BadRequest(`Illegal transition from ${app.status} to ${next}`);

  const updatedApp: ApplicationDoc = {
    ...app,
    status: next,
    rejection_reason: next === "rejected" ? reason : app.rejection_reason,
    history: [...app.history, { status: next, at: now(), by: actor.id, reason }],
    updated_at: now()
  };

  await db.runTransaction(async (tx) => {
    tx.update(ref, {
      status: updatedApp.status,
      rejection_reason: updatedApp.rejection_reason,
      history: updatedApp.history,
      updated_at: updatedApp.updated_at
    });
    if (next === "selected" && opp.vacancies) {
      // Decrement remaining vacancies; close when all filled.
      const filled = (opp.vacancies_filled ?? 0) + 1;
      const isFull = filled >= opp.vacancies;
      tx.update(oppRef, {
        vacancies_filled: FieldValue.increment(1),
        status: isFull ? "filled" : opp.status,
        updated_at: now()
      });
    }
    if (next === "withdrawn" && app.status === "selected" && opp.vacancies) {
      tx.update(oppRef, {
        vacancies_filled: FieldValue.increment(-1),
        status: "open",
        updated_at: now()
      });
    }
  });

  // Notifications per SRS Section 3.9
  const notifyMap: Record<string, { title: string; body: string; email: boolean }> = {
    shortlisted: {
      title: "You've been shortlisted",
      body: `Your application for "${app.opportunity_title}" has been shortlisted.`,
      email: true
    },
    selected: {
      title: "You've been selected!",
      body: `Congratulations — you've been selected for "${app.opportunity_title}".`,
      email: true
    },
    rejected: {
      title: "Application update",
      body: `Your application for "${app.opportunity_title}" was not successful.${reason ? " Reason: " + reason : ""}`,
      email: false
    }
  };
  const n = notifyMap[next];
  if (n) {
    await createNotification({
      user_id: app.applicant_user_id,
      type: `application_${next}`,
      title: n.title,
      body: n.body,
      link: `/applications/${app.id}`,
      email: n.email
    });
  }

  return updatedApp;
}

export async function listMyApplications(userId: string, limit = 50) {
  const snap = await db
    .collection(Collections.applications)
    .where("applicant_user_id", "==", userId)
    .orderBy("applied_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as ApplicationDoc);
}

export async function listApplicantsForOpportunity(opportunityId: string, actor: { id: string; role: Role }) {
  const oppSnap = await db.collection(Collections.opportunities).doc(opportunityId).get();
  if (!oppSnap.exists) throw NotFound("Opportunity not found");
  const opp = oppSnap.data() as OpportunityDoc;
  if (opp.posted_by_user_id !== actor.id && actor.role !== "admin")
    throw Forbidden("Only the poster or an admin can view applicants");
  const snap = await db
    .collection(Collections.applications)
    .where("opportunity_id", "==", opportunityId)
    .orderBy("applied_at", "desc")
    .get();
  return snap.docs.map((d) => d.data() as ApplicationDoc);
}

export async function getApplication(appId: string, actor: { id: string; role: Role }) {
  const snap = await db.collection(Collections.applications).doc(appId).get();
  if (!snap.exists) throw NotFound("Application not found");
  const app = snap.data() as ApplicationDoc;

  if (app.applicant_user_id !== actor.id && actor.role !== "admin") {
    const oppSnap = await db.collection(Collections.opportunities).doc(app.opportunity_id).get();
    const opp = oppSnap.data() as OpportunityDoc;
    if (opp.posted_by_user_id !== actor.id) throw Forbidden("Not allowed to view this application");
  }
  return app;
}
