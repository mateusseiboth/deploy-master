import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IDatabaseProvisionStrategy } from "@modules/deploy/domain/strategies/database/IDatabaseProvisionStrategy";
import { DeployStep } from "./IDeployStep";

/**
 * Provisiona o banco isolado do ambiente (cria + restaura backup) delegando à
 * estratégia escolhida (upload .sql ou cópia de produção). Cada ambiente possui
 * seu próprio banco — nenhum compartilhamento.
 */
export class ProvisionDatabaseStep extends DeployStep {
  readonly name = "ProvisionDatabase";
  constructor(private readonly strategy: IDatabaseProvisionStrategy) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    ctx.log(`Provisionando banco isolado (${ctx.project.databaseStrategy})`);
    const { databaseName, databaseUrl } = await this.strategy.provision(ctx);
    ctx.databaseName = databaseName;
    ctx.databaseUrl = databaseUrl;
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    await this.strategy.drop(ctx);
  }
}
