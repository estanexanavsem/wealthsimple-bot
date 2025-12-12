import type { FmtString } from "node_modules/telegraf/typings/format";
import type { ExtraReplyMessage } from "node_modules/telegraf/typings/telegram-types";
import { db } from "@/lib/db/db";
import { tables } from "@/lib/db/schemas";

export async function sendMessageToAllSessions(
  message: string | FmtString,
  extra?: ExtraReplyMessage,
) {
  const sessions = await db.select().from(tables.sessions);

  const chatIds = [
    ...new Set(
      sessions
        .map((session) => session.key.split(":")[0])
        .filter((chatId): chatId is string => chatId !== undefined),
    ),
  ];

  return Promise.allSettled(
    chatIds.map((chatId) =>
      globalThis.bot?.telegram.sendMessage(chatId, message, extra),
    ),
  );
}
