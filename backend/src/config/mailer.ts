import { Resend } from "resend";
import { env, isTest } from "./env";
import { logger } from "./logger";
import { prisma } from "./prisma";
import type { EmailType } from "@prisma/client";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

if (!resend && !isTest) {
  logger.warn(
    "RESEND_API_KEY is not set — running in email stub mode. Verification, password-reset, " +
      "and notification emails will be logged but NOT delivered to real inboxes."
  );
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  user_id?: string;
  email_type?: EmailType;
};

async function writeLog(
  input: SendMailInput,
  status: "sent" | "failed" | "stub",
  error?: string
) {
  try {
    await prisma.emailLog.create({
      data: {
        user_id: input.user_id ?? null,
        to_email: input.to,
        subject: input.subject,
        email_type: input.email_type ?? "other",
        status,
        error: error ?? null
      }
    });
  } catch (err) {
    logger.warn({ err }, "emailLog write failed");
  }
}

export async function sendMail(input: SendMailInput): Promise<void> {
  if (isTest) {
    testMailbox.push(input);
    return;
  }
  if (!resend) {
    logger.info({ to: input.to, subject: input.subject }, "[email-stub] would send email");
    logger.debug({ html: input.html }, "[email-stub] body");
    await writeLog(input, "stub");
    return;
  }
  const attempts = 2; // one retry on transient failure (network blip, provider hiccup)
  let lastErr: any;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? input.html.replace(/<[^>]+>/g, "")
      });
      if (error) throw new Error(`${error.name ?? "ResendError"}: ${error.message}`);
      await writeLog(input, "sent");
      return;
    } catch (err: any) {
      lastErr = err;
      if (attempt < attempts) {
        logger.warn({ err, to: input.to, subject: input.subject, attempt }, "sendMail attempt failed, retrying");
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  logger.error({ err: lastErr, to: input.to, subject: input.subject }, "sendMail failed");
  await writeLog(input, "failed", String(lastErr?.message ?? lastErr));
  throw lastErr;
}

export const testMailbox: SendMailInput[] = [];
export function clearTestMailbox() { testMailbox.length = 0; }
