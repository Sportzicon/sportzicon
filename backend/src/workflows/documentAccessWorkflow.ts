import type { Transition } from "../lib/StateMachine";
import type { DocAccessStatus } from "@prisma/client";

/**
 * Defines every legal status transition for a DocumentAccessRequest.
 * Used by StateMachine<DocAccessStatus> in documentAccess.service.ts.
 *
 * Legend:
 *  Athlete/admin can: pending → approved | rejected
 *                      approved → revoked
 *  Requester can re-request after a decision by re-entering "pending"
 *  from either terminal-ish state (handled as a transition, not a dead end).
 */
export const DOC_ACCESS_TRANSITIONS: Transition<DocAccessStatus>[] = [
  { from: "pending", to: "approved" },
  { from: "pending", to: "rejected" },
  { from: "approved", to: "revoked" },

  // Requester re-requesting access after rejection/revocation
  { from: ["rejected", "revoked"], to: "pending" },
];
