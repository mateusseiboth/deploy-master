import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { Prisma, Environment } from "@prisma-generated/client";
import type { EnvironmentStatus } from "@prisma-generated/enums";

/** Environment com relacionamentos usados na listagem/detalhe. */
export type EnvironmentDetailed = Prisma.EnvironmentGetPayload<{
  include: {
    project: true;
    creator: true;
    variableValues: true;
    services: true;
    backup: true;
  };
}>;

/** Persistência de Ambientes efêmeros (aggregate root). */
@Injectable()
export class EnvironmentDAO extends BaseDAO {
  async create(data: Prisma.EnvironmentCreateInput): Promise<Environment> {
    return this.tx.environment.create({ data });
  }

  async findById(id: string): Promise<EnvironmentDetailed | null> {
    return this.tx.environment.findUnique({
      where: { id },
      include: { project: true, creator: true, variableValues: true, services: true, backup: true },
    });
  }

  async list(filter: { status?: EnvironmentStatus; projectId?: string } = {}): Promise<EnvironmentDetailed[]> {
    return this.tx.environment.findMany({
      where: { status: filter.status, projectId: filter.projectId },
      include: { project: true, creator: true, variableValues: true, services: true, backup: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(id: string, data: Prisma.EnvironmentUpdateInput): Promise<Environment> {
    return this.tx.environment.update({ where: { id }, data });
  }

  /**
   * Compare-and-set atômico de status (lock de concorrência cross-process).
   * Transiciona `from`→`to` apenas se o status atual for `from`. Retorna true se
   * a transição ocorreu (ou seja, este processo "ganhou" o ambiente).
   */
  async casStatus(id: string, from: EnvironmentStatus, to: EnvironmentStatus): Promise<boolean> {
    const result = await this.tx.environment.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    return result.count > 0;
  }

  /** Ambiente ativo (não removido/falho) para um mesmo project+commit (idempotência). */
  async findActiveByProjectCommit(projectId: string, commitHash: string): Promise<Environment | null> {
    return this.tx.environment.findFirst({
      where: {
        projectId,
        commitHash,
        status: { notIn: ["REMOVED", "FAILED"] },
      },
    });
  }

  /** Ambientes READY/EXPIRING cuja validade já venceu (para o cron). */
  async findExpired(now: Date): Promise<Environment[]> {
    return this.tx.environment.findMany({
      where: {
        status: { in: ["READY", "EXPIRING"] },
        expiresAt: { lte: now },
      },
    });
  }

  /** Ambientes READY que entram na janela de aviso de expiração. */
  async findExpiring(threshold: Date): Promise<Environment[]> {
    return this.tx.environment.findMany({
      where: {
        status: "READY",
        expiresAt: { lte: threshold, gt: new Date() },
      },
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const grouped = await this.tx.environment.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  }
}
