import { DatabaseStrategy } from "@prisma-generated/enums";
import { Injectable } from "@di/Injectable";
import { PostgresAdmin } from "@modules/database/PostgresAdmin";
import type { IDatabaseProvisionStrategy } from "./IDatabaseProvisionStrategy";
import {
  CopyProductionDatabaseStrategy,
  UploadSqlDatabaseStrategy,
} from "./strategies";

/**
 * Factory das estratégias de banco. Recebe o `PostgresAdmin` via DI e o injeta
 * na estratégia escolhida — o pipeline pede a estratégia sem conhecer detalhes.
 */
@Injectable()
export class DatabaseStrategyFactory {
  constructor(private readonly pg: PostgresAdmin) {}

  create(strategy: DatabaseStrategy): IDatabaseProvisionStrategy {
    switch (strategy) {
      case DatabaseStrategy.UPLOAD_SQL:
        return new UploadSqlDatabaseStrategy(this.pg);
      case DatabaseStrategy.COPY_PRODUCTION:
        return new CopyProductionDatabaseStrategy(this.pg);
      default:
        throw new Error(`DatabaseStrategy não suportada: ${strategy}`);
    }
  }
}
