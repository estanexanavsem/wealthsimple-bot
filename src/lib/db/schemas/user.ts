import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("users", {
  id: text("id").primaryKey(),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
});

export type UserRecord = typeof user.$inferSelect;
export type NewUserRecord = typeof user.$inferInsert;
