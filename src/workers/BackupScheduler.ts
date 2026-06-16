import dayjs, { type Dayjs } from "dayjs";
import { Injectable } from "@di/Injectable";
import { runInTransaction } from "@core/transaction/withTransaction";
import { SettingsService } from "@modules/settings/SettingsService";
import { ProductionBackupService } from "@modules/backup/ProductionBackupService";
import { BackupConfigDAO } from "@modules/backup/BackupConfigDAO";
import type { BackupDatabaseConfig } from "@prisma-generated/client";

/**
 * Agenda o backup automático POR BANCO do PostgreSQL de produção. A cada tick lê
 * as configs habilitadas e, para cada banco, calcula a última ocorrência agendada
 * (frequência + hora) — se ainda não foi rodada, enfileira (trigger AUTOMATIC) e
 * marca `lastRunAt`. Não executa o dump aqui — só enfileira (o worker processa).
 */
@Injectable()
export class BackupScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly settings: SettingsService,
    private readonly backups: ProductionBackupService,
    private readonly configs: BackupConfigDAO,
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

      const enabled = await runInTransaction(() => this.configs.listEnabled());
      const now = dayjs();

      for (const config of enabled) {
        const occurrence = lastOccurrence(config, now);
        if (!occurrence) continue;
        const lastRun = config.lastRunAt ? dayjs(config.lastRunAt) : null;
        if (lastRun && !lastRun.isBefore(occurrence)) continue;

        // Marca antes de enfileirar para não duplicar no próximo tick.
        await runInTransaction(() => this.configs.touchLastRun(config.databaseName, now.toDate()));
        this.backups.enqueue("AUTOMATIC", config.databaseName);
        console.log(`[cron] backup automático de ${config.databaseName} enfileirado`);
      }
    } catch (err) {
      console.error("[cron] falha ao agendar backup:", (err as Error).message);
    }
  }
}

/**
 * Última ocorrência agendada (≤ agora) de um banco, conforme a frequência:
 *  - DAILY: hoje na hora; se ainda não chegou, ontem.
 *  - WEEKLY: o `dayOfWeek` mais recente na hora.
 *  - MONTHLY: o `dayOfMonth` mais recente na hora.
 * Retorna null quando faltam parâmetros (ex.: WEEKLY sem dayOfWeek).
 */
function lastOccurrence(config: BackupDatabaseConfig, now: Dayjs): Dayjs | null {
  const atHour = (day: Dayjs) => day.hour(config.hourOfDay).minute(0).second(0).millisecond(0);

  if (config.frequency === "DAILY") {
    const today = atHour(now);
    return today.isAfter(now) ? today.subtract(1, "day") : today;
  }

  if (config.frequency === "WEEKLY") {
    if (config.dayOfWeek == null) return null;
    let candidate = atHour(now).day(config.dayOfWeek);
    if (candidate.isAfter(now)) candidate = candidate.subtract(1, "week");
    return candidate;
  }

  // MONTHLY
  if (config.dayOfMonth == null) return null;
  const day = Math.min(config.dayOfMonth, now.daysInMonth());
  let candidate = atHour(now).date(day);
  if (candidate.isAfter(now)) {
    const prev = now.subtract(1, "month");
    candidate = atHour(prev).date(Math.min(config.dayOfMonth, prev.daysInMonth()));
  }
  return candidate;
}
