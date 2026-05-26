import sgMail from "@sendgrid/mail";
import { env, isTest } from "./env";
import { logger } from "./logger";

let configured = false;
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
  configured = true;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(input: SendMailInput): Promise<void> {
  if (isTest) {
    // In tests, surface the email through the test mailbox instead of hitting SendGrid.
    testMailbox.push(input);
    return;
  }
  if (!configured) {
    // Dev fallback: log the email so the verification flow still works without a SendGrid key.
    logger.info({ to: input.to, subject: input.subject }, "[email-stub] would send email");
    logger.debug({ html: input.html }, "[email-stub] body");
    return;
  }
  try {
    await sgMail.send({
      to: input.to,
      from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, "")
    });
  } catch (err) {
    // Reliability: never let mail failures break the request — caller decides retry policy.
    logger.error({ err, to: input.to, subject: input.subject }, "sendMail failed");
  }
}

// In-memory mailbox used by tests so we can assert what got sent.
export const testMailbox: SendMailInput[] = [];
export function clearTestMailbox() { testMailbox.length = 0; }
