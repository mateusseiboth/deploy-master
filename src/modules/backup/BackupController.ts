import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { BadRequestError } from "@core/errors/AppError";
import type { HttpResult } from "@core/http/HttpResult";
import { ProductionBackupService } from "./ProductionBackupService";
import type { ProductionBackupLog } from "@prisma-generated/client";

/**
 * Backups de banco. Dois fluxos:
 *  - `upload`: recebe o .sql/.sql.gz do ambiente (multer) e devolve o caminho.
 *  - produção: dispara/lista o backup completo do servidor PostgreSQL de produção.
 */
@Injectable()
export class BackupController extends BaseController {
  constructor(private readonly production: ProductionBackupService) {
    super();
  }

  upload(req: Request): HttpResult {
    const file = req.file;
    if (!file) throw new BadRequestError("Arquivo de backup ausente ou formato inválido (.sql/.sql.gz)");
    return this.created({ filePath: file.path, sizeBytes: file.size, originalName: file.originalname });
  }

  /** Dispara um backup de produção manual (enfileirado; trigger MANUAL). */
  triggerProduction(): HttpResult {
    this.production.enqueue("MANUAL");
    return this.accepted({ message: "Backup de produção enfileirado" });
  }

  /** Lista as execuções de backup de produção (automáticas e manuais). */
  async listProduction(): Promise<HttpResult> {
    const logs = await this.production.listLogs();
    return this.ok(logs.map(serializeLog));
  }
}

/** BigInt não é serializável em JSON: converte `totalBytes` para number. */
function serializeLog(log: ProductionBackupLog) {
  return {
    ...log,
    totalBytes: log.totalBytes !== null ? Number(log.totalBytes) : null,
  };
}
