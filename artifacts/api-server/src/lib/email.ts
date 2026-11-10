import { logger } from "./logger";

/**
 * Development-only email adapter.
 * Production delivery must be supplied by a configured email provider.
 */
function publicLink(path: string, token: string): string {
  const baseUrl = (process.env["PUBLIC_APP_URL"] ?? process.env["PUBLIC_WEB_URL"] ?? "http://localhost:8080")
    .replace(/\/+$/, "");
  return `${baseUrl}/${path}?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  logger.info(
    {
      email,
      webUrl: publicLink("reset-password", token),
      nativeLink: `nexora://reset-password?token=${encodeURIComponent(token)}`,
    },
    "[DEV] Password reset email not sent; configure a production email provider",
  );
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  logger.info(
    {
      email,
      webUrl: publicLink("verify-email", token),
      nativeLink: `nexora://verify-email?token=${encodeURIComponent(token)}`,
    },
    "[DEV] Verification email not sent; configure a production email provider",
  );
}
