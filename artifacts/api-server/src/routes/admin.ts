import {
  db,
  conversationParticipantsTable,
  conversationsTable,
  friendshipsTable,
  goalsTable,
  messagesTable,
  notesTable,
  notificationsTable,
  supportSubmissionsTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";
import type { Request } from "express";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAdmin } from "../middlewares/requireAdmin";
import { wsManager } from "../lib/wsManager";

const router: IRouter = Router();

const MAX_ADMIN_PAGE_SIZE = 200;

function parseAdminPagination(req: Request): { limit: number; offset: number } | null {
  const rawLimit = req.query["limit"] ?? "50";
  const rawOffset = req.query["offset"] ?? "0";
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ADMIN_PAGE_SIZE) return null;
  if (!Number.isSafeInteger(offset) || offset < 0) return null;
  return { limit, offset };
}

function isProtectedOwnerTarget(id: string): boolean {
  const ownerId = process.env.NEXORA_OWNER_USER_ID?.trim();
  return !!ownerId && id === ownerId;
}

router.use(requireAdmin);

// ─── GET /admin/stats ─────────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const [
      [usersRow],
      [tasksRow],
      [goalsRow],
      [notesRow],
      [conversationsRow],
      [friendshipsRow],
      [messagesRow],
      [supportRow],
    ] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(tasksTable),
      db.select({ count: count() }).from(goalsTable),
      db.select({ count: count() }).from(notesTable),
      db.select({ count: count() }).from(conversationsTable),
      db.select({ count: count() }).from(friendshipsTable),
      db.select({ count: count() }).from(messagesTable),
      db.select({ count: count() }).from(supportSubmissionsTable),
    ]);

    res.json({
      users: Number(usersRow?.count ?? 0),
      tasks: Number(tasksRow?.count ?? 0),
      goals: Number(goalsRow?.count ?? 0),
      notes: Number(notesRow?.count ?? 0),
      conversations: Number(conversationsRow?.count ?? 0),
      friendships: Number(friendshipsRow?.count ?? 0),
      messages: Number(messagesRow?.count ?? 0),
      supportSubmissions: Number(supportRow?.count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  const page = parseAdminPagination(req);
  if (!page) {
    res.status(400).json({ error: "Invalid pagination parameters" });
    return;
  }
  const { limit, offset } = page;

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
  if (isProtectedOwnerTarget(id)) {
    res.status(403).json({ error: "The configured owner account is protected" });
    return;
  }
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
  if (isProtectedOwnerTarget(id)) {
    res.status(403).json({ error: "The configured owner account is protected" });
    return;
  }
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
  if (isProtectedOwnerTarget(id)) {
    res.status(403).json({ error: "The configured owner account is protected" });
    return;
  }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /admin/support ───────────────────────────────────────────────────────
router.get("/support", async (req, res) => {
  const page = parseAdminPagination(req);
  if (!page) {
    res.status(400).json({ error: "Invalid pagination parameters" });
    return;
  }
  const { limit, offset } = page;
  const rawType = req.query["type"];
  const allowedTypes = new Set(["report", "help", "feature", "feedback"]);
  if (rawType !== undefined && (typeof rawType !== "string" || !allowedTypes.has(rawType))) {
    res.status(400).json({ error: "Invalid support type" });
    return;
  }
  const type = rawType as string | undefined;

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
