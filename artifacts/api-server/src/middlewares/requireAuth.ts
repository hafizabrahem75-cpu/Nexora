import {
  db,
  sessionsTable,
  usersTable,
  type PublicUser,
} from "@workspace/db";
import { and, eq, gt, or } from "drizzle-orm";
import { hashOpaqueToken } from "../lib/tokens";
import { NextFunction, Request, Response } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  user?: PublicUser;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح — يرجى تسجيل الدخول" });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length > 512) {
    res.status(401).json({ error: "غير مصرح — يرجى تسجيل الدخول" });
    return;
  }
  const tokenHash = hashOpaqueToken(token);

  try {
    const [row] = await db
      .select({
        sessionId: sessionsTable.id,
        storedToken: sessionsTable.token,
        userId: sessionsTable.userId,
        user: {
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          username: usersTable.username,
          avatarColor: usersTable.avatarColor,
          avatarImageUri: usersTable.avatarImageUri,
          emailVerified: usersTable.emailVerified,
          profileVisibility: usersTable.profileVisibility,
          messagingPrivacy: usersTable.messagingPrivacy,
          isDeveloper: usersTable.isDeveloper,
          suspendedAt: usersTable.suspendedAt,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        },
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(
        and(
          or(eq(sessionsTable.token, tokenHash), eq(sessionsTable.token, token)),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      res
        .status(401)
        .json({ error: "الجلسة منتهية الصلاحية — يرجى تسجيل الدخول مجدداً" });
      return;
    }

    // Opportunistically upgrade legacy plaintext sessions after successful lookup.
    if (row.storedToken !== tokenHash) {
      await db.update(sessionsTable)
        .set({ token: tokenHash })
        .where(and(eq(sessionsTable.id, row.sessionId), eq(sessionsTable.token, row.storedToken)));
    }

    if (row.user.suspendedAt) {
      res.status(403).json({ error: "account_suspended" });
      return;
    }

    req.userId = row.userId;
    req.user = row.user as PublicUser;
    next();
  } catch (err) {
    req.log.error(err, "requireAuth: DB lookup failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
}
