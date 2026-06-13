import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { communityPostsTable } from "./community_posts";
import { usersTable } from "./users";

export const postCommentsTable = pgTable("post_comments", {
  id:        uuid("id").primaryKey().defaultRandom(),
  postId:    uuid("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content:   text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("post_comments_post_id_idx").on(t.postId),
  index("post_comments_created_at_idx").on(t.createdAt),
]);

export type PostComment = typeof postCommentsTable.$inferSelect;
