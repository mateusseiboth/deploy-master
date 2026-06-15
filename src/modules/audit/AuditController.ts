import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import type { HttpResult } from "@core/http/HttpResult";
import { AuditService } from "./AuditService";

/** Consulta da trilha de auditoria de um ambiente. */
@Injectable()
export class AuditController extends BaseController {
  constructor(private readonly service: AuditService) {
    super();
  }

  async listByEnvironment(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.listByEnvironment(this.param(req, "id")));
  }
}
