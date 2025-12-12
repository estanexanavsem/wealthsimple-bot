import type { Database, Statement } from "bun:sqlite";
import type { SyncSessionStore } from "node_modules/telegraf/typings/session";

export class BunSqliteStore<T> implements SyncSessionStore<T> {
  private selectStmt!: Statement<{ value: string }>;
  private upsertStmt!: Statement;
  private deleteStmt!: Statement;

  constructor(db: Database) {
    db.run(
      "CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
    this.selectStmt = db.query<{ value: string }, [string]>(
      "SELECT value FROM sessions WHERE key = ?1",
    );
    this.upsertStmt = db.query(
      "INSERT INTO sessions (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );
    this.deleteStmt = db.query("DELETE FROM sessions WHERE key = ?1");
  }

  get(name: string): T | undefined {
    const row = this.selectStmt.get(name);
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  set(name: string, value: T): void {
    this.upsertStmt.run(name, JSON.stringify(value));
  }

  delete(name: string): void {
    this.deleteStmt.run(name);
  }
}
