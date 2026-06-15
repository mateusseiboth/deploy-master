import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { Cache } from "@core/cache/Cache";
import { env } from "@config/env";
import { SettingsDAO } from "./SettingsDAO";
import type { SystemSettings } from "@prisma-generated/client";

export interface UpdateSettingsDTO {
  piholeBaseUrl?: string;
  piholePassword?: string;
  reverseProxyIp?: string;
  traefikNetwork?: string;
  baseDomain?: string;
  gitlabBaseUrl?: string;
  gitlabApiToken?: string;
  prodBackupDbUrl?: string;
  prodBackupDir?: string;
  prodBackupIntervalHours?: number;
  prodBackupEnabled?: boolean;
}

/**
 * Configurações do sistema (Pi-hole e proxy reverso) cadastráveis pelo ADMIN.
 * Fonte de verdade é o banco; o `.env` serve apenas como semente inicial quando
 * a linha ainda não existe. Cacheado para uso no pipeline.
 */
@Injectable()
export class SettingsService extends BaseService {
  private static readonly CACHE_KEY = "settings:system";

  constructor(
    private readonly dao: SettingsDAO,
    private readonly cache: Cache,
  ) {
    super();
  }

  /** Retorna as configurações, criando a linha com defaults do env na 1ª vez. */
  async get(): Promise<SystemSettings> {
    const cached = this.cache.get<SystemSettings>(SettingsService.CACHE_KEY);
    if (cached) return cached;

    const existing = await this.dao.find();
    const settings = existing ?? (await this.dao.upsert({
      piholeBaseUrl: env.dns.piholeBaseUrl,
      piholePassword: env.dns.piholePassword,
      reverseProxyIp: env.dns.reverseProxyIp,
      traefikNetwork: env.docker.traefikNetwork,
      baseDomain: env.proxy.baseDomain,
      gitlabBaseUrl: env.gitlab.baseUrl,
      gitlabApiToken: env.gitlab.apiToken,
      prodBackupDbUrl: env.backup.prodDbUrl,
      prodBackupDir: env.backup.prodDir,
      prodBackupIntervalHours: env.backup.prodIntervalHours,
      prodBackupEnabled: env.backup.prodEnabled,
    }));

    this.cache.set(SettingsService.CACHE_KEY, settings, 30_000);
    return settings;
  }

  async update(dto: UpdateSettingsDTO): Promise<SystemSettings> {
    const updated = await this.dao.upsert(dto);
    this.cache.delete(SettingsService.CACHE_KEY);
    return updated;
  }
}
