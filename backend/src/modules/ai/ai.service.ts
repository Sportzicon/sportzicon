import { prisma } from "../../config/prisma";
import { BadRequest, NotFound, TooManyRequests } from "../../utils/errors";
import { getOpenAI, isOpenAIConfigured } from "../../config/openai";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

// In-memory rate limiting — per SRS 3.7.
const MIN_INTERVAL_MS = 30 * 1000;
const DAILY_LIMIT = 20;
const cache = new Map<string, { lastAt: number; countToday: number; resetAt: number }>();

function checkAndRecord(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resetAt = today.getTime() + 24 * 3600 * 1000;
  const c = cache.get(userId) ?? { lastAt: 0, countToday: 0, resetAt };
  if (c.resetAt < Date.now()) { c.countToday = 0; c.resetAt = resetAt; }
  if (Date.now() - c.lastAt < MIN_INTERVAL_MS) throw TooManyRequests("Please wait a few seconds before requesting tips again.");
  if (c.countToday >= DAILY_LIMIT) throw TooManyRequests("Daily tip limit reached. Try again tomorrow.");
  c.lastAt = Date.now();
  c.countToday += 1;
  cache.set(userId, c);
}

export async function getAthleteTips(userId: string) {
  if (!isOpenAIConfigured()) {
    return {
      ok: true,
      source: "stub",
      tips: [
        "Track your training consistency over 6-week blocks — small, regular gains compound.",
        "Pair high-intensity sessions with structured recovery to avoid plateaus.",
        "Capture match stats every week; reviewing trends beats relying on memory.",
        "Add one new technical skill per month and drill it 3x/week for retention.",
        "Sleep 7-9h on training days — recovery is when adaptation happens."
      ]
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, dob: true, athlete_data: true }
  });
  if (!user) throw NotFound("User not found");
  if (user.role !== "athlete") throw BadRequest("Tips are only available for athletes");

  checkAndRecord(userId);

  const d = (user.athlete_data as Record<string, unknown>) ?? {};
  const profileSummary = {
    sport: d.primary_sport,
    position: d.position,
    experience_level: d.experience_level,
    age: user.dob ? Math.floor((Date.now() - new Date(user.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : undefined,
    height_cm: d.height_cm,
    weight_kg: d.weight_kg,
    stats: d.stats ?? {},
    achievements: ((d.achievements as { title: string }[] | undefined) ?? []).slice(0, 5).map((a) => a.title)
  };

  const client = getOpenAI();
  const resp = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.4,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content: "You are a sports performance coach. Given an athlete's profile and stats, return 5 specific, actionable performance and training tips. Output a JSON object with a 'tips' array of short bullet strings, and a 'focus_areas' array (2-3 items). Do not include disclaimers."
      },
      { role: "user", content: JSON.stringify(profileSummary) }
    ],
    response_format: { type: "json_object" }
  });

  let parsed: { tips?: string[]; focus_areas?: string[] } = {};
  try {
    parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
  } catch (err) {
    logger.warn({ err }, "openai response not valid JSON");
  }

  return {
    ok: true,
    source: "openai",
    model: env.OPENAI_MODEL,
    generated_at: Date.now(),
    tips: parsed.tips ?? [],
    focus_areas: parsed.focus_areas ?? []
  };
}
