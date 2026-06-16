import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { BadRequestError } from "@core/errors/AppError";
import type { HttpResult } from "@core/http/HttpResult";
import { ProductionBackupService } from "./ProductionBackupService";
import { backupConfigSchema } from "./backupSchemas";
import type { ProductionBackupLog } from "@prisma-generated/client";

/**
 * Backups de banco. Dois fluxos:
 *  - `upload`: recebe o .sql/.sql.gz do ambiente (multer) e devolve o caminho.
 *  - produção: dispara/lista backups POR BANCO e gerencia o agendamento.
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

  /** Dispara backup manual de todos os bancos habilitados (enfileirado). */
  async triggerProduction(): Promise<HttpResult> {
    const count = await this.production.enqueueAll("MANUAL");
    return this.accepted({ message: `Backup enfileirado para ${count} banco(s)`, count });
  }

  /** Dispara backup manual de UM banco específico. */
  triggerDatabase(req: Request): HttpResult {
    const databaseName = req.params.database as string;
    this.production.enqueue("MANUAL", databaseName);
    return this.accepted({ message: `Backup de ${databaseName} enfileirado` });
  }

  /** Lista as execuções de backup (automáticas e manuais), por banco. */
  async listProduction(): Promise<HttpResult> {
    const logs = await this.production.listLogs();
    return this.ok(logs.map(serializeLog));
  }

  /** Backups concluídos disponíveis para o QA escolher (origem do banco). */
  async listAvailable(): Promise<HttpResult> {
    const logs = await this.production.listAvailable();
    return this.ok(logs.map(serializeLog));
  }

  /** Lista os bancos do servidor com seu agendamento (tela de configuração). */
  async listConfigs(): Promise<HttpResult> {
    const configs = await this.production.listDatabaseConfigs();
    return this.ok(configs);
  }

  /** Salva (upsert) o agendamento de backup de um banco. */
  async upsertConfig(req: Request): Promise<HttpResult> {
    const databaseName = req.params.database as string;
    const dto = backupConfigSchema.parse(req.body);
    const saved = await this.production.upsertConfig(databaseName, dto);
    return this.ok(saved);
  }
}

/** BigInt não é serializável em JSON: converte `sizeBytes` para number. */
function serializeLog(log: ProductionBackupLog) {
  return {
    ...log,
    sizeBytes: log.sizeBytes !== null ? Number(log.sizeBytes) : null,
  };
}
