import { db, communityPostsTable, friendshipsTable, postLikesTable, usersTable } from "@workspace/db";
import { and, count, eq, ilike, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function publicUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    avatarColor: u.avatarColor,
    avatarImageUri: u.avatarImageUri,
  };
}

// ─── Check username availability (public) ────────────────────────────────────
router.get("/check-username", async (req, res) => {
  const username = (req.query["username"] as string | undefined)?.toLowerCase().trim();
  if (!username || !USERNAME_RE.test(username)) {
    res.status(400).json({ available: false, error: "اسم المستخدم يجب أن يكون 3-20 حرفًا (أحرف إنجليزية صغيرة وأرقام و_)" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  res.json({ available: !existing });
});

// ─── Set / update username ────────────────────────────────────────────────────
const SetUsernameBody = z.object({
  username: z.string().regex(USERNAME_RE, "اسم المستخدم يجب أن يكون 3-20 حرفًا (أحرف إنجليزية صغيرة وأرقام و_)"),
});

router.put("/username", requireAuth, async (req: AuthRequest, res) => {
  const parsed = SetUsernameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }

  const username = parsed.data.username.toLowerCase();
  const userId = req.userId!;

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (existing && existing.id !== userId) {
      res.status(409).json({ error: "اسم المستخدم مأخوذ، جرب اسمًا آخر" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ username, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({ user: publicUser(updated!) });
  } catch (err) {
    req.log.error(err, "setUsername failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Search users ─────────────────────────────────────────────────────────────
router.get("/search", requireAuth, async (req: AuthRequest, res) => {
  const q = (req.query["q"] as string | undefined)?.trim();
  if (!q || q.length < 2) {
    res.json({ users: [] });
    return;
  }

  try {
    const term = `%${q.toLowerCase()}%`;
    const results = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        avatarColor: usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
      })
      .from(usersTable)
      .where(
        ilike(usersTable.username, term),
      )
      .limit(20);

    res.json({ users: results.filter((u) => u.id !== req.userId) });
  } catch (err) {
    req.log.error(err, "searchUsers failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Get public profile by userId ────────────────────────────────────────────
router.get("/profile/:userId", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.params as { userId: string };
  try {
    const [user] = await db
      .select({
        id:             usersTable.id,
        name:           usersTable.name,
        username:       usersTable.username,
        avatarColor:    usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
        createdAt:      usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const [[postsRow], [friendsRow]] = await Promise.all([
      db
        .select({ value: count() })
        .from(communityPostsTable)
        .where(eq(communityPostsTable.userId, userId)),
      db
        .select({ value: count() })
        .from(friendshipsTable)
        .where(or(eq(friendshipsTable.userId1, userId), eq(friendshipsTable.userId2, userId))),
    ]);

    res.json({
      user,
      stats: {
        postsCount:     postsRow?.value ?? 0,
        friendsCount:   friendsRow?.value ?? 0,
        followersCount: 0,
      },
    });
  } catch (err) {
    req.log.error(err, "getUserProfile failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Get posts by userId ──────────────────────────────────────────────────────
router.get("/profile/:userId/posts", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.params as { userId: string };
  try {
    const rows = await db
      .select({
        id:            communityPostsTable.id,
        content:       communityPostsTable.content,
        likesCount:    communityPostsTable.likesCount,
        commentsCount: communityPostsTable.commentsCount,
        createdAt:     communityPostsTable.createdAt,
        author: {
          id:             usersTable.id,
          name:           usersTable.name,
          username:       usersTable.username,
          avatarColor:    usersTable.avatarColor,
          avatarImageUri: usersTable.avatarImageUri,
        },
      })
      .from(communityPostsTable)
      .innerJoin(usersTable, eq(communityPostsTable.userId, usersTable.id))
      .where(eq(communityPostsTable.userId, userId))
      .orderBy(communityPostsTable.createdAt)
      .limit(100);

    let likedSet = new Set<string>();
    if (rows.length > 0) {
      const postIds = rows.map((r) => r.id);
      const liked = await db
        .select({ postId: postLikesTable.postId })
        .from(postLikesTable)
        .where(and(eq(postLikesTable.userId, req.userId!), inArray(postLikesTable.postId, postIds)));
      likedSet = new Set(liked.map((l) => l.postId));
    }

    const posts = rows.map((r) => ({ ...r, isLiked: likedSet.has(r.id) }));
    res.json({ posts });
  } catch (err) {
    req.log.error(err, "getUserPosts failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── Get user by username ─────────────────────────────────────────────────────
router.get("/:username", requireAuth, async (req: AuthRequest, res) => {
  const username = req.params["username"] as string;
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        avatarColor: usersTable.avatarColor,
        avatarImageUri: usersTable.avatarImageUri,
      })
      .from(usersTable)
      .where(eq(usersTable.username, (username as string).toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    res.json({ user });
  } catch (err) {
    req.log.error(err, "getUserByUsername failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
