import { Injectable } from "@di/Injectable";
import { BaseDAO } from "@core/base/BaseDAO";
import type { Prisma, SystemSettings } from "@prisma-generated/client";

const SINGLETON_ID = "singleton";

/** Persistência da linha única de configurações do sistema. */
@Injectable()
export class SettingsDAO extends BaseDAO {
  find(): Promise<SystemSettings | null> {
    return this.tx.systemSettings.findUnique({ where: { id: SINGLETON_ID } });
  }

  upsert(data: Prisma.SystemSettingsUpdateInput): Promise<SystemSettings> {
    return this.tx.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...(data as Prisma.SystemSettingsCreateInput) },
    });
  }
}
