import nodemailer from "nodemailer";
import { env, isTest } from "./env";
import { logger } from "./logger";
import { prisma } from "./prisma";
import type { EmailType } from "@prisma/client";

const transporter =
  env.GMAIL_USER && env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD
        }
      })
    : null;

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
  if (!transporter) {
    logger.info({ to: input.to, subject: input.subject }, "[email-stub] would send email");
    logger.debug({ html: input.html }, "[email-stub] body");
    await writeLog(input, "stub");
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.GMAIL_USER}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, "")
    });
    await writeLog(input, "sent");
  } catch (err: any) {
    logger.error({ err, to: input.to, subject: input.subject }, "sendMail failed");
    await writeLog(input, "failed", String(err?.message ?? err));
    throw err;
  }
}

// In-memory mailbox used by tests so we can assert what got sent.
export const testMailbox: SendMailInput[] = [];
export function clearTestMailbox() { testMailbox.length = 0; }
