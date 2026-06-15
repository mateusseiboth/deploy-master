import { randomUUID } from "crypto";
import { Injectable } from "@di/Injectable";
import { SqliteJobQueue } from "@core/queue/SqliteJobQueue";
import type { JobType } from "@core/queue/IJobQueue";
import type { IJobHandler } from "./IJobHandler";
import { DeployJobHandler } from "./DeployJobHandler";
import { CleanupJobHandler } from "./CleanupJobHandler";
import { BackupJobHandler } from "./BackupJobHandler";

/**
 * Runtime consumidor da fila. Faz polling, reserva o próximo job e despacha para
 * o handler registrado por tipo (Strategy). Em falha, delega o backoff/retry à
 * fila. Roda como processo separado (`bun run worker`).
 */
@Injectable()
export class Worker {
  private readonly id = `worker-${randomUUID().slice(0, 8)}`;
  private readonly handlers: Map<JobType, IJobHandler>;
  private running = false;

  constructor(
    private readonly queue: SqliteJobQueue,
    deployHandler: DeployJobHandler,
    cleanupHandler: CleanupJobHandler,
    backupHandler: BackupJobHandler,
  ) {
    this.handlers = new Map<JobType, IJobHandler>([
      [deployHandler.type, deployHandler],
      [cleanupHandler.type, cleanupHandler],
      [backupHandler.type, backupHandler],
    ]);
  }

  /** Inicia o loop de polling até `stop()`. */
  async start(pollIntervalMs = 1000): Promise<void> {
    this.running = true;
    console.log(`[${this.id}] worker iniciado (poll ${pollIntervalMs}ms)`);
    while (this.running) {
      const processed = await this.tick();
      if (!processed) await this.sleep(pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
  }

  /** Processa um job, se houver. Retorna true se algo foi processado. */
  async tick(): Promise<boolean> {
    const job = this.queue.claim(this.id);
    if (!job) return false;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.queue.retryOrFail(job.id, `Sem handler para o tipo ${job.type}`);
      return true;
    }

    try {
      await handler.handle(job.payload);
      this.queue.complete(job.id);
      console.log(`[${this.id}] job ${job.type} ${job.id} concluído`);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.queue.retryOrFail(job.id, message);
      console.error(`[${this.id}] job ${job.type} ${job.id} falhou: ${message}`);
    }
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
