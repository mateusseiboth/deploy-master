import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { ProjectService, type CreateProjectDTO } from "./ProjectService";
import type { AddVariableDTO } from "./projectSchemas";

/**
 * Controller HTTP de projetos (Painel Admin). Body já validado por `validateBody`.
 */
@Injectable()
export class ProjectController extends BaseController {
  constructor(private readonly service: ProjectService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    this.created(res, await this.service.create(req.body as CreateProjectDTO));
  }

  async list(_req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.list());
  }

  async getById(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.getById(this.param(req, "id")));
  }

  async addVariable(req: Request, res: Response): Promise<void> {
    this.created(res, await this.service.addVariable(this.param(req, "id"), req.body as AddVariableDTO));
  }

  async removeVariable(req: Request, res: Response): Promise<void> {
    await this.service.removeVariable(this.param(req, "id"), this.param(req, "key"));
    this.noContent(res);
  }
}
