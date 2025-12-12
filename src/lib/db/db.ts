import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "@/env";

export const driver = new Database(env.DB_PATH);
export const db = drizzle(driver);

// Run migrations on startup
migrate(db, { migrationsFolder: "./drizzle" });
