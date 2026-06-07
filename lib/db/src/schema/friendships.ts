import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
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
});

export type Friendship = typeof friendshipsTable.$inferSelect;
