import { logger } from "./logger";

/**
 * Dev-mode email stub — logs links to the console instead of sending real emails.
 * Replace the body of each function with nodemailer / Resend / SendGrid in production.
 */

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const deepLink = `nexora://reset-password?token=${token}`;
  logger.info(
    { email, deepLink },
    "[DEV] Password reset email (not sent in dev — use the link above)",
  );
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const deepLink = `nexora://verify-email?token=${token}`;
  logger.info(
    { email, deepLink },
    "[DEV] Email verification (not sent in dev — use the link above)",
  );
}
