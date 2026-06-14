import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { AuditDAO } from "./AuditDAO";
import type { AuditAction } from "@prisma-generated/enums";

export interface AuditEntry {
  action: AuditAction;
  environmentId?: string;
  projectId?: string;
  commitHash?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Serviço de auditoria. Centraliza o registro das ações capturando usuário e IP
 * do contexto da request (CLAUDE.md: auditoria completa). Reutilizado por todos
 * os fluxos que precisam deixar trilha.
 */
@Injectable()
export class AuditService extends BaseService {
  constructor(private readonly dao: AuditDAO) {
    super();
  }

  listByEnvironment(environmentId: string) {
    return this.dao.listByEnvironment(environmentId);
  }

  async record(entry: AuditEntry): Promise<void> {
    await this.dao.create({
      action: entry.action,
      environment: entry.environmentId ? { connect: { id: entry.environmentId } } : undefined,
      projectId: entry.projectId,
      commitHash: entry.commitHash,
      ipAddress: this.ipAddress,
      metadata: (entry.metadata ?? undefined) as never,
      user: this.currentUser ? { connect: { id: this.currentUser.id } } : undefined,
    });
  }
}
