import { db, communityPostsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

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

    res.json({ posts: rows });
  } catch (err) {
    req.log.error(err, "getCommunityPosts failed");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ─── POST /community/posts ────────────────────────────────────────────────────
const CreateBody = z.object({
  content: z.string().min(1).max(5000),
});

router.post("/posts", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateBody.safeParse(req.body);
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

export default router;
