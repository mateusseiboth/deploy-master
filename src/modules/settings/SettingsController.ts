import type { Request } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import type { HttpResult } from "@core/http/HttpResult";
import { SettingsService, type UpdateSettingsDTO } from "./SettingsService";

/** Configurações do sistema (leitura para autenticados; escrita só ADMIN). */
@Injectable()
export class SettingsController extends BaseController {
  constructor(private readonly service: SettingsService) {
    super();
  }

  async get(): Promise<HttpResult> {
    return this.ok(await this.service.get());
  }

  async update(req: Request): Promise<HttpResult> {
    return this.ok(await this.service.update(req.body as UpdateSettingsDTO));
  }
}
