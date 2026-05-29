import nodemailer from "nodemailer";
import { env, isTest } from "./env";
import { logger } from "./logger";

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
};

export async function sendMail(input: SendMailInput): Promise<void> {
  if (isTest) {
    testMailbox.push(input);
    return;
  }
  if (!transporter) {
    logger.info({ to: input.to, subject: input.subject }, "[email-stub] would send email");
    logger.debug({ html: input.html }, "[email-stub] body");
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
  } catch (err) {
    logger.error({ err, to: input.to, subject: input.subject }, "sendMail failed");
  }
}

// In-memory mailbox used by tests so we can assert what got sent.
export const testMailbox: SendMailInput[] = [];
export function clearTestMailbox() { testMailbox.length = 0; }
