import { NextFunction, Request, Response } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["DEVELOPER_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }

  const provided = req.headers["x-admin-secret"];
  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
