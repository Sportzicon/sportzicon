import { env, isTest } from "./env";
import { logger } from "./logger";

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
  if (!env.BREVO_API_KEY) {
    logger.info({ to: input.to, subject: input.subject }, "[email-stub] would send email");
    logger.debug({ html: input.html }, "[email-stub] body");
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text ?? input.html.replace(/<[^>]+>/g, "")
      })
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body, to: input.to }, "sendMail failed");
    }
  } catch (err) {
    logger.error({ err, to: input.to, subject: input.subject }, "sendMail failed");
  }
}

// In-memory mailbox used by tests so we can assert what got sent.
export const testMailbox: SendMailInput[] = [];
export function clearTestMailbox() { testMailbox.length = 0; }
