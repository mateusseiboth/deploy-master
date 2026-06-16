import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { BackupDatabaseConfig } from "@prisma-generated/client";
import type { BackupFrequency } from "@prisma-generated/enums";

/** Dados editáveis do agendamento de backup de um banco. */
export interface BackupConfigInput {
  enabled: boolean;
  frequency: BackupFrequency;
  hourOfDay: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}

/** Persistência do agendamento de backup POR BANCO (BackupDatabaseConfig). */
@Injectable()
export class BackupConfigDAO extends BaseDAO {
  list(): Promise<BackupDatabaseConfig[]> {
    return this.tx.backupDatabaseConfig.findMany({ orderBy: { databaseName: "asc" } });
  }

  listEnabled(): Promise<BackupDatabaseConfig[]> {
    return this.tx.backupDatabaseConfig.findMany({ where: { enabled: true } });
  }

  upsert(databaseName: string, data: BackupConfigInput): Promise<BackupDatabaseConfig> {
    const values = {
      enabled: data.enabled,
      frequency: data.frequency,
      hourOfDay: data.hourOfDay,
      dayOfWeek: data.dayOfWeek ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
    };
    return this.tx.backupDatabaseConfig.upsert({
      where: { databaseName },
      create: { databaseName, ...values },
      update: values,
    });
  }

  touchLastRun(databaseName: string, lastRunAt: Date): Promise<BackupDatabaseConfig> {
    return this.tx.backupDatabaseConfig.update({
      where: { databaseName },
      data: { lastRunAt },
    });
  }
}
