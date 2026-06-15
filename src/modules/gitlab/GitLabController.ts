import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { BadRequestError } from "@core/errors/AppError";
import type { HttpResult } from "@core/http/HttpResult";
import { GitLabService } from "./GitLabService";

/** Navegação GitLab para o fluxo de criação (projeto → branch → commit). */
@Injectable()
export class GitLabController extends BaseController {
  constructor(private readonly service: GitLabService) {
    super();
  }

  /** Lista os projetos do GitLab pelo token geral (cadastro de projetos). */
  async listProjects(): Promise<HttpResult> {
    return this.ok(await this.service.listGlobalProjects());
  }

  async validateToken(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.validateAccess(this.param(req, "id")));
  }

  async branches(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.listBranches(this.param(req, "id")));
  }

  async commits(req: Request): Promise<HttpResult> {
    const branch = req.query.branch;
    if (typeof branch !== "string" || !branch) {
      throw new BadRequestError("Parâmetro 'branch' é obrigatório");
    }
    return this.ok(await this.service.listCommits(this.param(req, "id"), branch));
  }

  async commitDetail(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.getCommit(this.param(req, "id"), this.param(req, "hash")));
  }

  async pipeline(req: Request): Promise<HttpResult> {
    const ref = req.query.ref;
    if (typeof ref !== "string" || !ref) {
      throw new BadRequestError("Parâmetro 'ref' é obrigatório");
    }
    return this.ok(await this.service.getPipeline(this.param(req, "id"), ref));
  }
}
