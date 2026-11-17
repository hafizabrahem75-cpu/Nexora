import { createHash } from "node:crypto";

/**
 * Store only a one-way SHA-256 digest of high-entropy session tokens.
 * The raw token is returned once to the client and is never persisted.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
