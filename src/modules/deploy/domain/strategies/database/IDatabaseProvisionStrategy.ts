import type { DeployContext } from "@modules/deploy/domain/DeployContext";

export interface ProvisionedDatabase {
  databaseName: string;
  /** URL de conexão a ser injetada como DATABASE_URL no container. */
  databaseUrl: string;
}

/**
 * Estratégia de provisionamento do banco isolado do ambiente.
 * Cada ambiente possui seu próprio banco — nenhum compartilhamento.
 */
export interface IDatabaseProvisionStrategy {
  /** Cria o banco isolado e restaura o conteúdo (upload ou cópia de produção). */
  provision(ctx: DeployContext): Promise<ProvisionedDatabase>;
  /** Remove o banco isolado (rollback / cleanup). */
  drop(ctx: DeployContext): Promise<void>;
}
