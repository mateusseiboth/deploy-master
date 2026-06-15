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
import { ProductionBackupDAO, type BackupDatabaseResult } from "./ProductionBackupDAO";
import type { ProductionBackupLog } from "@prisma-generated/client";
import type { BackupTrigger } from "@prisma-generated/enums";

/**
 * Backup completo do servidor PostgreSQL de produção: roda um `pg_dump` de TODOS
 * os bancos do servidor configurado e grava na pasta destino. Cada execução gera
 * um log (automático x solicitado) com status e detalhamento por banco.
 *
 * O trabalho pesado (dumps) roda FORA de transação; as escritas de log são
 * isoladas em transações curtas (padrão dos job handlers).
 */
@Injectable()
export class ProductionBackupService extends BaseService {
  constructor(
    private readonly dao: ProductionBackupDAO,
    private readonly settings: SettingsService,
    private readonly postgres: PostgresAdmin,
    private readonly queue: SqliteJobQueue,
  ) {
    super();
  }

  /** Enfileira uma execução de backup (usado pela rota manual e pelo scheduler). */
  enqueue(trigger: BackupTrigger): void {
    this.queue.enqueue(JobType.BACKUP, { trigger });
  }

  listLogs(): Promise<ProductionBackupLog[]> {
    return this.dao.list();
  }

  /**
   * Executa o backup. Deve ser chamado SEM transação ambiente (job handler):
   * abre as próprias transações curtas para os logs.
   */
  async run(trigger: BackupTrigger): Promise<void> {
    const settings = await runInTransaction(() => this.settings.get());
    if (!settings.prodBackupDbUrl || !settings.prodBackupDir) {
      throw new BadRequestError(
        "Backup de produção não configurado (defina a URL do banco e a pasta destino nas Configurações)",
      );
    }

    const dir = join(settings.prodBackupDir, dayjs().format("YYYY-MM-DD_HH-mm-ss"));
    await mkdir(dir, { recursive: true });

    const log = await runInTransaction(() => this.dao.create({ trigger, directory: dir }));

    try {
      const databases = await this.postgres.listDatabases(settings.prodBackupDbUrl);
      const results: BackupDatabaseResult[] = [];
      let totalBytes = 0n;

      for (const name of databases) {
        const file = join(dir, `${name}.sql`);
        try {
          await this.postgres.dumpToFile(settings.prodBackupDbUrl, name, file);
          const { size } = await stat(file);
          totalBytes += BigInt(size);
          results.push({ name, file, sizeBytes: size, ok: true });
        } catch (err) {
          results.push({ name, file, ok: false, error: (err as Error).message });
        }
      }

      const failed = results.filter((r) => !r.ok);
      await runInTransaction(() =>
        this.dao.finish(log.id, {
          status: failed.length > 0 ? "FAILED" : "SUCCESS",
          databases: results,
          totalBytes,
          message: failed.length > 0 ? `${failed.length} banco(s) falharam` : null,
        }),
      );
    } catch (err) {
      await runInTransaction(() =>
        this.dao.finish(log.id, { status: "FAILED", message: (err as Error).message }),
      );
      throw err;
    }
  }
}
