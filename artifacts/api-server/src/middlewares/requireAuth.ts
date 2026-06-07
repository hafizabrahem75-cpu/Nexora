import {
  db,
  sessionsTable,
  usersTable,
  type PublicUser,
} from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
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

  try {
    const [row] = await db
      .select({
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
          suspendedAt: usersTable.suspendedAt,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        },
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

    if (!row) {
      res
        .status(401)
        .json({ error: "الجلسة منتهية الصلاحية — يرجى تسجيل الدخول مجدداً" });
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
