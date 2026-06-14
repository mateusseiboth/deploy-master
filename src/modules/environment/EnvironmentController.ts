import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
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

  async create(req: Request, res: Response): Promise<void> {
    const environment = await this.service.create(req.body as CreateEnvironmentDTO);
    this.created(res, environment);
  }

  async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as EnvironmentStatus | undefined;
    const projectId = req.query.projectId as string | undefined;
    this.ok(res, await this.service.list({ status, projectId }));
  }

  async getById(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.getById(this.param(req, "id")));
  }

  async renew(req: Request, res: Response): Promise<void> {
    const { days } = req.body as RenewDTO;
    this.ok(res, await this.service.renew(this.param(req, "id"), days));
  }

  async restart(req: Request, res: Response): Promise<void> {
    await this.service.restart(this.param(req, "id"));
    this.ok(res, { restarted: true });
  }

  async remove(req: Request, res: Response): Promise<void> {
    await this.service.remove(this.param(req, "id"));
    this.noContent(res);
  }
}
