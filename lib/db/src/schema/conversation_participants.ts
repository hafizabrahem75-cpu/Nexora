import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
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
  (t) => [
    index("conv_participants_user_id_idx").on(t.userId),
    index("conv_participants_conversation_id_idx").on(t.conversationId),
  ],
);

export type ConversationParticipant =
  typeof conversationParticipantsTable.$inferSelect;
