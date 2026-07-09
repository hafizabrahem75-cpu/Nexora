import { db, communityPostsTable, followsTable, postCommentsTable, postLikesTable, postReportsTable, postImagesTable, savedPostsTable, usersTable } from "@workspace/db";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
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

// Allow 20 image uploads per user per hour.
const imageUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: byUser,
  message: { error: "وصلت إلى الحد الأقصى لرفع الصور (20 في الساعة)، حاول لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Image validation ─────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB decoded

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type ImageValidation =
  | { ok: true; decodedSize: number }
  | { ok: false; error: string };

/**
 * Validate image content by decoding the first bytes and checking format
 * signatures directly — never trusting the client-supplied mimeType field.
 *
 * WebP needs 12 decoded bytes to confirm the RIFF + WEBP signature; all
 * other formats are determined from the first 4 bytes.
 */
function detectMimeType(headerBytes: Buffer): string | null {
  if (headerBytes.length >= 3 &&
      headerBytes[0] === 0xFF && headerBytes[1] === 0xD8 && headerBytes[2] === 0xFF) {
    return "image/jpeg";
  }
  if (headerBytes.length >= 4 &&
      headerBytes[0] === 0x89 && headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4E && headerBytes[3] === 0x47) {
    return "image/png";
  }
  if (headerBytes.length >= 4 &&
      headerBytes[0] === 0x47 && headerBytes[1] === 0x49 &&
      headerBytes[2] === 0x46 && headerBytes[3] === 0x38) {
    return "image/gif";
  }
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  if (headerBytes.length >= 12 &&
      headerBytes[0] === 0x52 && headerBytes[1] === 0x49 &&
      headerBytes[2] === 0x46 && headerBytes[3] === 0x46 &&
      headerBytes[8] === 0x57 && headerBytes[9] === 0x45 &&
      headerBytes[10] === 0x42 && headerBytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

function validateImage(mimeType: string, base64Data: string): ImageValidation {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "نوع الملف غير مدعوم. الأنواع المسموح بها: JPEG, PNG, GIF, WebP" };
  }

  // Decode enough bytes to read the full magic signature (12 bytes for WebP).
  // base64 encodes 3 bytes per 4 chars, so 16 chars → 12 bytes.
  let headerBytes: Buffer;
  try {
    headerBytes = Buffer.from(base64Data.slice(0, 20), "base64");
  } catch {
    return { ok: false, error: "بيانات الصورة غير صالحة" };
  }

  const detectedType = detectMimeType(headerBytes);
  if (!detectedType) {
    return { ok: false, error: "الملف لا يطابق أي تنسيق مدعوم (JPEG, PNG, GIF, WebP)" };
  }
  if (detectedType !== mimeType) {
    return { ok: false, error: "نوع الملف المُعلَن لا يطابق محتواه الفعلي" };
  }

  // Estimate decoded byte count (base64 length × 0.75, minus padding).
  const padding = (base64Data.match(/={0,2}$/) ?? [""])[0].length;
  const decodedSize = Math.floor(base64Data.length * 0.75) - padding;

  if (decodedSize > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `حجم الصورة يتجاوز الحد المسموح (${MAX_IMAGE_BYTES / 1024 / 1024} ميغابايت)`,
    };
  }

  if (decodedSize < 1) {
    return { ok: false, error: "بيانات الصورة فارغة" };
  }

  return { ok: true, decodedSize };
}

// ─── Helper: fetch images for a list of post IDs ──────────────────────────────

async function fetchImagesForPosts(
  postIds: string[],
): Promise<Map<string, Array<{ id: string; mimeType: string }>>> {
  const map = new Map<string, Array<{ id: string; mimeType: string }>>();
  if (postIds.length === 0) return map;

  const rows = await db
    .select({
      postId:   postImagesTable.postId,
      id:       postImagesTable.id,
      mimeType: postImagesTable.mimeType,
    })
    .from(postImagesTable)
    .where(inArray(postImagesTable.postId, postIds))
    .orderBy(asc(postImagesTable.createdAt));

  for (const row of rows) {
    if (!row.postId) continue;
    if (!map.has(row.postId)) map.set(row.postId, []);
    map.get(row.postId)!.push({ id: row.id, mimeType: row.mimeType });
  }
  return map;
}

// ─── POST /community/images ───────────────────────────────────────────────────
// Upload an image before (or during) post creation.  Returns an imageId that
// the client passes to POST /community/posts.  The image is unlinked (postId
// = NULL) until the post is created; linked rows are cascade-deleted with the
// post.  Unlinked rows are harmless orphans (periodic cleanup can remove them).
//
// Body: { mimeType: string, data: string }
//   mimeType — "image/jpeg" | "image/png" | "image/gif" | "image/webp"
//   data     — raw base64-encoded image bytes (no "data:…;base64," prefix)

const UploadImageBody = z.object({
  mimeType: z.string(),
  data:     z.string().min(1),
});

router.post("/images", requireAuth, imageUploadLimiter, async (req: AuthRequest, res) => {
  const parsed = UploadImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة — يرجى إرسال mimeType وdata" });
    return;
  }

  const { mimeType, data } = parsed.data;
  const validation = validateImage(mimeType, data);
  if (!validation.ok) {
    res.status(422).json({ error: validation.error });
    return;
  }

  try {
    const [row] = await db
      .insert(postImagesTable)
      .values({
        postId:   null,              // linked when the post is created
        userId:   req.userId!,       // server-derived — never trusts client
        mimeType,
        data,
        size:     validation.decodedSize,
      })
      .returning({ id: postImagesTable.id });

    res.status(201).json({ imageId: row!.id });
  } catch (err) {
    req.log.error(err, "uploadPostImage failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── GET /community/images/:id ────────────────────────────────────────────────
// Serve the binary image.  No auth required — images in public posts are
// accessible to anyone who has the image ID (obtained from the post payload).
// Only serves images that are linked to a published post (postId IS NOT NULL)
// so unlinked/orphan uploads are never exposed.

router.get("/images/:id", async (req, res) => {
  const imageId = req.params.id as string;
  try {
    const [row] = await db
      .select({ mimeType: postImagesTable.mimeType, data: postImagesTable.data })
      .from(postImagesTable)
      .where(and(eq(postImagesTable.id, imageId), isNotNull(postImagesTable.postId)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "الصورة غير موجودة" });
      return;
    }

    const buffer = Buffer.from(row.data, "base64");
    res.set("Content-Type", row.mimeType);
    res.set("Content-Length", String(buffer.length));
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch (err) {
    // req.log not available (no pino on this path) — use console as fallback
    console.error("servePostImage failed", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
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

    const postIds = rows.map((r) => r.id);

    const [likedRows, imageMap] = await Promise.all([
      rows.length > 0
        ? db
            .select({ postId: postLikesTable.postId })
            .from(postLikesTable)
            .where(
              and(
                eq(postLikesTable.userId, req.userId!),
                inArray(postLikesTable.postId, postIds),
              ),
            )
        : Promise.resolve([]),
      fetchImagesForPosts(postIds),
    ]);

    const likedSet = new Set(likedRows.map((l) => l.postId));
    const posts = rows.map((r) => ({
      ...r,
      isLiked: likedSet.has(r.id),
      images:  imageMap.get(r.id) ?? [],
    }));
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
    const followed = await db
      .select({ followeeId: followsTable.followeeId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));

    const followedIds = followed.map((f) => f.followeeId);
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

    const postIds = rows.map((r) => r.id);

    const [likedRows, imageMap] = await Promise.all([
      rows.length > 0
        ? db
            .select({ postId: postLikesTable.postId })
            .from(postLikesTable)
            .where(and(eq(postLikesTable.userId, userId), inArray(postLikesTable.postId, postIds)))
        : Promise.resolve([]),
      fetchImagesForPosts(postIds),
    ]);

    const likedSet = new Set(likedRows.map((l) => l.postId));
    const posts = rows.map((r) => ({
      ...r,
      isLiked: likedSet.has(r.id),
      images:  imageMap.get(r.id) ?? [],
    }));

    res.json({ posts, followingCount: followedIds.length });
  } catch (err) {
    req.log.error(err, "getFollowingPosts failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts ────────────────────────────────────────────────────
const CreatePostBody = z.object({
  content: z.string().min(1).max(5000),
  imageId: z.string().uuid().optional(),
});

router.post("/posts", requireAuth, postLimiter, async (req: AuthRequest, res) => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const { content, imageId } = parsed.data;
  const userId = req.userId!;

  try {
    // ── Resolve imageId before creating the post ──────────────────────────────
    // Pre-fetch the image row to get mimeType for the response.  The actual
    // ownership + unlinked check happens atomically below via a conditional
    // UPDATE — this select is advisory only and does not gate the security check.
    let pendingImageMeta: { id: string; mimeType: string } | null = null;
    if (imageId) {
      const [img] = await db
        .select({ id: postImagesTable.id, mimeType: postImagesTable.mimeType })
        .from(postImagesTable)
        .where(
          and(
            eq(postImagesTable.id, imageId),
            eq(postImagesTable.userId, userId),   // ownership: server-verified
            isNull(postImagesTable.postId),        // must be unlinked
          ),
        )
        .limit(1);

      if (!img) {
        // Could be: not found, wrong owner, or already linked.
        res.status(409).json({ error: "الصورة غير موجودة أو لا تخص حسابك أو مرتبطة بمنشور آخر" });
        return;
      }
      pendingImageMeta = { id: img.id, mimeType: img.mimeType };
    }

    // ── Create the post ───────────────────────────────────────────────────────
    const [inserted] = await db
      .insert(communityPostsTable)
      .values({ userId, content })
      .returning();

    // ── Atomically link the image ─────────────────────────────────────────────
    // The WHERE clause repeats userId + IS NULL so that even if a concurrent
    // request already claimed this imageId between our select and this update,
    // the update simply matches 0 rows and we surface the conflict to the client.
    let linkedImages: Array<{ id: string; mimeType: string }> = [];
    if (pendingImageMeta && inserted) {
      const claimed = await db
        .update(postImagesTable)
        .set({ postId: inserted.id })
        .where(
          and(
            eq(postImagesTable.id, pendingImageMeta.id),
            eq(postImagesTable.userId, userId),   // re-assert ownership
            isNull(postImagesTable.postId),        // re-assert unlinked (atomic guard)
          ),
        )
        .returning({ id: postImagesTable.id, mimeType: postImagesTable.mimeType });

      if (claimed.length === 0) {
        // Concurrent request won the race — roll back the post and reject.
        await db.delete(communityPostsTable).where(eq(communityPostsTable.id, inserted.id));
        res.status(409).json({ error: "الصورة مرتبطة بمنشور آخر بالفعل، يرجى رفع صورة جديدة" });
        return;
      }
      linkedImages = [{ id: claimed[0]!.id, mimeType: claimed[0]!.mimeType }];
    }

    const post = {
      id:            inserted!.id,
      content:       inserted!.content,
      likesCount:    inserted!.likesCount,
      commentsCount: inserted!.commentsCount,
      createdAt:     inserted!.createdAt,
      isLiked:       false,
      images:        linkedImages,
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
    // post_likes, post_comments and post_images cascade automatically
    wsManager.broadcastAll({ type: "post_deleted", payload: { postId } });
    res.json({ deleted: true });
  } catch (err) {
    req.log.error(err, "deletePost failed");
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
      id:        inserted!.id,
      content:   inserted!.content,
      createdAt: inserted!.createdAt,
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
        commentId: inserted!.id,
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
