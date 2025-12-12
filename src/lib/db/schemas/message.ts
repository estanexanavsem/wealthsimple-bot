import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { loginAttempt } from "./login-attempt";

export const message = sqliteTable("messages", {
  chatId: integer("chat_id").notNull(),
  messageId: integer("message_id").notNull(),
  loginAttemptId: text("login_attempt_id")
    .notNull()
    .references(() => loginAttempt.id),
});

export type MessageRecord = typeof message.$inferSelect;
export type NewMessageRecord = typeof message.$inferInsert;
