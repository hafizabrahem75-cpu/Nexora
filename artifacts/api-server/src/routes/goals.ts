import { db, goalsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── GET /goals ───────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, req.userId!))
      .orderBy(desc(goalsTable.createdAt));
    res.json({ goals: items });
  } catch (err) {
    req.log.error(err, "getGoals failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /goals ──────────────────────────────────────────────────────────────
const CreateBody = z.object({
  title: z.string().min(1).max(500),
  reminderAt: z.string().nullable().optional(),
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [goal] = await db
      .insert(goalsTable)
      .values({
        userId: req.userId!,
        title: parsed.data.title,
        reminderAt: parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null,
      })
      .returning();
    res.status(201).json({ goal });
  } catch (err) {
    req.log.error(err, "createGoal failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── PATCH /goals/:id ─────────────────────────────────────────────────────────
const UpdateBody = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  reminderAt: z.string().nullable().optional(),
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.completed !== undefined) updates.completed = parsed.data.completed;
    if ("reminderAt" in parsed.data) {
      updates.reminderAt = parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null;
    }

    const [goal] = await db
      .update(goalsTable)
      .set(updates)
      .where(and(eq(goalsTable.id, req.params.id as string), eq(goalsTable.userId, req.userId!)))
      .returning();

    if (!goal) {
      res.status(404).json({ error: "الهدف غير موجود" });
      return;
    }
    res.json({ goal });
  } catch (err) {
    req.log.error(err, "updateGoal failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /goals/:id ────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db
      .delete(goalsTable)
      .where(and(eq(goalsTable.id, req.params.id as string), eq(goalsTable.userId, req.userId!)))
      .returning({ id: goalsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "الهدف غير موجود" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "deleteGoal failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
