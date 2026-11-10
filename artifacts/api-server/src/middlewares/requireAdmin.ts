import type { NextFunction, Response } from "express";
import { requireAuth, type AuthRequest } from "./requireAuth";

/**
 * Admin access is an additional server-side role check on top of normal
 * authentication. The role is read from the database, never from the client.
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.user?.isDeveloper) {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  });
}
