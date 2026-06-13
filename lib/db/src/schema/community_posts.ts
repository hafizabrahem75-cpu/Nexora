import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const communityPostsTable = pgTable("community_posts", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content:       text("content").notNull(),
  likesCount:    integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("community_posts_user_id_idx").on(t.userId),
  index("community_posts_created_at_idx").on(t.createdAt),
]);

export type CommunityPost = typeof communityPostsTable.$inferSelect;
