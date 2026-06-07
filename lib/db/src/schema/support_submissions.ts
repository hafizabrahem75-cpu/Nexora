import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportSubmissionsTable = pgTable("support_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  username: text("username"),
  email: text("email").notNull(),
  type: text("type").notNull(), // 'report' | 'help' | 'feature' | 'feedback'
  content: text("content").notNull(),
  screenshotUri: text("screenshot_uri"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
