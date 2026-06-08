import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const goalsTable = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  reminderAt: timestamp("reminder_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Goal = typeof goalsTable.$inferSelect;
