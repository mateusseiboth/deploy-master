import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";

export interface CountByKey {
  key: string;
  count: number;
}

/** Agregações de leitura para o dashboard (somente consultas). */
@Injectable()
export class DashboardDAO extends BaseDAO {
  async countByStatus(): Promise<Record<string, number>> {
    const grouped = await this.tx.environment.groupBy({ by: ["status"], _count: { _all: true } });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  }

  async deploysByProject(): Promise<CountByKey[]> {
    const grouped = await this.tx.environment.groupBy({ by: ["projectId"], _count: { _all: true } });
    return grouped.map((g) => ({ key: g.projectId, count: g._count._all }));
  }

  async deploysByUser(): Promise<CountByKey[]> {
    const grouped = await this.tx.environment.groupBy({ by: ["creatorId"], _count: { _all: true } });
    return grouped.map((g) => ({ key: g.creatorId, count: g._count._all }));
  }
}
