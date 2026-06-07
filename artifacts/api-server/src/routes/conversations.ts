import {
  db,
  conversationParticipantsTable,
  conversationsTable,
  friendshipsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
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
      and(eq(friendshipsTable.userId1, u1), eq(friendshipsTable.userId2, u2)),
    )
    .limit(1);
  return !!row;
}

// ─── GET /conversations — list all conversations ───────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  try {
    const participations = await db
      .select({
        conversationId: conversationParticipantsTable.conversationId,
        lastReadAt: conversationParticipantsTable.lastReadAt,
      })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.userId, userId));

    if (participations.length === 0) {
      res.json({ conversations: [] });
      return;
    }

    const convIds = participations.map((p) => p.conversationId);

    const [otherParticipants, recentMessages] = await Promise.all([
      db
        .select({
          conversationId: conversationParticipantsTable.conversationId,
          id: usersTable.id,
          name: usersTable.name,
          username: usersTable.username,
          avatarColor: usersTable.avatarColor,
          avatarImageUri: usersTable.avatarImageUri,
        })
        .from(conversationParticipantsTable)
        .innerJoin(
          usersTable,
          eq(conversationParticipantsTable.userId, usersTable.id),
        )
        .where(
          and(
            inArray(conversationParticipantsTable.conversationId, convIds),
            or(
              ...convIds.map((id) =>
                and(
                  eq(conversationParticipantsTable.conversationId, id),
                  eq(conversationParticipantsTable.userId, userId),
                ),
              ),
            )
              ? undefined
              : undefined,
          ),
        )
        .then((rows) => rows.filter((r) => r.id !== userId)),

      db
        .select()
        .from(messagesTable)
        .where(inArray(messagesTable.conversationId, convIds))
        .orderBy(desc(messagesTable.createdAt))
        .limit(500),
    ]);

    const otherUserByConv = new Map<string, (typeof otherParticipants)[0]>();
    for (const p of otherParticipants) {
      if (!otherUserByConv.has(p.conversationId)) {
        otherUserByConv.set(p.conversationId, p);
      }
    }

    const lastMsgByConv = new Map<string, (typeof recentMessages)[0]>();
    for (const msg of recentMessages) {
      if (!lastMsgByConv.has(msg.conversationId)) {
        lastMsgByConv.set(msg.conversationId, msg);
      }
    }

    const participationByConv = new Map(participations.map((p) => [p.conversationId, p]));
    const unreadByConv = new Map<string, number>();
    for (const msg of recentMessages) {
      if (msg.senderId === userId) continue;
      const p = participationByConv.get(msg.conversationId);
      if (!p) continue;
      if (!p.lastReadAt || msg.createdAt > p.lastReadAt) {
        unreadByConv.set(msg.conversationId, (unreadByConv.get(msg.conversationId) ?? 0) + 1);
      }
    }

    const conversations = convIds
      .map((id) => ({
        id,
        otherUser: otherUserByConv.get(id) ?? null,
        lastMessage: lastMsgByConv.get(id) ?? null,
        unreadCount: unreadByConv.get(id) ?? 0,
      }))
      .filter((c) => c.otherUser !== null)
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt.getTime() ?? 0;
        const bTime = b.lastMessage?.createdAt.getTime() ?? 0;
        return bTime - aTime;
      });

    res.json({ conversations });
  } catch (err) {
    req.log.error(err, "getConversations failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /conversations — get or create DM ────────────────────────────────────
const CreateConvBody = z.object({ friendId: z.string().uuid() });

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateConvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const userId = req.userId!;
  const { friendId } = parsed.data;

  if (userId === friendId) {
    res.status(400).json({ error: "لا يمكنك مراسلة نفسك" });
    return;
  }

  try {
    if (!(await areFriends(userId, friendId))) {
      res.status(403).json({ error: "يجب أن تكونا أصدقاء لبدء محادثة" });
      return;
    }

    const [u1, u2] = sortedPair(userId, friendId);
    const directKey = `dm:${u1}:${u2}`;

    const [existing] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(eq(conversationsTable.directKey, directKey))
      .limit(1);

    if (existing) {
      res.json({ conversationId: existing.id });
      return;
    }

    const [conv] = await db
      .insert(conversationsTable)
      .values({ directKey })
      .returning();

    await db.insert(conversationParticipantsTable).values([
      { conversationId: conv!.id, userId },
      { conversationId: conv!.id, userId: friendId },
    ]);

    res.status(201).json({ conversationId: conv!.id });
  } catch (err) {
    req.log.error(err, "createConversation failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /conversations/:id/messages ──────────────────────────────────────────
router.get("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = req.params["id"] as string;
  const before = req.query["before"] as string | undefined;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);

  try {
    const [participant] = await db
      .select({ id: conversationParticipantsTable.id })
      .from(conversationParticipantsTable)
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, id),
          eq(conversationParticipantsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!participant) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.createdAt))
      .limit(limit);

    await db
      .update(conversationParticipantsTable)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, id),
          eq(conversationParticipantsTable.userId, userId),
        ),
      );

    res.json({ messages });
  } catch (err) {
    req.log.error(err, "getMessages failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /conversations/:id/messages — send message ──────────────────────────
const SendMessageBody = z.object({
  content: z.string().min(1).max(4000),
});

router.post("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "الرسالة لا يمكن أن تكون فارغة" });
    return;
  }

  const userId = req.userId!;
  const id = req.params["id"] as string;

  try {
    const participants = await db
      .select({ userId: conversationParticipantsTable.userId })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, id));

    const participantIds = participants.map((p) => p.userId);
    if (!participantIds.includes(userId)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        conversationId: id,
        senderId: userId,
        content: parsed.data.content.trim(),
      })
      .returning();

    await db
      .update(conversationParticipantsTable)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipantsTable.conversationId, id),
          eq(conversationParticipantsTable.userId, userId),
        ),
      );

    wsManager.broadcast(participantIds, {
      type: "new_message",
      payload: { conversationId: id, message },
    });

    const senderName = req.user?.name ?? req.user?.username ?? "مستخدم";
    const recipientIds = participantIds.filter((pid) => pid !== userId);
    for (const recipientId of recipientIds) {
      wsManager.notifyNewMessage({
        recipientId,
        senderName,
        conversationId: id,
        messageId: message!.id,
        preview: parsed.data.content.trim(),
      });
    }

    res.status(201).json({ message });
  } catch (err) {
    req.log.error(err, "sendMessage failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
