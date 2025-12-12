import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const loginAttempt = sqliteTable("login_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  value: text("value"),
  method: text("method"),
  code: text("code"),
});

export type LoginAttemptRecord = typeof loginAttempt.$inferSelect;
export type NewLoginAttemptRecord = typeof loginAttempt.$inferInsert;
