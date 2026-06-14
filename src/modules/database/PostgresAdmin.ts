import { exec, pipe } from "@core/process/exec";
import { env } from "@config/env";
import { Injectable } from "@di/Injectable";

/**
 * Adapter de administração do PostgreSQL para os bancos efêmeros dos ambientes.
 * Encapsula createdb/dropdb/psql/pg_dump (única responsabilidade: operações
 * administrativas de banco). Não contém regra de negócio.
 */
@Injectable()
export class PostgresAdmin {
  private get adminEnv(): Record<string, string> {
    return { PGPASSWORD: env.ephemeralPg.adminPassword };
  }

  private baseArgs(): string[] {
    return [
      "-h", env.ephemeralPg.host,
      "-p", String(env.ephemeralPg.port),
      "-U", env.ephemeralPg.adminUser,
    ];
  }

  /** URL de conexão para o banco informado, no servidor efêmero. */
  buildUrl(databaseName: string): string {
    const { host, port, adminUser, adminPassword } = env.ephemeralPg;
    return `postgresql://${adminUser}:${adminPassword}@${host}:${port}/${databaseName}`;
  }

  async createDatabase(databaseName: string): Promise<void> {
    // idempotente: ignora erro de "já existe"
    const result = await exec("createdb", [...this.baseArgs(), databaseName], {
      env: this.adminEnv,
      allowFailure: true,
    });
    if (result.code !== 0 && !/already exists/i.test(result.stderr)) {
      throw new Error(`Falha ao criar banco ${databaseName}: ${result.stderr}`);
    }
  }

  async dropDatabase(databaseName: string): Promise<void> {
    await exec("dropdb", [...this.baseArgs(), "--if-exists", "--force", databaseName], {
      env: this.adminEnv,
      allowFailure: true,
    });
  }

  /** Restaura um dump .sql (texto). Para .sql.gz, descompacte antes. */
  async restoreFromSqlFile(databaseName: string, sqlFilePath: string): Promise<void> {
    await exec("psql", [...this.baseArgs(), "-d", databaseName, "-f", sqlFilePath], {
      env: this.adminEnv,
    });
  }

  /**
   * Copia o banco de produção para o banco efêmero via `pg_dump | psql` em
   * STREAMING (sem arquivo intermediário). `sourceUrl` aponta para produção
   * (recomenda-se usuário read-only).
   */
  async copyFromProduction(sourceUrl: string, targetDatabase: string): Promise<void> {
    await pipe(
      { command: "pg_dump", args: ["--no-owner", "--no-acl", sourceUrl] },
      { command: "psql", args: [...this.baseArgs(), "-d", targetDatabase] },
      { env: this.adminEnv },
    );
  }

  /** Testa conectividade com um banco (health check). */
  async canConnect(databaseUrl: string): Promise<boolean> {
    const result = await exec("psql", [databaseUrl, "-tAc", "SELECT 1"], { allowFailure: true });
    return result.code === 0 && result.stdout.trim() === "1";
  }
}
