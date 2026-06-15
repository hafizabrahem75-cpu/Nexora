import { db, tasksTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── GET /tasks ───────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.userId, req.userId!))
      .orderBy(desc(tasksTable.createdAt));
    res.json({ tasks: items });
  } catch (err) {
    req.log.error(err, "getTasks failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /tasks ──────────────────────────────────────────────────────────────
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
    const [task] = await db
      .insert(tasksTable)
      .values({
        userId: req.userId!,
        title: parsed.data.title,
        reminderAt: parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null,
      })
      .returning();
    res.status(201).json({ task });
  } catch (err) {
    req.log.error(err, "createTask failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── PATCH /tasks/:id ─────────────────────────────────────────────────────────
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

    const [task] = await db
      .update(tasksTable)
      .set(updates)
      .where(and(eq(tasksTable.id, req.params.id as string), eq(tasksTable.userId, req.userId!)))
      .returning();

    if (!task) {
      res.status(404).json({ error: "المهمة غير موجودة" });
      return;
    }
    res.json({ task });
  } catch (err) {
    req.log.error(err, "updateTask failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db
      .delete(tasksTable)
      .where(and(eq(tasksTable.id, req.params.id as string), eq(tasksTable.userId, req.userId!)))
      .returning({ id: tasksTable.id });

    if (!deleted) {
      res.status(404).json({ error: "المهمة غير موجودة" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "deleteTask failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
