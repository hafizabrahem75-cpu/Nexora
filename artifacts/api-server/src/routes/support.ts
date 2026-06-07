import { db, supportSubmissionsTable } from "@workspace/db";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SubmitBody = z.object({
  type: z.enum(["report", "help", "feature", "feedback"]),
  content: z.string().min(1).max(5000),
  screenshotUri: z.string().nullable().optional(),
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }

  try {
    await db.insert(supportSubmissionsTable).values({
      userId: req.userId!,
      username: req.user?.username ?? null,
      email: req.user?.email ?? "",
      type: parsed.data.type,
      content: parsed.data.content,
      screenshotUri: parsed.data.screenshotUri ?? null,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error(err, "support submission failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
