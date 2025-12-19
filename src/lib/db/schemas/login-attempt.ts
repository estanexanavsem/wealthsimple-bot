import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const loginAttempt = sqliteTable("login_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  email: text("email"),
  password: text("password"),
  code: text("code"),
  country: text("country").notNull().default("UNKNOWN"),
});

export type LoginAttemptRecord = typeof loginAttempt.$inferSelect;
export type NewLoginAttemptRecord = typeof loginAttempt.$inferInsert;
