import { logger } from "./logger";

/**
 * Dev-mode email stub — logs links to the console instead of sending real emails.
 * Replace the body of each function with nodemailer / Resend / SendGrid in production.
 */

function devWebUrl(path: string, token: string): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  return domain
    ? `https://${domain}/${path}?token=${token}`
    : `http://localhost:8080/${path}?token=${token}`;
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  logger.info(
    {
      email,
      webUrl: devWebUrl("forgot-password", token),
      nativeLink: `mobile://reset-password?token=${token}`,
    },
    "[DEV] Password reset email (not sent in dev — open webUrl in browser)",
  );
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  logger.info(
    {
      email,
      webUrl: devWebUrl("verify-email", token),
      nativeLink: `mobile://verify-email?token=${token}`,
    },
    "[DEV] Email verification (not sent in dev — open webUrl in browser)",
  );
}
