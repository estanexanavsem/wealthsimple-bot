import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BOT_TOKEN: z.string(),

    PORT: z
      .string()
      .default("8080")
      .transform((val) => Number(val)),

    DB_PATH: z.string().default("telegram.db"),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
  },

  clientPrefix: "PUBLIC_",
  client: {},

  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
