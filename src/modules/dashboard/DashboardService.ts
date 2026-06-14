import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { DashboardDAO, type CountByKey } from "./DashboardDAO";

export interface DashboardIndicators {
  active: number;
  expiring: number;
  expired: number;
  failed: number;
  byStatus: Record<string, number>;
  deploysByProject: CountByKey[];
  deploysByUser: CountByKey[];
}

/** Monta os indicadores do dashboard a partir das agregações. */
@Injectable()
export class DashboardService extends BaseService {
  constructor(private readonly dao: DashboardDAO) {
    super();
  }

  async indicators(): Promise<DashboardIndicators> {
    const [byStatus, deploysByProject, deploysByUser] = await Promise.all([
      this.dao.countByStatus(),
      this.dao.deploysByProject(),
      this.dao.deploysByUser(),
    ]);

    return {
      active: byStatus.READY ?? 0,
      expiring: byStatus.EXPIRING ?? 0,
      expired: byStatus.EXPIRED ?? 0,
      failed: byStatus.FAILED ?? 0,
      byStatus,
      deploysByProject,
      deploysByUser,
    };
  }
}
