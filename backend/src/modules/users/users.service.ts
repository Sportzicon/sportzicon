import { prisma } from "../../config/prisma";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../utils/errors";
import { omitSensitive } from "../../utils/user";
import { validateAthleteSportProfile } from "./sportProfile";

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: { select: { followers: true, following: true } }
    }
  });
  if (!user) throw NotFound("User not found");
  const { _count, ...rest } = user;
  return omitSensitive({
    ...rest,
    follower_count: _count.followers,
    following_count: _count.following
  });
}

export async function updateProfile(userId: string, patch: Record<string, unknown>) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw NotFound("User not found");

  // Duplicate phone check — exclude the current user's own record
  if (patch.phone !== undefined && patch.phone !== null && patch.phone !== "") {
    const phoneConflict = await prisma.user.findFirst({
      where: { phone: String(patch.phone), NOT: { id: userId } },
      select: { id: true }
    });
    if (phoneConflict) throw Conflict("This mobile number is already registered to another account");
  }

  const data: Record<string, unknown> = {};
  const allowed = [
    "bio", "profile_photo_url", "cover_photo_url", "country", "state", "city",
    "dob", "gender", "preferred_language", "phone"
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (patch.full_name) {
    data.full_name = patch.full_name;
    data.full_name_lower = String(patch.full_name).toLowerCase();
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return omitSensitive(updated);
}

export async function updateAthleteFields(userId: string, fields: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound("User not found");
  if (user.role !== "athlete") throw Forbidden("Only athletes can update athlete fields");

  const existing = (user.athlete_data as Record<string, unknown>) ?? {};
  const merged = { ...existing, ...fields };
  const violations = validateAthleteSportProfile(merged);
  if (violations.length) throw BadRequest(violations.join(" "));
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { athlete_data: merged as object }
  });
  return omitSensitive(updated);
}

export async function updateCoachFields(userId: string, fields: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound("User not found");
  if (user.role !== "scout" && user.role !== "organizer")
    throw Forbidden("Only scouts/organizers can update coach fields");

  const existing = (user.coach_data as Record<string, unknown>) ?? {};
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { coach_data: { ...existing, ...fields } as object }
  });
  return omitSensitive(updated);
}
