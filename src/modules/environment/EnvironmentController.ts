import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import type { HttpResult } from "@core/http/HttpResult";
import { EnvironmentService, type CreateEnvironmentDTO } from "./EnvironmentService";
import type { RenewDTO } from "./environmentSchemas";
import type { EnvironmentStatus } from "@prisma-generated/enums";

/**
 * Controller HTTP de ambientes. O body já chega validado pelo `validateBody`
 * (antes da transação); aqui apenas delega ao Service.
 */
@Injectable()
export class EnvironmentController extends BaseController {
  constructor(private readonly service: EnvironmentService) {
    super();
  }

  async create(req: Request): Promise<HttpResult> {
    return this.created(await this.service.create(req.body as CreateEnvironmentDTO));
  }

  async list(req: Request): Promise<HttpResult> {
    const status = req.query.status as EnvironmentStatus | undefined;
    const projectId = req.query.projectId as string | undefined;
    return this.ok(await this.service.list({ status, projectId }));
  }

  async getById(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.getById(this.param(req, "id")));
  }

  async renew(req: Request): Promise<HttpResult> {
    const { days } = req.body as RenewDTO;
    return this.ok(await this.service.renew(this.param(req, "id"), days));
  }

  async restart(req: Request): Promise<HttpResult> {
    await this.service.restart(this.param(req, "id"));
    return this.ok({ restarted: true });
  }

  async remove(req: Request): Promise<HttpResult> {
    await this.service.remove(this.param(req, "id"));
    return this.noContent();
  }
}
