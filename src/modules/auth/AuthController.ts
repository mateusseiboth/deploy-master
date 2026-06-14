import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { UnauthorizedError } from "@core/errors/AppError";
import { AuthService, type Credentials, type RegisterDTO } from "./AuthService";

/** Controller de autenticação. Body já validado por `validateBody`. */
@Injectable()
export class AuthController extends BaseController {
  constructor(private readonly service: AuthService) {
    super();
  }

  async register(req: Request, res: Response): Promise<void> {
    this.created(res, await this.service.register(req.body as RegisterDTO));
  }

  async login(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.login(req.body as Credentials));
  }

  async refresh(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.refresh((req.body as { refreshToken: string }).refreshToken));
  }

  async logout(req: Request, res: Response): Promise<void> {
    await this.service.logout((req.body as { refreshToken: string }).refreshToken);
    this.noContent(res);
  }

  me(req: Request & { user?: unknown }, res: Response): void {
    if (!req.user) throw new UnauthorizedError("Não autenticado");
    this.ok(res, req.user);
  }
}
