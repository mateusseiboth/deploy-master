/** Tipos de job suportados pela fila. */
export const JobType = {
  DEPLOY: "deploy",
  CLEANUP: "cleanup",
  BACKUP: "backup",
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export interface Job<TPayload = unknown> {
  id: string;
  type: JobType;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
}

export interface EnqueueOptions {
  maxAttempts?: number;
  /** Atraso antes de o job ficar elegível (ms). */
  delayMs?: number;
}

/** Visão de um job para monitoramento da fila (sem reservar/alterar). */
export interface QueueJobView {
  id: string;
  type: JobType;
  status: string; // pending | active | completed | failed
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedBy: string | null;
  runAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Port da fila de jobs persistente. Abstrai o backend (SQLite) — Services
 * dependem desta interface, não da implementação (DIP). Sem Redis (ADR-007).
 */
export interface IJobQueue {
  enqueue<T>(type: JobType, payload: T, options?: EnqueueOptions): string;
  /** Reserva atomicamente o próximo job elegível para um worker. */
  claim(workerId: string): Job | null;
  complete(jobId: string): void;
  /** Incrementa tentativas; reagenda com backoff ou marca como failed. */
  retryOrFail(jobId: string, error: string): void;
  /** Lista os jobs recentes para monitoramento (não reserva nem altera). */
  list(limit?: number): QueueJobView[];
}
