import { Injectable } from "@di/Injectable";
import { JobType } from "@core/queue/IJobQueue";
import { ProductionBackupService } from "@modules/backup/ProductionBackupService";
import type { BackupTrigger } from "@prisma-generated/enums";
import type { IJobHandler } from "./IJobHandler";

interface BackupPayload {
  trigger: BackupTrigger;
  databaseName: string;
}

/**
 * Processa um job de backup de UM banco de produção. O service gerencia as
 * próprias transações (logs) e roda o dump fora de transação.
 */
@Injectable()
export class BackupJobHandler implements IJobHandler<BackupPayload> {
  readonly type = JobType.BACKUP;

  constructor(private readonly backups: ProductionBackupService) {}

  async handle(payload: BackupPayload): Promise<void> {
    await this.backups.runDatabase(payload.trigger, payload.databaseName);
  }
}
