import { join } from "path";
import { mkdir, stat } from "fs/promises";
import dayjs from "dayjs";
import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { BadRequestError } from "@core/errors/AppError";
import { runInTransaction } from "@core/transaction/withTransaction";
import { SqliteJobQueue } from "@core/queue/SqliteJobQueue";
import { JobType } from "@core/queue/IJobQueue";
import { PostgresAdmin } from "@modules/database/PostgresAdmin";
import { SettingsService } from "@modules/settings/SettingsService";
import { ProductionBackupDAO } from "./ProductionBackupDAO";
import { BackupConfigDAO, type BackupConfigInput } from "./BackupConfigDAO";
import type { ProductionBackupLog } from "@prisma-generated/client";
import type { BackupFrequency, BackupTrigger } from "@prisma-generated/enums";

/** Banco descoberto na URL configurada, com seu agendamento (ou defaults). */
export interface BackupDatabaseConfigView {
  databaseName: string;
  enabled: boolean;
  frequency: BackupFrequency;
  hourOfDay: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  lastRunAt: Date | null;
  /** false quando o banco existe só na config mas sumiu do servidor. */
  present: boolean;
}

/**
 * Backup do servidor PostgreSQL de produção, POR BANCO. O agendamento de cada
 * banco vive em BackupDatabaseConfig; cada execução gera um log (automático x
 * solicitado) com tamanho, status e tempos. O dump roda FORA de transação; as
 * escritas de log ficam em transações curtas (padrão dos job handlers).
 */
@Injectable()
export class ProductionBackupService extends BaseService {
  constructor(
    private readonly dao: ProductionBackupDAO,
    private readonly configs: BackupConfigDAO,
    private readonly settings: SettingsService,
    private readonly postgres: PostgresAdmin,
    private readonly queue: SqliteJobQueue,
  ) {
    super();
  }

  /** Enfileira o backup de UM banco (rota manual ou scheduler). */
  enqueue(trigger: BackupTrigger, databaseName: string): void {
    this.queue.enqueue(JobType.BACKUP, { trigger, databaseName });
  }

  /** Enfileira o backup de todos os bancos habilitados (botão "Rodar agora"). */
  async enqueueAll(trigger: BackupTrigger): Promise<number> {
    const enabled = await this.configs.listEnabled();
    for (const config of enabled) this.enqueue(trigger, config.databaseName);
    return enabled.length;
  }

  listLogs(): Promise<ProductionBackupLog[]> {
    return this.dao.list();
  }

  /** Backups concluídos disponíveis para o QA escolher como origem do banco. */
  listAvailable(): Promise<ProductionBackupLog[]> {
    return this.dao.listAvailable();
  }

  /**
   * Lista os bancos do servidor configurado cruzados com o agendamento salvo.
   * Bancos sem config aparecem com defaults (e `present: true`); configs órfãs
   * (banco sumiu do servidor) aparecem com `present: false`.
   */
  async listDatabaseConfigs(): Promise<BackupDatabaseConfigView[]> {
    const settings = await runInTransaction(() => this.settings.get());
    if (!settings.prodBackupDbUrl) {
      throw new BadRequestError("Configure a conexão do Postgres de produção (URL) primeiro");
    }

    const [databases, stored] = await Promise.all([
      this.postgres.listDatabases(settings.prodBackupDbUrl),
      runInTransaction(() => this.configs.list()),
    ]);

    const byName = new Map(stored.map((config) => [config.databaseName, config]));
    const views: BackupDatabaseConfigView[] = databases.map((databaseName) => {
      const config = byName.get(databaseName);
      return {
        databaseName,
        enabled: config?.enabled ?? false,
        frequency: config?.frequency ?? "DAILY",
        hourOfDay: config?.hourOfDay ?? 2,
        dayOfWeek: config?.dayOfWeek ?? null,
        dayOfMonth: config?.dayOfMonth ?? null,
        lastRunAt: config?.lastRunAt ?? null,
        present: true,
      };
    });

    // Configs cujo banco não existe mais no servidor (visíveis para o admin limpar).
    for (const config of stored) {
      if (databases.includes(config.databaseName)) continue;
      views.push({
        databaseName: config.databaseName,
        enabled: config.enabled,
        frequency: config.frequency,
        hourOfDay: config.hourOfDay,
        dayOfWeek: config.dayOfWeek,
        dayOfMonth: config.dayOfMonth,
        lastRunAt: config.lastRunAt,
        present: false,
      });
    }

    return views.sort((a, b) => a.databaseName.localeCompare(b.databaseName));
  }

  upsertConfig(databaseName: string, input: BackupConfigInput) {
    return runInTransaction(() => this.configs.upsert(databaseName, input));
  }

  /**
   * Executa o backup de UM banco. Deve ser chamado SEM transação ambiente
   * (job handler): abre as próprias transações curtas para os logs.
   */
  async runDatabase(trigger: BackupTrigger, databaseName: string): Promise<void> {
    const settings = await runInTransaction(() => this.settings.get());
    if (!settings.prodBackupDbUrl || !settings.prodBackupDir) {
      throw new BadRequestError(
        "Backup de produção não configurado (defina a URL do banco e a pasta destino nas Configurações)",
      );
    }

    const now = dayjs();
    // Layout: <dir>/YYYY/<banco>/MM/<banco>_<data>.sql.gz
    const dir = join(settings.prodBackupDir, now.format("YYYY"), databaseName, now.format("MM"));
    const file = join(dir, `${databaseName}_${now.format("YYYY-MM-DD_HH-mm-ss")}.sql.gz`);
    await mkdir(dir, { recursive: true });

    const log = await runInTransaction(() => this.dao.create({ databaseName, trigger, filePath: file }));

    try {
      await this.postgres.dumpToGzipFile(settings.prodBackupDbUrl, databaseName, file);
      const { size } = await stat(file);
      await runInTransaction(() =>
        this.dao.finish(log.id, { status: "SUCCESS", sizeBytes: BigInt(size) }),
      );
    } catch (err) {
      await runInTransaction(() =>
        this.dao.finish(log.id, { status: "FAILED", message: (err as Error).message }),
      );
      throw err;
    }
  }
}
