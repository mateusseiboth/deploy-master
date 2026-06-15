import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { Prisma, ProductionBackupLog } from "@prisma-generated/client";
import type { BackupRunStatus, BackupTrigger } from "@prisma-generated/enums";

/** Detalhe por banco gravado em `databases` (Json). */
export interface BackupDatabaseResult {
  name: string;
  file: string;
  sizeBytes?: number;
  ok: boolean;
  error?: string;
}

/** Persistência dos logs de execução do backup de produção. */
@Injectable()
export class ProductionBackupDAO extends BaseDAO {
  create(data: { trigger: BackupTrigger; directory: string }): Promise<ProductionBackupLog> {
    return this.tx.productionBackupLog.create({ data });
  }

  finish(
    id: string,
    data: {
      status: BackupRunStatus;
      databases?: BackupDatabaseResult[];
      totalBytes?: bigint;
      message?: string | null;
    },
  ): Promise<ProductionBackupLog> {
    return this.tx.productionBackupLog.update({
      where: { id },
      data: {
        status: data.status,
        databases: (data.databases ?? undefined) as Prisma.InputJsonValue | undefined,
        totalBytes: data.totalBytes,
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
}
