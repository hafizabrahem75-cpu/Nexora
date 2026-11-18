import { NextFunction, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "./requireAuth";

/**
 * Fail-closed owner-only administration.
 * The owner account ID is deployment configuration, never accepted from a client.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req as AuthRequest, res, () => {
    const authReq = req as AuthRequest;
    const ownerUserId = process.env.NEXORA_OWNER_USER_ID?.trim();

    if (!ownerUserId || !authReq.user?.isDeveloper || authReq.userId !== ownerUserId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  });
}
