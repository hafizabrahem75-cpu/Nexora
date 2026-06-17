import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { communityPostsTable } from "./community_posts";
import { usersTable } from "./users";

export const postReportsTable = pgTable("post_reports", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId:    uuid("post_id").notNull().references(() => communityPostsTable.id, { onDelete: "cascade" }),
  reason:    text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("post_reports_unique_user_post").on(t.userId, t.postId),
  index("post_reports_post_id_idx").on(t.postId),
  index("post_reports_user_id_idx").on(t.userId),
]);

export type PostReport = typeof postReportsTable.$inferSelect;
