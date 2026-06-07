import { db, notificationsTable } from "@workspace/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── GET /notifications — list newest 50 ─────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json({ notifications: items });
  } catch (err) {
    req.log.error(err, "getNotifications failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /notifications/unread-count ──────────────────────────────────────────
router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, req.userId!),
          eq(notificationsTable.read, false),
        ),
      );

    res.json({ count: Number(row?.count ?? 0) });
  } catch (err) {
    req.log.error(err, "getUnreadCount failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /notifications/mark-read ────────────────────────────────────────────
const MarkReadBody = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
]);

router.post("/mark-read", requireAuth, async (req: AuthRequest, res) => {
  const parsed = MarkReadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  try {
    if ("all" in parsed.data && parsed.data.all) {
      await db
        .update(notificationsTable)
        .set({ read: true })
        .where(eq(notificationsTable.userId, req.userId!));
    } else if ("ids" in parsed.data) {
      await db
        .update(notificationsTable)
        .set({ read: true })
        .where(
          and(
            eq(notificationsTable.userId, req.userId!),
            inArray(notificationsTable.id, parsed.data.ids),
          ),
        );
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "markRead failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
