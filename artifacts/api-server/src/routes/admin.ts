import {
  db,
  conversationParticipantsTable,
  conversationsTable,
  friendshipsTable,
  messagesTable,
  notificationsTable,
  supportSubmissionsTable,
  usersTable,
} from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAdmin } from "../middlewares/requireAdmin";
import { wsManager } from "../lib/wsManager";

const router: IRouter = Router();

router.use(requireAdmin);

// ─── GET /admin/stats ─────────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const [
      [usersRow],
      [friendshipsRow],
      [conversationsRow],
      [messagesRow],
      [supportRow],
    ] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(friendshipsTable),
      db.select({ count: count() }).from(conversationsTable),
      db.select({ count: count() }).from(messagesTable),
      db.select({ count: count() }).from(supportSubmissionsTable),
    ]);

    res.json({
      users: Number(usersRow?.count ?? 0),
      friendships: Number(friendshipsRow?.count ?? 0),
      conversations: Number(conversationsRow?.count ?? 0),
      messages: Number(messagesRow?.count ?? 0),
      supportSubmissions: Number(supportRow?.count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        username: usersTable.username,
        emailVerified: usersTable.emailVerified,
        suspendedAt: usersTable.suspendedAt,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /admin/users/:id/suspend ──────────────────────────────────────────
router.patch("/users/:id/suspend", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    await db
      .update(usersTable)
      .set({ suspendedAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /admin/users/:id/unsuspend ────────────────────────────────────────
router.patch("/users/:id/unsuspend", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    await db
      .update(usersTable)
      .set({ suspendedAt: null, updatedAt: new Date() })
      .where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────
router.delete("/users/:id", async (req, res) => {
  const id = req.params["id"] as string;
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /admin/support ───────────────────────────────────────────────────────
router.get("/support", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);
  const type = req.query["type"] as string | undefined;

  try {
    const base = db
      .select()
      .from(supportSubmissionsTable)
      .orderBy(desc(supportSubmissionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const items = type
      ? await base.where(eq(supportSubmissionsTable.type, type))
      : await base;

    res.json({ submissions: items });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /admin/content/:type/:id ─────────────────────────────────────────
router.delete("/content/:type/:id", async (req, res) => {
  const contentType = req.params["type"] as string;
  const id = req.params["id"] as string;

  try {
    if (contentType === "message") {
      await db.delete(messagesTable).where(eq(messagesTable.id, id));
    } else if (contentType === "support") {
      await db
        .delete(supportSubmissionsTable)
        .where(eq(supportSubmissionsTable.id, id));
    } else {
      res.status(400).json({ error: "Unknown content type" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /admin/announce ─────────────────────────────────────────────────────
const AnnounceBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

router.post("/announce", async (req, res) => {
  const parsed = AnnounceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }

  try {
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);

    if (allUsers.length === 0) {
      res.json({ ok: true, recipients: 0 });
      return;
    }

    const notificationRows = allUsers.map((u) => ({
      userId: u.id,
      type: "announcement" as const,
      title: parsed.data.title,
      body: parsed.data.body,
      data: null,
      read: false,
    }));

    const inserted = await db
      .insert(notificationsTable)
      .values(notificationRows)
      .returning();

    const notifByUser = new Map<string, typeof inserted[0]>();
    for (const n of inserted) {
      notifByUser.set(n.userId, n);
    }

    for (const u of allUsers) {
      const notif = notifByUser.get(u.id);
      if (notif) {
        wsManager.send(u.id, { type: "notification", payload: notif });
      }
    }

    res.json({ ok: true, recipients: allUsers.length });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
