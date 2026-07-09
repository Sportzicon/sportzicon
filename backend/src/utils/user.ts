import type { User } from "@prisma/client";

export const safeUserSelect = {
  id: true,
  email: true,
  email_verified: true,
  phone: true,
  full_name: true,
  role: true,
  status: true,
  bio: true,
  profile_photo_url: true,
  cover_photo_url: true,
  country: true,
  state: true,
  city: true,
  dob: true,
  gender: true,
  verification_status: true,
  verification_badges: true,
  is_minor: true,
  guardian_consent_status: true,
  guardian_consent_at: true,
  athlete_data: true,
  coach_data: true,
  created_at: true,
  updated_at: true,
  last_active_at: true,
} as const;

// Transforms a Prisma User row into the public API shape the frontend expects:
//   - strips internal DB fields
//   - renames athlete_data → athlete, coach_data → coach
//   - converts flat verification_status/badges → nested verification object
//   - converts Date objects to epoch ms numbers
//   - never leaks guardian_email unless the caller opts in (self or admin viewer)
export function omitSensitive(user: User, opts: { includeGuardianEmail?: boolean } = {}) {
  const {
    password_hash: _password_hash, email_lower: _email_lower, full_name_lower: _full_name_lower,
    athlete_data, coach_data, guardian_email,
    verification_status, verification_badges,
    created_at, updated_at, last_active_at,
    ...rest
  } = user;

  return {
    ...rest,
    ...(opts.includeGuardianEmail && guardian_email ? { guardian_email } : {}),
    athlete: athlete_data ?? undefined,
    coach: coach_data ?? undefined,
    verification: { status: verification_status, badges: verification_badges },
    created_at: created_at.getTime(),
    updated_at: updated_at.getTime(),
    last_active_at: last_active_at.getTime()
  };
}
