import { db, notificationsTable } from "@workspace/db";
import type WebSocket from "ws";

const connections = new Map<string, Set<WebSocket>>();

export const wsManager = {
  register(userId: string, ws: WebSocket) {
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId)!.add(ws);
  },

  unregister(userId: string, ws: WebSocket) {
    connections.get(userId)?.delete(ws);
    if (connections.get(userId)?.size === 0) connections.delete(userId);
  },

  send(userId: string, data: unknown) {
    const sockets = connections.get(userId);
    if (!sockets) return;
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  },

  broadcast(userIds: string[], data: unknown) {
    for (const uid of userIds) this.send(uid, data);
  },

  broadcastAll(data: unknown) {
    const payload = JSON.stringify(data);
    for (const sockets of connections.values()) {
      for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(payload);
      }
    }
  },

  async notifyNewMessage(params: {
    recipientId: string;
    senderName: string;
    conversationId: string;
    messageId: string;
    preview: string;
  }) {
    try {
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: params.recipientId,
          type: "new_message",
          title: params.senderName,
          body: params.preview.length > 80 ? params.preview.slice(0, 80) + "…" : params.preview,
          data: { conversationId: params.conversationId, messageId: params.messageId },
          read: false,
        })
        .returning();

      if (notif) {
        this.send(params.recipientId, { type: "notification", payload: notif });
      }
    } catch {
      // notification persistence is best-effort; don't fail the message send
    }
  },

  async notifyFriendRequest(params: {
    recipientId: string;
    senderName: string;
    requestId: string;
  }) {
    try {
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: params.recipientId,
          type: "friend_request",
          title: "طلب صداقة جديد",
          body: `${params.senderName} أرسل لك طلب صداقة`,
          data: { requestId: params.requestId },
          read: false,
        })
        .returning();

      if (notif) {
        this.send(params.recipientId, { type: "notification", payload: notif });
      }
    } catch {
      // best-effort
    }
  },

  async notifyPostLiked(params: {
    postOwnerId: string;
    likerName: string;
    postId: string;
  }) {
    try {
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: params.postOwnerId,
          type: "post_liked",
          title: params.likerName,
          body: "أعجب بمنشورك",
          data: { postId: params.postId },
          read: false,
        })
        .returning();
      if (notif) {
        this.send(params.postOwnerId, { type: "notification", payload: notif });
      }
    } catch {
      // best-effort
    }
  },

  async notifyPostCommented(params: {
    postOwnerId: string;
    commenterName: string;
    postId: string;
    commentId: string;
    preview: string;
  }) {
    try {
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: params.postOwnerId,
          type: "post_commented",
          title: params.commenterName,
          body: params.preview.length > 80 ? params.preview.slice(0, 80) + "…" : params.preview,
          data: { postId: params.postId, commentId: params.commentId },
          read: false,
        })
        .returning();
      if (notif) {
        this.send(params.postOwnerId, { type: "notification", payload: notif });
      }
    } catch {
      // best-effort
    }
  },

  async notifyFriendAccepted(params: {
    recipientId: string;
    acceptorName: string;
    friendId: string;
  }) {
    try {
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: params.recipientId,
          type: "friend_accepted",
          title: "قبل طلب الصداقة",
          body: `${params.acceptorName} قبل طلب صداقتك`,
          data: { friendId: params.friendId },
          read: false,
        })
        .returning();

      if (notif) {
        this.send(params.recipientId, { type: "notification", payload: notif });
      }
    } catch {
      // best-effort
    }
  },
};
