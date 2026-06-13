import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const followsTable = pgTable("follows", {
  id:         uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  followeeId: uuid("followee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("follows_unique_pair").on(t.followerId, t.followeeId),
  index("follows_follower_id_idx").on(t.followerId),
  index("follows_followee_id_idx").on(t.followeeId),
]);

export type Follow = typeof followsTable.$inferSelect;
