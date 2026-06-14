import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { AuditService } from "./AuditService";

/** Consulta da trilha de auditoria de um ambiente. */
@Injectable()
export class AuditController extends BaseController {
  constructor(private readonly service: AuditService) {
    super();
  }

  async listByEnvironment(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.listByEnvironment(this.param(req, "id")));
  }
}
