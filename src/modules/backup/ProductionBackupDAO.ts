import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { ProductionBackupLog } from "@prisma-generated/client";
import type { BackupRunStatus, BackupTrigger } from "@prisma-generated/enums";

/** Persistência dos logs de execução do backup de produção (um log por banco). */
@Injectable()
export class ProductionBackupDAO extends BaseDAO {
  create(data: {
    databaseName: string;
    trigger: BackupTrigger;
    filePath: string;
  }): Promise<ProductionBackupLog> {
    return this.tx.productionBackupLog.create({ data });
  }

  finish(
    id: string,
    data: { status: BackupRunStatus; sizeBytes?: bigint; message?: string | null },
  ): Promise<ProductionBackupLog> {
    return this.tx.productionBackupLog.update({
      where: { id },
      data: {
        status: data.status,
        sizeBytes: data.sizeBytes,
        message: data.message ?? undefined,
        finishedAt: new Date(),
      },
    });
  }

  list(limit = 50): Promise<ProductionBackupLog[]> {
    return this.tx.productionBackupLog.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  /** Backups concluídos com sucesso e com arquivo (origem do banco do ambiente). */
  listAvailable(limit = 50): Promise<ProductionBackupLog[]> {
    return this.tx.productionBackupLog.findMany({
      where: { status: "SUCCESS", filePath: { not: null } },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }
}
