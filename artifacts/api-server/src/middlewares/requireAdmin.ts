import { db, sessionsTable, usersTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

/**
 * Protect administrative APIs with the user's authenticated session and the
 * server-side developer role. No shared secret is shipped inside the app.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const [session] = await db
      .select({
        isDeveloper: usersTable.isDeveloper,
        suspendedAt: usersTable.suspendedAt,
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(
        and(
          eq(sessionsTable.token, token),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session || session.suspendedAt) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    if (!session.isDeveloper) {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: "Unable to verify administrator access" });
  }
}
