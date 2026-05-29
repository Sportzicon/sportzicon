import nodemailer from "nodemailer";
import { env, isTest } from "./env";
import { logger } from "./logger";

const transporter =
  env.BREVO_SMTP_USER && env.BREVO_SMTP_KEY
    ? nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
          user: env.BREVO_SMTP_USER,
          pass: env.BREVO_SMTP_KEY
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
    // Dev fallback: log the email so verification flow works without SMTP credentials.
    logger.info({ to: input.to, subject: input.subject }, "[email-stub] would send email");
    logger.debug({ html: input.html }, "[email-stub] body");
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, "")
    });
  } catch (err) {
    // Reliability: never let mail failures break the request.
    logger.error({ err, to: input.to, subject: input.subject }, "sendMail failed");
  }
}

// In-memory mailbox used by tests so we can assert what got sent.
export const testMailbox: SendMailInput[] = [];
export function clearTestMailbox() { testMailbox.length = 0; }
