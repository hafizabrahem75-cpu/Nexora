import { db, notesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ─── GET /notes ───────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.userId, req.userId!))
      .orderBy(desc(notesTable.createdAt));
    res.json({ notes: items });
  } catch (err) {
    req.log.error(err, "getNotes failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /notes ──────────────────────────────────────────────────────────────
const CreateBody = z.object({
  content: z.string().min(1).max(10000),
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [note] = await db
      .insert(notesTable)
      .values({ userId: req.userId!, content: parsed.data.content })
      .returning();
    res.status(201).json({ note });
  } catch (err) {
    req.log.error(err, "createNote failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── PATCH /notes/:id ─────────────────────────────────────────────────────────
const UpdateBody = z.object({
  content: z.string().min(1).max(10000),
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [note] = await db
      .update(notesTable)
      .set({ content: parsed.data.content, updatedAt: new Date() })
      .where(and(eq(notesTable.id, req.params.id as string), eq(notesTable.userId, req.userId!)))
      .returning();

    if (!note) {
      res.status(404).json({ error: "الملاحظة غير موجودة" });
      return;
    }
    res.json({ note });
  } catch (err) {
    req.log.error(err, "updateNote failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /notes/:id ────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db
      .delete(notesTable)
      .where(and(eq(notesTable.id, req.params.id as string), eq(notesTable.userId, req.userId!)))
      .returning({ id: notesTable.id });

    if (!deleted) {
      res.status(404).json({ error: "الملاحظة غير موجودة" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "deleteNote failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
