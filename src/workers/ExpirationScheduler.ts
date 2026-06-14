import { Injectable } from "@di/Injectable";
import { runInTransaction } from "@core/transaction/withTransaction";
import { EnvironmentService } from "@modules/environment/EnvironmentService";

/**
 * Cron de expiração automática. Periodicamente, em transação, delega ao
 * EnvironmentService a marcação de ambientes EXPIRING/EXPIRED e o enfileiramento
 * do cleanup. Sem intervenção manual (CLAUDE.md: cleanup automático).
 */
@Injectable()
export class ExpirationScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly environments: EnvironmentService) {}

  start(intervalMs = 60_000): void {
    console.log(`[cron] expiração agendada a cada ${intervalMs}ms`);
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    try {
      const result = await runInTransaction(() => this.environments.processExpirations());
      if (result.expiring || result.expired) {
        console.log(`[cron] expiring=${result.expiring} expired=${result.expired}`);
      }
    } catch (err) {
      console.error("[cron] falha ao processar expirações:", (err as Error).message);
    }
  }
}
