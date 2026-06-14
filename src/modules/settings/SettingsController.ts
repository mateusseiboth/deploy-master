import type { Request, Response } from "express";
import { Injectable } from "@di/Injectable";
import { BaseController } from "@core/base/BaseController";
import { SettingsService, type UpdateSettingsDTO } from "./SettingsService";

/** Configurações do sistema (leitura para autenticados; escrita só ADMIN). */
@Injectable()
export class SettingsController extends BaseController {
  constructor(private readonly service: SettingsService) {
    super();
  }

  async get(_req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.get());
  }

  async update(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.service.update(req.body as UpdateSettingsDTO));
  }
}
