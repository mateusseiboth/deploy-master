import { BackupSource } from "@prisma-generated/enums";
import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IDatabaseProvisionStrategy } from "@modules/deploy/domain/strategies/database/IDatabaseProvisionStrategy";
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
  constructor(private readonly strategy: IDatabaseProvisionStrategy) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    ctx.log(`Provisionando banco isolado (origem: ${SOURCE_LABELS[ctx.request.databaseSource]})`);
    const { databaseName, databaseUrl } = await this.strategy.provision(ctx);
    ctx.databaseName = databaseName;
    ctx.databaseUrl = databaseUrl;
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    await this.strategy.drop(ctx);
  }
}
