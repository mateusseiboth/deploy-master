import { Injectable } from "@di/Injectable";
import { runInTransaction } from "@core/transaction/withTransaction";
import { SettingsService } from "@modules/settings/SettingsService";
import { ProductionBackupService } from "@modules/backup/ProductionBackupService";

/**
 * Agenda o backup automático completo do PostgreSQL de produção. A cada tick
 * lê as configurações (habilitado? intervalo?) e, respeitando o intervalo desde
 * a última execução automática, enfileira um job de backup (trigger AUTOMATIC).
 * Não executa o dump aqui — só enfileira (o worker processa).
 */
@Injectable()
export class BackupScheduler {
  private timer?: ReturnType<typeof setInterval>;
  private lastRunAt = 0;

  constructor(
    private readonly settings: SettingsService,
    private readonly backups: ProductionBackupService,
  ) {}

  start(checkIntervalMs = 5 * 60_000): void {
    console.log(`[cron] backup de produção verificado a cada ${checkIntervalMs}ms`);
    this.timer = setInterval(() => {
      void this.runOnce();
    }, checkIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    try {
      const settings = await runInTransaction(() => this.settings.get());
      if (!settings.prodBackupEnabled) return;
      if (!settings.prodBackupDbUrl || !settings.prodBackupDir) return;

      const intervalMs = Math.max(settings.prodBackupIntervalHours, 1) * 3_600_000;
      if (Date.now() - this.lastRunAt < intervalMs) return;

      this.lastRunAt = Date.now();
      this.backups.enqueue("AUTOMATIC");
      console.log("[cron] backup de produção automático enfileirado");
    } catch (err) {
      console.error("[cron] falha ao agendar backup:", (err as Error).message);
    }
  }
}
