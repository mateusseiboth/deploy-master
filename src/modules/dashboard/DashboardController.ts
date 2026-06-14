import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { DashboardService } from "./DashboardService";

/** Indicadores agregados do sistema. */
@Injectable()
export class DashboardController extends BaseController {
  constructor(private readonly service: DashboardService) {
    super();
  }

  async indicators(_req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.indicators());
  }
}
