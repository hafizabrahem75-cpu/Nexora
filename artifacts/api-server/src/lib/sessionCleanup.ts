import { db, sessionsTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

async function deleteExpiredSessions(): Promise<void> {
  try {
    const deleted = await db
      .delete(sessionsTable)
      .where(lt(sessionsTable.expiresAt, new Date()))
      .returning({ id: sessionsTable.id });

    if (deleted.length > 0) {
      logger.info({ count: deleted.length }, "Expired sessions removed");
    }
  } catch (err) {
    logger.error({ err }, "Session cleanup failed");
  }
}

export function startSessionCleanup(): void {
  void deleteExpiredSessions();
  setInterval(() => void deleteExpiredSessions(), CLEANUP_INTERVAL_MS);
}
