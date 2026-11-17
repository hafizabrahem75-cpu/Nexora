import { NextFunction, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "./requireAuth";

/**
 * Admin access is tied to an authenticated account with the server-side
 * isDeveloper flag. No shared admin secret is shipped in the mobile client.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req as AuthRequest, res, () => {
    const authReq = req as AuthRequest;
    if (!authReq.user?.isDeveloper) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}
