import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const friendshipsTable = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId1: uuid("user_id_1")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  userId2: uuid("user_id_2")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("friendships_user_id_1_idx").on(t.userId1),
  index("friendships_user_id_2_idx").on(t.userId2),
]);

export type Friendship = typeof friendshipsTable.$inferSelect;
