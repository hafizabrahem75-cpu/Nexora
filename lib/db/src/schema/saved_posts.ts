import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { communityPostsTable } from "./community_posts";
import { usersTable } from "./users";

export const savedPostsTable = pgTable("saved_posts", {
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId:    uuid("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.postId] }),
  index("saved_posts_user_id_idx").on(t.userId),
  index("saved_posts_post_id_idx").on(t.postId),
]);

export type SavedPost = typeof savedPostsTable.$inferSelect;
