import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default("مستخدم Nexora"),
  username: text("username").unique(),
  avatarColor: text("avatar_color").notNull().default("#7C6EFA"),
  avatarImageUri: text("avatar_image_uri"),
  bio: text("bio"),
  emailVerified: boolean("email_verified").notNull().default(false),
  profileVisibility: text("profile_visibility").notNull().default("everyone"),
  messagingPrivacy: text("messaging_privacy").notNull().default("everyone"),
  isDeveloper: boolean("is_developer").notNull().default(false),
  suspendedAt: timestamp("suspended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const publicUserSchema = createSelectSchema(usersTable).omit({
  passwordHash: true,
});

export type User = typeof usersTable.$inferSelect;
export type PublicUser = z.infer<typeof publicUserSchema>;
