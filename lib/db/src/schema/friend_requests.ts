import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const friendRequestsTable = pgTable("friend_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("friend_requests_sender_id_idx").on(t.senderId),
  index("friend_requests_receiver_id_idx").on(t.receiverId),
]);

export type FriendRequest = typeof friendRequestsTable.$inferSelect;
export type FriendRequestStatus = "pending" | "accepted" | "rejected";
