import { createHash, randomBytes } from "node:crypto";

/** Create a high-entropy opaque bearer token. Return the raw value only once. */
export function createOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

/** Store only this one-way digest; never persist the bearer token itself. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
