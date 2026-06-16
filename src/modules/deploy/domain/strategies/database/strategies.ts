import { createGunzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import { DeployError } from "@core/errors/AppError";
import type { PostgresAdmin } from "@modules/database/PostgresAdmin";
import type {
  IDatabaseProvisionStrategy,
  ProvisionedDatabase,
} from "./IDatabaseProvisionStrategy";

/** Nome do banco isolado derivado do slug do ambiente (idempotente). */
function databaseNameFor(ctx: DeployContext): string {
  return `db_${ctx.slug.replace(/-/g, "_")}`;
}

/** Descompacta .sql.gz para um .sql temporário e retorna o caminho. */
async function gunzipToSql(gzPath: string): Promise<string> {
  const outPath = gzPath.replace(/\.gz$/i, "");
  await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(outPath));
  return outPath;
}

/** Opção 1 — QA envia arquivo .sql / .sql.gz. */
export class UploadSqlDatabaseStrategy implements IDatabaseProvisionStrategy {
  constructor(private readonly pg: PostgresAdmin) {}

  async provision(ctx: DeployContext): Promise<ProvisionedDatabase> {
    const filePath = ctx.request.backupFilePath;
    if (!filePath) {
      throw new DeployError("Backup .sql não informado para estratégia UPLOAD_SQL", "ProvisionDatabase");
    }

    const databaseName = databaseNameFor(ctx);
    await this.pg.createDatabase(databaseName);

    const sqlPath = filePath.toLowerCase().endsWith(".gz")
      ? await gunzipToSql(filePath)
      : filePath;
    await this.pg.restoreFromSqlFile(databaseName, sqlPath);

    return { databaseName, databaseUrl: await this.pg.buildUrl(databaseName) };
  }

  async drop(ctx: DeployContext): Promise<void> {
    await this.pg.dropDatabase(databaseNameFor(ctx));
  }
}

/**
 * Opção 2 — copia, no momento do deploy, um banco de origem (produção ou
 * homologação). A origem é resolvida do contexto pelo `resolveSourceUrl`, então
 * a mesma estratégia atende às duas origens (parametrização > duplicação).
 */
export class CopyDatabaseStrategy implements IDatabaseProvisionStrategy {
  constructor(
    private readonly pg: PostgresAdmin,
    private readonly sourceLabel: string,
    private readonly resolveSourceUrl: (ctx: DeployContext) => string | null | undefined,
  ) {}

  async provision(ctx: DeployContext): Promise<ProvisionedDatabase> {
    const sourceUrl = this.resolveSourceUrl(ctx);
    if (!sourceUrl) {
      throw new DeployError(
        `URL do banco de ${this.sourceLabel} não configurada no projeto`,
        "ProvisionDatabase",
      );
    }

    const databaseName = databaseNameFor(ctx);
    // Slate limpo: dropa restos de tentativas anteriores (ex.: cópia que falhou
    // no meio) — senão `createdb` ignora "já existe" e a cópia herda lixo, o que
    // faz o `migrate deploy` do build bater em "type already exists".
    await this.pg.dropDatabase(databaseName);
    await this.pg.createDatabase(databaseName);

    // Cópia COMPLETA (schema + dados + `_prisma_migrations`): o ambiente fica
    // idêntico à origem e o `prisma migrate deploy` do build vira NO-OP (todas as
    // migrations já constam como aplicadas) — não tenta recriar tipos/tabelas.
    ctx.log(`Iniciando cópia completa do banco de ${this.sourceLabel} (pg_dump → ${databaseName})…`);
    await this.pg.copyFromProduction(sourceUrl, databaseName, (line) => ctx.log(line));
    ctx.log(`Cópia do banco de ${this.sourceLabel} concluída.`);

    return { databaseName, databaseUrl: await this.pg.buildUrl(databaseName) };
  }

  async drop(ctx: DeployContext): Promise<void> {
    await this.pg.dropDatabase(databaseNameFor(ctx));
  }
}
