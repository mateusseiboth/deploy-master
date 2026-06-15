import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import type { HttpResult } from "@core/http/HttpResult";
import { DashboardService } from "./DashboardService";

/** Indicadores agregados do sistema. */
@Injectable()
export class DashboardController extends BaseController {
  constructor(private readonly service: DashboardService) {
    super();
  }

  async indicators(): Promise<HttpResult> {
    return this.ok(await this.service.indicators());
  }
}
