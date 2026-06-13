import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { communityPostsTable } from "./community_posts";
import { usersTable } from "./users";

export const postLikesTable = pgTable("post_likes", {
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId:    uuid("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.postId] }),
]);

export type PostLike = typeof postLikesTable.$inferSelect;
