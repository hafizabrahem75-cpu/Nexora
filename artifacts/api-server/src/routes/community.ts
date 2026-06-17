import { db, communityPostsTable, followsTable, postCommentsTable, postLikesTable, postReportsTable, savedPostsTable, usersTable } from "@workspace/db";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { wsManager } from "../lib/wsManager";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const byUser = (req: Express.Request) =>
  (req as AuthRequest).userId ?? "anonymous";

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: byUser,
  message: { error: "وصلت إلى الحد الأقصى للمنشورات (10 في الساعة)، حاول لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
});

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: byUser,
  message: { error: "وصلت إلى الحد الأقصى للتعليقات (30 في الساعة)، حاول لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
});

const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: byUser,
  message: { error: "طلبات إعجاب كثيرة جداً، يرجى المحاولة بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
});

const saveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: byUser,
  message: { error: "طلبات حفظ كثيرة جداً، يرجى المحاولة بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: byUser,
  message: { error: "وصلت إلى الحد الأقصى للبلاغات (10 في الساعة)، حاول لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── GET /community/posts ─────────────────────────────────────────────────────
router.get("/posts", requireAuth, async (req: AuthRequest, res) => {
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
      .orderBy(desc(communityPostsTable.createdAt))
      .limit(100);

    let likedSet = new Set<string>();
    if (rows.length > 0) {
      const postIds = rows.map((r) => r.id);
      const liked = await db
        .select({ postId: postLikesTable.postId })
        .from(postLikesTable)
        .where(
          and(
            eq(postLikesTable.userId, req.userId!),
            inArray(postLikesTable.postId, postIds),
          ),
        );
      likedSet = new Set(liked.map((l) => l.postId));
    }

    const posts = rows.map((r) => ({ ...r, isLiked: likedSet.has(r.id) }));
    res.json({ posts });
  } catch (err) {
    req.log.error(err, "getCommunityPosts failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /community/posts/following ──────────────────────────────────────────
router.get("/posts/following", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    // Fetch IDs the user follows
    const followed = await db
      .select({ followeeId: followsTable.followeeId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));

    const followedIds = followed.map((f) => f.followeeId);
    // Include own posts
    const relevantIds = [...followedIds, userId];

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
      .where(inArray(communityPostsTable.userId, relevantIds))
      .orderBy(desc(communityPostsTable.createdAt))
      .limit(100);

    let likedSet = new Set<string>();
    if (rows.length > 0) {
      const postIds = rows.map((r) => r.id);
      const liked = await db
        .select({ postId: postLikesTable.postId })
        .from(postLikesTable)
        .where(and(eq(postLikesTable.userId, userId), inArray(postLikesTable.postId, postIds)));
      likedSet = new Set(liked.map((l) => l.postId));
    }

    const posts = rows.map((r) => ({ ...r, isLiked: likedSet.has(r.id) }));
    // Return count of followed accounts so the client knows if feed is empty due to no follows
    res.json({ posts, followingCount: followedIds.length });
  } catch (err) {
    req.log.error(err, "getFollowingPosts failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts ────────────────────────────────────────────────────
const CreatePostBody = z.object({
  content: z.string().min(1).max(5000),
});

// ─── PUT /community/posts/:id ────────────────────────────────────────────────
const EditPostBody = z.object({ content: z.string().min(1).max(5000) });

router.put("/posts/:id", requireAuth, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  const userId  = req.userId!;
  const parsed  = EditPostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صالحة" }); return; }
  try {
    const [existing] = await db
      .select({ ownerId: communityPostsTable.userId })
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, postId))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "المنشور غير موجود" }); return; }
    if (existing.ownerId !== userId) { res.status(403).json({ error: "غير مصرح" }); return; }

    const [updated] = await db
      .update(communityPostsTable)
      .set({ content: parsed.data.content })
      .where(eq(communityPostsTable.id, postId))
      .returning();

    wsManager.broadcastAll({ type: "post_updated", payload: { postId, content: updated!.content } });
    res.json({ post: updated });
  } catch (err) {
    req.log.error(err, "editPost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /community/posts/:id ─────────────────────────────────────────────
router.delete("/posts/:id", requireAuth, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  const userId  = req.userId!;
  try {
    const [existing] = await db
      .select({ ownerId: communityPostsTable.userId })
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, postId))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "المنشور غير موجود" }); return; }
    if (existing.ownerId !== userId) { res.status(403).json({ error: "غير مصرح" }); return; }

    await db.delete(communityPostsTable).where(eq(communityPostsTable.id, postId));
    // post_likes and post_comments cascade automatically
    wsManager.broadcastAll({ type: "post_deleted", payload: { postId } });
    res.json({ deleted: true });
  } catch (err) {
    req.log.error(err, "deletePost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts ────────────────────────────────────────────────────
router.post("/posts", requireAuth, postLimiter, async (req: AuthRequest, res) => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [inserted] = await db
      .insert(communityPostsTable)
      .values({ userId: req.userId!, content: parsed.data.content })
      .returning();

    const post = {
      id:            inserted.id,
      content:       inserted.content,
      likesCount:    inserted.likesCount,
      commentsCount: inserted.commentsCount,
      createdAt:     inserted.createdAt,
      isLiked:       false,
      author: {
        id:             req.user!.id,
        name:           req.user!.name,
        username:       req.user!.username,
        avatarColor:    req.user!.avatarColor,
        avatarImageUri: req.user!.avatarImageUri ?? null,
      },
    };

    res.status(201).json({ post });
  } catch (err) {
    req.log.error(err, "createCommunityPost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts/:id/like ──────────────────────────────────────────
router.post("/posts/:id/like", requireAuth, likeLimiter, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  try {
    const inserted = await db
      .insert(postLikesTable)
      .values({ userId: req.userId!, postId })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      const [post] = await db
        .select({ likesCount: communityPostsTable.likesCount })
        .from(communityPostsTable)
        .where(eq(communityPostsTable.id, postId));
      res.json({ likesCount: post?.likesCount ?? 0 });
      return;
    }

    const [updated] = await db
      .update(communityPostsTable)
      .set({ likesCount: sql`${communityPostsTable.likesCount} + 1` })
      .where(eq(communityPostsTable.id, postId))
      .returning({ likesCount: communityPostsTable.likesCount, ownerId: communityPostsTable.userId });

    if (!updated) {
      res.status(404).json({ error: "المنشور غير موجود" });
      return;
    }

    wsManager.broadcastAll({ type: "post_liked", payload: { postId, likesCount: updated.likesCount } });

    if (updated.ownerId !== req.userId) {
      wsManager.notifyPostLiked({
        postOwnerId: updated.ownerId,
        likerName: req.user!.name,
        postId,
      });
    }

    res.json({ likesCount: updated.likesCount });
  } catch (err) {
    req.log.error(err, "likePost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /community/posts/:id/like ────────────────────────────────────────
router.delete("/posts/:id/like", requireAuth, likeLimiter, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  try {
    const deleted = await db
      .delete(postLikesTable)
      .where(
        and(
          eq(postLikesTable.userId, req.userId!),
          eq(postLikesTable.postId, postId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      const [post] = await db
        .select({ likesCount: communityPostsTable.likesCount })
        .from(communityPostsTable)
        .where(eq(communityPostsTable.id, postId));
      res.json({ likesCount: post?.likesCount ?? 0 });
      return;
    }

    const [updated] = await db
      .update(communityPostsTable)
      .set({ likesCount: sql`GREATEST(${communityPostsTable.likesCount} - 1, 0)` })
      .where(eq(communityPostsTable.id, postId))
      .returning({ likesCount: communityPostsTable.likesCount });

    wsManager.broadcastAll({ type: "post_liked", payload: { postId, likesCount: updated?.likesCount ?? 0 } });
    res.json({ likesCount: updated?.likesCount ?? 0 });
  } catch (err) {
    req.log.error(err, "unlikePost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /community/posts/:id/likes ──────────────────────────────────────────
router.get("/posts/:id/likes", requireAuth, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;

  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 50 : limitRaw), 100);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  try {
    const [post] = await db
      .select({ id: communityPostsTable.id })
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "المنشور غير موجود" });
      return;
    }

    const conditions = [eq(postLikesTable.postId, postId)];
    if (cursor) {
      conditions.push(sql`${postLikesTable.createdAt} < ${new Date(cursor)}`);
    }

    const rows = await db
      .select({
        likedAt: postLikesTable.createdAt,
        user: {
          id:             usersTable.id,
          name:           usersTable.name,
          username:       usersTable.username,
          avatarColor:    usersTable.avatarColor,
          avatarImageUri: usersTable.avatarImageUri,
        },
      })
      .from(postLikesTable)
      .innerJoin(usersTable, eq(postLikesTable.userId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(postLikesTable.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]!.likedAt.toISOString() : null;

    res.json({ likes: items, nextCursor });
  } catch (err) {
    req.log.error(err, "getPostLikes failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /community/posts/:id/comments ───────────────────────────────────────
router.get("/posts/:id/comments", requireAuth, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  try {
    const rows = await db
      .select({
        id:        postCommentsTable.id,
        content:   postCommentsTable.content,
        createdAt: postCommentsTable.createdAt,
        author: {
          id:             usersTable.id,
          name:           usersTable.name,
          username:       usersTable.username,
          avatarColor:    usersTable.avatarColor,
          avatarImageUri: usersTable.avatarImageUri,
        },
      })
      .from(postCommentsTable)
      .innerJoin(usersTable, eq(postCommentsTable.userId, usersTable.id))
      .where(eq(postCommentsTable.postId, postId))
      .orderBy(asc(postCommentsTable.createdAt))
      .limit(200);

    res.json({ comments: rows });
  } catch (err) {
    req.log.error(err, "getComments failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts/:id/comments ──────────────────────────────────────
const CreateCommentBody = z.object({
  content: z.string().min(1).max(2000),
});

router.post("/posts/:id/comments", requireAuth, commentLimiter, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }
  try {
    const [inserted] = await db
      .insert(postCommentsTable)
      .values({ postId, userId: req.userId!, content: parsed.data.content })
      .returning();

    const [updated] = await db
      .update(communityPostsTable)
      .set({ commentsCount: sql`${communityPostsTable.commentsCount} + 1` })
      .where(eq(communityPostsTable.id, postId))
      .returning({ commentsCount: communityPostsTable.commentsCount, ownerId: communityPostsTable.userId });

    const comment = {
      id:        inserted.id,
      content:   inserted.content,
      createdAt: inserted.createdAt,
      author: {
        id:             req.user!.id,
        name:           req.user!.name,
        username:       req.user!.username,
        avatarColor:    req.user!.avatarColor,
        avatarImageUri: req.user!.avatarImageUri ?? null,
      },
    };

    wsManager.broadcastAll({
      type: "post_commented",
      payload: { postId, comment, commentsCount: updated?.commentsCount ?? 0 },
    });

    if (updated && updated.ownerId !== req.userId) {
      wsManager.notifyPostCommented({
        postOwnerId: updated.ownerId,
        commenterName: req.user!.name,
        postId,
        commentId: inserted.id,
        preview: parsed.data.content,
      });
    }

    res.status(201).json({ comment, commentsCount: updated?.commentsCount ?? 0 });
  } catch (err) {
    req.log.error(err, "createComment failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts/:id/save ──────────────────────────────────────────
router.post("/posts/:id/save", requireAuth, saveLimiter, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  try {
    await db
      .insert(savedPostsTable)
      .values({ userId: req.userId!, postId })
      .onConflictDoNothing();
    res.json({ saved: true });
  } catch (err) {
    req.log.error(err, "savePost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── DELETE /community/posts/:id/save ────────────────────────────────────────
router.delete("/posts/:id/save", requireAuth, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  try {
    await db
      .delete(savedPostsTable)
      .where(and(eq(savedPostsTable.userId, req.userId!), eq(savedPostsTable.postId, postId)));
    res.json({ saved: false });
  } catch (err) {
    req.log.error(err, "unsavePost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts/:id/report ────────────────────────────────────────
const ReportBody = z.object({
  reason: z.enum(["spam", "harassment", "inappropriate", "misinformation", "other"]),
});

router.post("/posts/:id/report", requireAuth, reportLimiter, async (req: AuthRequest, res) => {
  const postId = req.params.id as string;
  const parsed = ReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "سبب البلاغ غير صالح" });
    return;
  }
  try {
    const [post] = await db
      .select({ id: communityPostsTable.id })
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "المنشور غير موجود" });
      return;
    }

    const inserted = await db
      .insert(postReportsTable)
      .values({ userId: req.userId!, postId, reason: parsed.data.reason })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      res.status(409).json({ error: "لقد أبلغت عن هذا المنشور سابقاً" });
      return;
    }
    res.json({ reported: true });
  } catch (err) {
    req.log.error(err, "reportPost failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
