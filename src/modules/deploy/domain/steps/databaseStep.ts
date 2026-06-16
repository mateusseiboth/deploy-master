import { randomUUID } from "crypto";
import { BackupSource } from "@prisma-generated/enums";
import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IDatabaseProvisionStrategy } from "@modules/deploy/domain/strategies/database/IDatabaseProvisionStrategy";
import type { PostgresAdmin } from "@modules/database/PostgresAdmin";
import { DeployStep } from "./IDeployStep";

/** Rótulos legíveis da origem do banco (para o progresso). */
const SOURCE_LABELS: Record<BackupSource, string> = {
  [BackupSource.UPLOAD]: "arquivo enviado",
  [BackupSource.STORED_BACKUP]: "backup salvo",
  [BackupSource.PRODUCTION_COPY]: "cópia de produção",
  [BackupSource.HOMOLOGATION_COPY]: "cópia de homologação",
};

/**
 * Provisiona o banco isolado do ambiente (cria + restaura backup) delegando à
 * estratégia escolhida (upload .sql ou cópia de produção). Cada ambiente possui
 * seu próprio banco — nenhum compartilhamento.
 */
export class ProvisionDatabaseStep extends DeployStep {
  readonly name = "ProvisionDatabase";
  readonly label = "Provisionando banco isolado";
  constructor(
    private readonly strategy: IDatabaseProvisionStrategy,
    private readonly pg: PostgresAdmin,
  ) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    const appUser = ctx.project.appDbUser?.trim();
    let appPassword = "";

    // Usuário de aplicação (RLS): criado ANTES da cópia para que as policies da
    // origem (`CREATE POLICY ... TO <user>`) sejam restauradas com sucesso.
    if (appUser) {
      appPassword = randomUUID().replace(/-/g, "");
      ctx.log(`Garantindo usuário de aplicação "${appUser}" (sujeito a RLS)…`);
      await this.pg.ensureLoginRole(appUser, appPassword);
    }

    ctx.log(`Provisionando banco isolado (origem: ${SOURCE_LABELS[ctx.request.databaseSource]})`);
    const { databaseName, databaseUrl } = await this.strategy.provision(ctx);
    ctx.databaseName = databaseName;

    if (appUser) {
      // Concede DML ao usuário no banco copiado; como ele NÃO é dono das tabelas,
      // continua sujeito a RLS. O container conecta com ele (não com o admin).
      await this.pg.grantDatabaseAccess(databaseName, appUser);
      ctx.databaseUrl = await this.pg.buildUrlFor(databaseName, appUser, appPassword);
      ctx.log(`DATABASE_URL apontará para o usuário "${appUser}" (RLS ativo).`);
    } else {
      ctx.databaseUrl = databaseUrl;
    }
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    await this.strategy.drop(ctx);
  }
}
