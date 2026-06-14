import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { env } from "@config/env";
import { Injectable } from "@di/Injectable";
import {
  type EnqueueOptions,
  type IJobQueue,
  type Job,
  type JobType,
} from "./IJobQueue";

interface JobRow {
  id: string;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_at: number;
  locked_at: number | null;
  locked_by: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Fila de jobs persistida em SQLite (`bun:sqlite`). Single-writer com reserva
 * atômica via `BEGIN IMMEDIATE` + `UPDATE ... RETURNING`. Backoff exponencial
 * simples no retry. Responsabilidade única: persistência/coordenação de jobs.
 */
@Injectable()
export class SqliteJobQueue implements IJobQueue {
  private readonly db: Database;

  constructor() {
    mkdirSync(dirname(env.queue.dbPath), { recursive: true });
    this.db = new Database(env.queue.dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        run_at INTEGER NOT NULL,
        locked_at INTEGER,
        locked_by TEXT,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs (status, run_at);");
  }

  enqueue<T>(type: JobType, payload: T, options: EnqueueOptions = {}): string {
    const now = Date.now();
    const id = randomUUID();
    this.db
      .query(
        `INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
         VALUES ($id, $type, $payload, 'pending', 0, $max, $runAt, $now, $now)`,
      )
      .run({
        $id: id,
        $type: type,
        $payload: JSON.stringify(payload ?? null),
        $max: options.maxAttempts ?? 3,
        $runAt: now + (options.delayMs ?? 0),
        $now: now,
      });
    return id;
  }

  claim(workerId: string): Job | null {
    const now = Date.now();
    const tx = this.db.transaction(() => {
      const row = this.db
        .query<JobRow, [number]>(
          `SELECT * FROM jobs WHERE status = 'pending' AND run_at <= ?
           ORDER BY run_at ASC LIMIT 1`,
        )
        .get(now);
      if (!row) return null;

      this.db
        .query(
          `UPDATE jobs SET status='active', locked_at=$now, locked_by=$worker,
             attempts=attempts+1, updated_at=$now WHERE id=$id`,
        )
        .run({ $now: now, $worker: workerId, $id: row.id });
      return { ...row, attempts: row.attempts + 1 };
    });

    const row = tx() as JobRow | null;
    if (!row) return null;
    return {
      id: row.id,
      type: row.type as JobType,
      payload: JSON.parse(row.payload),
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    };
  }

  complete(jobId: string): void {
    this.db
      .query(`UPDATE jobs SET status='completed', updated_at=$now WHERE id=$id`)
      .run({ $now: Date.now(), $id: jobId });
  }

  retryOrFail(jobId: string, error: string): void {
    const now = Date.now();
    const row = this.db.query<JobRow, [string]>(`SELECT * FROM jobs WHERE id = ?`).get(jobId);
    if (!row) return;

    const exhausted = row.attempts >= row.max_attempts;
    if (exhausted) {
      this.db
        .query(`UPDATE jobs SET status='failed', last_error=$err, updated_at=$now WHERE id=$id`)
        .run({ $err: error, $now: now, $id: jobId });
      return;
    }

    const backoffMs = Math.min(60_000, 2 ** row.attempts * 1000);
    this.db
      .query(
        `UPDATE jobs SET status='pending', locked_at=NULL, locked_by=NULL,
           last_error=$err, run_at=$runAt, updated_at=$now WHERE id=$id`,
      )
      .run({ $err: error, $runAt: now + backoffMs, $now: now, $id: jobId });
  }
}
