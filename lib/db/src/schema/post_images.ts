import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { communityPostsTable } from "./community_posts";
import { usersTable } from "./users";

/**
 * Stores image attachments for community posts.
 *
 * Design notes (Phase 1 → Phase 2 path):
 * - postId is nullable so images can be uploaded before a post is created
 *   and then linked at post-creation time.  This avoids multi-step client
 *   coordination while still being safe (unlinked rows are inert).
 * - One post can own many rows — no schema change needed to go from
 *   "one image" (Phase 1) to "multiple images" (Phase 2).
 * - userId records who uploaded the image so the server can verify
 *   ownership without trusting any client-supplied field.
 * - `data` stores raw base64 (no data-URI prefix).  The serve endpoint
 *   reconstructs the full data-URI / binary response using `mimeType`.
 */
export const postImagesTable = pgTable("post_images", {
  id:        uuid("id").primaryKey().defaultRandom(),
  postId:    uuid("post_id").references(() => communityPostsTable.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mimeType:  text("mime_type").notNull(),
  data:      text("data").notNull(),   // base64-encoded binary (no "data:…" prefix)
  size:      integer("size").notNull(), // decoded byte count
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("post_images_post_id_idx").on(t.postId),
  index("post_images_user_id_idx").on(t.userId),
]);

export type PostImage = typeof postImagesTable.$inferSelect;
