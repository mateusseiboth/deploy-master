import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import type { HttpResult } from "@core/http/HttpResult";
import { ProjectService, type CreateProjectDTO, type UpdateProjectDTO } from "./ProjectService";
import type { AddVariableDTO } from "./projectSchemas";

/**
 * Controller HTTP de projetos (Painel Admin). Body já validado por `validateBody`.
 */
@Injectable()
export class ProjectController extends BaseController {
  constructor(private readonly service: ProjectService) {
    super();
  }

  async create(req: Request): Promise<HttpResult> {
    return this.created(await this.service.create(req.body as CreateProjectDTO));
  }

  async list(): Promise<HttpResult> {
    return this.ok(await this.service.list());
  }

  async getById(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.getById(this.param(req, "id")));
  }

  async update(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.update(this.param(req, "id"), req.body as UpdateProjectDTO));
  }

  async addVariable(req: Request): Promise<HttpResult> {
    return this.created(await this.service.addVariable(this.param(req, "id"), req.body as AddVariableDTO));
  }

  async removeVariable(req: Request): Promise<HttpResult> {
    await this.service.removeVariable(this.param(req, "id"), this.param(req, "key"));
    return this.noContent();
  }
}
