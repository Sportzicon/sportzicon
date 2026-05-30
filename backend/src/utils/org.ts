import type { Organization } from "@prisma/client";

// Transforms a Prisma Organization row into the public API shape.
export function formatOrg(org: Organization) {
  const { verification_status, verification_badges, created_at, updated_at, ...rest } = org;
  return {
    ...rest,
    verification: { status: verification_status, badges: verification_badges },
    created_at: created_at.getTime(),
    updated_at: updated_at.getTime()
  };
}
