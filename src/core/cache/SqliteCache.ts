import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import type { ICache } from "./ICache";

interface CacheRow {
  value: string;
  expires_at: number | null;
}

/** Cache persistente em SQLite (sobrevive a restart do processo). */
export class SqliteCache implements ICache {
  private readonly db: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER
      );
    `);
  }

  get<T>(key: string): T | undefined {
    const row = this.db.query<CacheRow, [string]>(`SELECT value, expires_at FROM cache WHERE key = ?`).get(key);
    if (!row) return undefined;
    if (row.expires_at !== null && row.expires_at <= Date.now()) {
      this.delete(key);
      return undefined;
    }
    return JSON.parse(row.value) as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.db
      .query(`INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES ($k, $v, $e)`)
      .run({ $k: key, $v: JSON.stringify(value), $e: ttlMs ? Date.now() + ttlMs : null });
  }

  delete(key: string): void {
    this.db.query(`DELETE FROM cache WHERE key = ?`).run(key);
  }

  deleteByPrefix(prefix: string): void {
    this.db.query(`DELETE FROM cache WHERE key LIKE ?`).run(`${prefix}%`);
  }

  clear(): void {
    this.db.exec(`DELETE FROM cache`);
  }
}
