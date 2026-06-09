import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("messages_conversation_id_idx").on(t.conversationId),
  index("messages_conversation_id_created_at_idx").on(t.conversationId, t.createdAt),
  index("messages_sender_id_idx").on(t.senderId),
]);

export type Message = typeof messagesTable.$inferSelect;
