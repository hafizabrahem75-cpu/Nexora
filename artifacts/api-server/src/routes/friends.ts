import {
  db,
  friendRequestsTable,
  friendshipsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";
import { wsManager } from "../lib/wsManager";

const router: IRouter = Router();

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const [u1, u2] = sortedPair(a, b);
  const [row] = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.userId1, u1),
        eq(friendshipsTable.userId2, u2),
      ),
    )
    .limit(1);
  return !!row;
}

function safeUser(u: { id: string; name: string; username: string | null; avatarColor: string; avatarImageUri: string | null }) {
  return { id: u.id, name: u.name, username: u.username, avatarColor: u.avatarColor, avatarImageUri: u.avatarImageUri };
}

// ─── GET /friends — list friends ──────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const rows = await db
      .select({
        id: friendshipsTable.id,
        userId1: friendshipsTable.userId1,
        userId2: friendshipsTable.userId2,
        createdAt: friendshipsTable.createdAt,
      })
      .from(friendshipsTable)
      .where(
        or(
          eq(friendshipsTable.userId1, userId),
          eq(friendshipsTable.userId2, userId),
        ),
      );

    if (rows.length === 0) {
      res.json({ friends: [] });
      return;
    }

    const friendIds = rows.map((r) =>
      r.userId1 === userId ? r.userId2 : r.userId1,
    );

    const friendUsers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        avatarColor: usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, friendIds));

    res.json({ friends: friendUsers.map(safeUser) });
  } catch (err) {
    req.log.error(err, "getFriends failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /friends/requests — incoming + outgoing ──────────────────────────────
router.get("/requests", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const requests = await db
      .select({
        id: friendRequestsTable.id,
        senderId: friendRequestsTable.senderId,
        receiverId: friendRequestsTable.receiverId,
        status: friendRequestsTable.status,
        createdAt: friendRequestsTable.createdAt,
      })
      .from(friendRequestsTable)
      .where(
        and(
          or(
            eq(friendRequestsTable.senderId, userId),
            eq(friendRequestsTable.receiverId, userId),
          ),
          eq(friendRequestsTable.status, "pending"),
        ),
      );

    if (requests.length === 0) {
      res.json({ incoming: [], outgoing: [] });
      return;
    }

    const allUserIds = [...new Set(requests.flatMap((r) => [r.senderId, r.receiverId]))];
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        avatarColor: usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, allUserIds));

    const userMap = new Map(users.map((u) => [u.id, u]));

    const incoming = requests
      .filter((r) => r.receiverId === userId)
      .map((r) => ({ ...r, sender: safeUser(userMap.get(r.senderId)!) }));

    const outgoing = requests
      .filter((r) => r.senderId === userId)
      .map((r) => ({ ...r, receiver: safeUser(userMap.get(r.receiverId)!) }));

    res.json({ incoming, outgoing });
  } catch (err) {
    req.log.error(err, "getFriendRequests failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /friends/request — send request ─────────────────────────────────────
const SendRequestBody = z.object({ receiverId: z.string().uuid() });

router.post("/request", requireAuth, async (req: AuthRequest, res) => {
  const parsed = SendRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const senderId = req.userId!;
  const { receiverId } = parsed.data;

  if (senderId === receiverId) {
    res.status(400).json({ error: "لا يمكنك إضافة نفسك" });
    return;
  }

  try {
    if (await areFriends(senderId, receiverId)) {
      res.status(409).json({ error: "أنتما أصدقاء بالفعل" });
      return;
    }

    const [existing] = await db
      .select({ id: friendRequestsTable.id })
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.senderId, senderId),
          eq(friendRequestsTable.receiverId, receiverId),
          eq(friendRequestsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "طلب الصداقة مرسل بالفعل" });
      return;
    }

    const [request] = await db
      .insert(friendRequestsTable)
      .values({ senderId, receiverId })
      .returning();

    wsManager.send(receiverId, { type: "friend_request", payload: { request } });

    const senderName = req.user?.name ?? req.user?.username ?? "مستخدم";
    wsManager.notifyFriendRequest({
      recipientId: receiverId,
      senderName,
      requestId: request!.id,
    });

    res.status(201).json({ request });
  } catch (err) {
    req.log.error(err, "sendFriendRequest failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /friends/accept/:requestId ─────────────────────────────────────────
router.post("/accept/:requestId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const requestId = req.params["requestId"] as string;

  try {
    const [request] = await db
      .select()
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.id, requestId),
          eq(friendRequestsTable.receiverId, userId),
          eq(friendRequestsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    await db
      .update(friendRequestsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendRequestsTable.id, requestId));

    const [u1, u2] = sortedPair(request.senderId, request.receiverId);
    await db.insert(friendshipsTable).values({ userId1: u1, userId2: u2 });

    wsManager.send(request.senderId, {
      type: "friend_accepted",
      payload: { requestId, friendId: userId },
    });

    const acceptorName = req.user?.name ?? req.user?.username ?? "مستخدم";
    wsManager.notifyFriendAccepted({
      recipientId: request.senderId,
      acceptorName,
      friendId: userId,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "acceptFriendRequest failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /friends/reject/:requestId ─────────────────────────────────────────
router.post("/reject/:requestId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const requestId = req.params["requestId"] as string;

  try {
    const [request] = await db
      .select({ id: friendRequestsTable.id })
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.id, requestId),
          eq(friendRequestsTable.receiverId, userId),
          eq(friendRequestsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    await db
      .update(friendRequestsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(friendRequestsTable.id, requestId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "rejectFriendRequest failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /friends/request/:requestId — cancel outgoing ─────────────────────
router.delete("/request/:requestId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const requestId = req.params["requestId"] as string;

  try {
    const [request] = await db
      .select({ id: friendRequestsTable.id })
      .from(friendRequestsTable)
      .where(
        and(
          eq(friendRequestsTable.id, requestId),
          eq(friendRequestsTable.senderId, userId),
          eq(friendRequestsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    await db
      .delete(friendRequestsTable)
      .where(eq(friendRequestsTable.id, requestId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "cancelFriendRequest failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /friends/:friendId — remove friend ────────────────────────────────
router.delete("/:friendId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const friendId = req.params["friendId"] as string;
  const [u1, u2] = sortedPair(userId, friendId);

  try {
    await db
      .delete(friendshipsTable)
      .where(
        and(
          eq(friendshipsTable.userId1, u1),
          eq(friendshipsTable.userId2, u2),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "removeFriend failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
