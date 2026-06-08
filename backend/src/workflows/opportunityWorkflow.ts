import type { Transition } from "../lib/StateMachine";
import type { OpportunityStatus } from "../types/domain";

/**
 * Defines every legal status transition for an Opportunity.
 * Used by StateMachine<OpportunityStatus> when vacancies fill or deadline passes.
 *
 * open   → filled   (all vacancies selected)
 * open   → closed   (deadline passed or manual close)
 * filled → open     (a selected applicant withdraws, freeing a vacancy)
 * closed → open     (deadline extended / manually re-opened — admin only)
 */
export const OPPORTUNITY_TRANSITIONS: Transition<OpportunityStatus>[] = [
  { from: "open",   to: "filled" },
  { from: "open",   to: "closed" },
  { from: "filled", to: "open"   },
  { from: "closed", to: "open"   },
];

/** States that are effectively permanent without admin action. */
export const OPPORTUNITY_TERMINAL_STATES: OpportunityStatus[] = ["closed"];
