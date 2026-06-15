import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { UnauthorizedError } from "@core/errors/AppError";
import type { HttpResult } from "@core/http/HttpResult";
import { AuthService, type Credentials, type RegisterDTO } from "./AuthService";

/** Controller de autenticação. Body já validado por `validateBody`. */
@Injectable()
export class AuthController extends BaseController {
  constructor(private readonly service: AuthService) {
    super();
  }

  async register(req: Request): Promise<HttpResult> {
    return this.created(await this.service.register(req.body as RegisterDTO));
  }

  async login(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.login(req.body as Credentials));
  }

  async refresh(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.refresh((req.body as { refreshToken: string }).refreshToken));
  }

  async logout(req: Request): Promise<HttpResult> {
    await this.service.logout((req.body as { refreshToken: string }).refreshToken);
    return this.noContent();
  }

  me(req: Request & { user?: unknown }): HttpResult {
    if (!req.user) throw new UnauthorizedError("Não autenticado");
    return this.ok(req.user);
  }
}
