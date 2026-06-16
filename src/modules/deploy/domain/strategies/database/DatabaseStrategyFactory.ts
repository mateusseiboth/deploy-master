import { BackupSource } from "@prisma-generated/enums";
import { Injectable } from "@di/Injectable";
import { PostgresAdmin } from "@modules/database/PostgresAdmin";
import type { IDatabaseProvisionStrategy } from "./IDatabaseProvisionStrategy";
import {
  CopyDatabaseStrategy,
  UploadSqlDatabaseStrategy,
} from "./strategies";

/**
 * Factory das estratégias de banco. A escolha é feita pela ORIGEM selecionada no
 * deploy (`BackupSource`), não pelo padrão do projeto — o QA decide por ambiente
 * de onde o banco vem. Recebe o `PostgresAdmin` via DI e o injeta na estratégia.
 */
@Injectable()
export class DatabaseStrategyFactory {
  constructor(private readonly pg: PostgresAdmin) {}

  create(source: BackupSource): IDatabaseProvisionStrategy {
    const strategies: Record<BackupSource, () => IDatabaseProvisionStrategy> = {
      // Upload e backup salvo são, ambos, restauração de um arquivo .sql/.sql.gz.
      [BackupSource.UPLOAD]: () => new UploadSqlDatabaseStrategy(this.pg),
      [BackupSource.STORED_BACKUP]: () => new UploadSqlDatabaseStrategy(this.pg),
      [BackupSource.PRODUCTION_COPY]: () =>
        new CopyDatabaseStrategy(this.pg, "produção", (ctx) => ctx.project.productionDbUrl),
      [BackupSource.HOMOLOGATION_COPY]: () =>
        new CopyDatabaseStrategy(this.pg, "homologação", (ctx) => ctx.project.homologationDbUrl),
    };

    const build = strategies[source];
    if (!build) throw new Error(`Origem de banco não suportada: ${source}`);
    return build();
  }
}
