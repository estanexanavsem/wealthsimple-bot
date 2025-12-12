import type { FmtString } from "node_modules/telegraf/typings/format";
import type { ExtraReplyMessage } from "node_modules/telegraf/typings/telegram-types";
import { db } from "@/lib/db/db";
import { tables } from "@/lib/db/schemas";

export async function sendMessageToAllSessions(
  message: string | FmtString,
  extra?: ExtraReplyMessage,
) {
  const sessions = await db.select().from(tables.sessions);

  return Promise.allSettled(
    sessions.map((session) =>
      globalThis.bot?.telegram.sendMessage(session.key, message, extra),
    ),
  );
}
