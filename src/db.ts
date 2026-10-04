import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export function createDb(memory = true) {
  const sqlite = new Database(memory ? ":memory:" : "local.db");
  
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS sync_mutations (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  
  return drizzle(sqlite, { schema });
}
