import chalk from "chalk";
import { db } from "@/lib/db/db";
import { tables } from "@/lib/db/schemas";

export async function logAllSessions() {
  console.log(chalk.yellow("🔍 Loading sessions..."));

  const sessions = await db.select().from(tables.sessions);

  if (!sessions.length) {
    console.log(chalk.yellow("🔍 No sessions found"));
    return;
  }

  console.table(
    sessions.map((session) => ({
      key: session.key,
      value: JSON.parse(session.value),
    })),
  );

  console.log(chalk.yellow(`📦 Loaded ${sessions.length} sessions`));
}
