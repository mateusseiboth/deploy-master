import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { Prisma, AuditLog } from "@prisma-generated/client";

/** Persistência da trilha de auditoria (somente escrita/consulta). */
@Injectable()
export class AuditDAO extends BaseDAO {
  async create(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return this.tx.auditLog.create({ data });
  }

  async listByEnvironment(environmentId: string): Promise<AuditLog[]> {
    return this.tx.auditLog.findMany({
      where: { environmentId },
      orderBy: { createdAt: "desc" },
    });
  }
}
