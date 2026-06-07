import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const conversationParticipantsTable = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
);

export type ConversationParticipant =
  typeof conversationParticipantsTable.$inferSelect;
