import type { Transition } from "../lib/StateMachine";
import type { ApplicationStatus } from "../types/domain";

/**
 * Defines every legal status transition for an Application.
 * Used by StateMachine<ApplicationStatus> in applications.service.ts.
 *
 * Legend:
 *  Poster can:  pending → shortlisted | rejected
 *               shortlisted → selected | rejected
 *  Applicant:   pending | shortlisted → withdrawn
 *               selected → withdrawn
 *  Selected is the terminal "success" state; rejected/withdrawn are terminal "end" states.
 */
export const APPLICATION_TRANSITIONS: Transition<ApplicationStatus>[] = [
  // Poster actions
  { from: "pending",     to: "shortlisted" },
  { from: "pending",     to: "rejected"    },
  { from: "shortlisted", to: "selected"    },
  { from: "shortlisted", to: "rejected"    },

  // Applicant can withdraw at any non-terminal point
  { from: ["pending", "shortlisted", "selected"], to: "withdrawn" },
];

/** States from which no further transitions are allowed. */
export const APPLICATION_TERMINAL_STATES: ApplicationStatus[] = ["rejected", "withdrawn"];

/** Notification payloads keyed by the state being entered. */
export const APPLICATION_NOTIFICATIONS: Partial<
  Record<ApplicationStatus, { title: string; bodyTemplate: (oppTitle: string, reason?: string) => string; email: boolean }>
> = {
  shortlisted: {
    title: "You've been shortlisted",
    bodyTemplate: (title) => `Your application for "${title}" has been shortlisted.`,
    email: true,
  },
  selected: {
    title: "You've been selected!",
    bodyTemplate: (title) => `Congratulations — you've been selected for "${title}".`,
    email: true,
  },
  rejected: {
    title: "Application update",
    bodyTemplate: (title, reason) =>
      `Your application for "${title}" was not successful.${reason ? " Reason: " + reason : ""}`,
    email: false,
  },
};
