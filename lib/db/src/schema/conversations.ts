import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  directKey: text("direct_key").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
