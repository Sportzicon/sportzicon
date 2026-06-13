import type { User } from "@prisma/client";

// Transforms a Prisma User row into the public API shape the frontend expects:
//   - strips internal DB fields
//   - renames athlete_data → athlete, coach_data → coach
//   - converts flat verification_status/badges → nested verification object
//   - converts Date objects to epoch ms numbers
export function omitSensitive(user: User) {
  const {
    password_hash: _password_hash, email_lower: _email_lower, full_name_lower: _full_name_lower,
    athlete_data, coach_data,
    verification_status, verification_badges,
    created_at, updated_at, last_active_at,
    ...rest
  } = user;

  return {
    ...rest,
    athlete: athlete_data ?? undefined,
    coach: coach_data ?? undefined,
    verification: { status: verification_status, badges: verification_badges },
    created_at: created_at.getTime(),
    updated_at: updated_at.getTime(),
    last_active_at: last_active_at.getTime()
  };
}
