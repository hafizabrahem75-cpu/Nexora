import { logger } from "./logger";

/**
 * No paid email integration is configured yet.
 * Development may log one-time links for local testing only.
 * Production fails closed: never write verification/reset secrets to logs.
 */
function devWebUrl(path: string, token: string): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  return domain
    ? `https://${domain}/${path}?token=${token}`
    : `http://localhost:8080/${path}?token=${token}`;
}

function assertDevelopmentOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email provider is not configured; refusing to expose account tokens");
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  assertDevelopmentOnly();
  logger.info(
    {
      email,
      webUrl: devWebUrl("forgot-password", token),
      nativeLink: `mobile://reset-password?token=${token}`,
    },
    "[DEV ONLY] Password reset link; not delivered by email",
  );
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  assertDevelopmentOnly();
  logger.info(
    {
      email,
      webUrl: devWebUrl("verify-email", token),
      nativeLink: `mobile://verify-email?token=${token}`,
    },
    "[DEV ONLY] Email verification link; not delivered by email",
  );
}
