import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { BadRequestError } from "@core/errors/AppError";
import { GitLabService } from "./GitLabService";

/** Navegação GitLab para o fluxo de criação (projeto → branch → commit). */
@Injectable()
export class GitLabController extends BaseController {
  constructor(private readonly service: GitLabService) {
    super();
  }

  async validateToken(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.validateAccess(this.param(req, "id")));
  }

  async branches(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.listBranches(this.param(req, "id")));
  }

  async commits(req: Request, res: Response): Promise<void> {
    const branch = req.query.branch;
    if (typeof branch !== "string" || !branch) {
      throw new BadRequestError("Parâmetro 'branch' é obrigatório");
    }
    this.ok(res, await this.service.listCommits(this.param(req, "id"), branch));
  }

  async commitDetail(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.getCommit(this.param(req, "id"), this.param(req, "hash")));
  }

  async pipeline(req: Request, res: Response): Promise<void> {
    const ref = req.query.ref;
    if (typeof ref !== "string" || !ref) {
      throw new BadRequestError("Parâmetro 'ref' é obrigatório");
    }
    this.ok(res, await this.service.getPipeline(this.param(req, "id"), ref));
  }
}
