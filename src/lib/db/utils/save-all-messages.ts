import { eq } from "drizzle-orm";
import type { Message } from "node_modules/telegraf/typings/core/types/typegram";
import { db } from "../db";
import { tables } from "../schemas";

export async function saveAllMessages(
  messages: Message.TextMessage[],
  loginAttemptId: string,
) {
  await db
    .delete(tables.message)
    .where(eq(tables.message.loginAttemptId, loginAttemptId));

  return db.insert(tables.message).values(
    messages.map((message) => ({
      chatId: message.chat.id,
      messageId: message.message_id,
      loginAttemptId: loginAttemptId,
    })),
  );
}
