import { db, followsTable, friendshipsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { wsManager } from "../lib/wsManager";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function canViewProfile(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;

  const [owner] = await db
    .select({ visibility: usersTable.profileVisibility })
    .from(usersTable)
    .where(eq(usersTable.id, ownerId))
    .limit(1);

  if (!owner) return false;
  if (owner.visibility === "everyone") return true;
  if (owner.visibility !== "friends") return false;

  const [userId1, userId2] = viewerId < ownerId
    ? [viewerId, ownerId]
    : [ownerId, viewerId];

  const [friendship] = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(and(
      eq(friendshipsTable.userId1, userId1),
      eq(friendshipsTable.userId2, userId2),
    ))
    .limit(1);

  return !!friendship;
}

const followLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as AuthRequest).userId ?? "anonymous",
  message: { error: "طلبات متابعة كثيرة جداً، يرجى المحاولة بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /follows/:userId — follow a user ────────────────────────────────────
router.post("/:userId", requireAuth, followLimiter, async (req: AuthRequest, res) => {
  const followeeId = req.params["userId"] as string;
  const followerId = req.userId!;

  if (followerId === followeeId) {
    res.status(400).json({ error: "لا يمكنك متابعة نفسك" });
    return;
  }

  try {
    const result = await db
      .insert(followsTable)
      .values({ followerId, followeeId })
      .onConflictDoNothing()
      .returning();

    // Only notify if a new follow row was actually inserted (not a duplicate)
    if (result.length > 0) {
      const [follower] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, followerId))
        .limit(1);
      if (follower) {
        wsManager.notifyFollowed({
          followeeId,
          followerName: follower.name,
          followerId,
        });
      }
    }

    res.json({ followed: true });
  } catch (err) {
    req.log.error(err, "followUser failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /follows/:userId — unfollow a user ────────────────────────────────
router.delete("/:userId", requireAuth, followLimiter, async (req: AuthRequest, res) => {
  const followeeId = req.params["userId"] as string;
  const followerId = req.userId!;

  try {
    await db
      .delete(followsTable)
      .where(
        and(
          eq(followsTable.followerId, followerId),
          eq(followsTable.followeeId, followeeId),
        ),
      );

    res.json({ unfollowed: true });
  } catch (err) {
    req.log.error(err, "unfollowUser failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /follows/:userId/followers — list followers (future-ready) ───────────
router.get("/:userId/followers", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.params as { userId: string };
  try {
    if (!(await canViewProfile(req.userId!, userId))) {
      res.status(404).json({ error: "القائمة غير متاحة" });
      return;
    }
    const rows = await db
      .select({
        id:             usersTable.id,
        name:           usersTable.name,
        username:       usersTable.username,
        avatarColor:    usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
      })
      .from(followsTable)
      .innerJoin(usersTable, eq(followsTable.followerId, usersTable.id))
      .where(eq(followsTable.followeeId, userId))
      .limit(200);

    res.json({ followers: rows });
  } catch (err) {
    req.log.error(err, "getFollowers failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /follows/:userId/following — list following (future-ready) ───────────
router.get("/:userId/following", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.params as { userId: string };
  try {
    if (!(await canViewProfile(req.userId!, userId))) {
      res.status(404).json({ error: "القائمة غير متاحة" });
      return;
    }
    const rows = await db
      .select({
        id:             usersTable.id,
        name:           usersTable.name,
        username:       usersTable.username,
        avatarColor:    usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
      })
      .from(followsTable)
      .innerJoin(usersTable, eq(followsTable.followeeId, usersTable.id))
      .where(eq(followsTable.followerId, userId))
      .limit(200);

    res.json({ following: rows });
  } catch (err) {
    req.log.error(err, "getFollowing failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
