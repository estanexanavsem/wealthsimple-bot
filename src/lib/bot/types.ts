import type { Context } from "telegraf";

export type SessionData = {
  joinedAt?: number;
  createdAt?: number;
  lastSeenAt?: number;
};

export type BotContext = Context & {
  session?: SessionData;
  args?: string[];
  command?: string;
  payload?: string;
};
