import { logger } from "./logger";

/**
 * Development-only email adapter.
 * Never write verification or password-reset tokens/links to application logs.
 * Production delivery must be supplied by a configured email provider.
 */
export async function sendPasswordResetEmail(_email: string, _token: string): Promise<void> {
  logger.warn(
    "[DEV] Password reset email was not sent; configure a production email provider",
  );
}

export async function sendVerificationEmail(_email: string, _token: string): Promise<void> {
  logger.warn(
    "[DEV] Verification email was not sent; configure a production email provider",
  );
}
