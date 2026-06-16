import { spawn } from "child_process";
import { createWriteStream } from "fs";
import { networkInterfaces } from "os";
import { createGzip } from "zlib";
import { exec, pipe } from "@core/process/exec";
import { env } from "@config/env";
import { Injectable } from "@di/Injectable";
import { DockerService } from "@modules/docker/DockerService";

/** Endereço resolvido do servidor Postgres efêmero (host + porta). */
interface ServerAddress {
  host: string;
  port: number;
}

function isLoopback(host: string): boolean {
  return !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** 1º IPv4 não-interno das interfaces de rede (IP de LAN do host). */
function detectHostIp(): string | undefined {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return undefined;
}

/**
 * Adapter de administração do PostgreSQL para os bancos efêmeros dos ambientes.
 * Encapsula createdb/dropdb/psql/pg_dump (única responsabilidade: operações
 * administrativas de banco). Não contém regra de negócio.
 *
 * Servidor efêmero: quando `managed`, o sistema SOBE um container Postgres
 * compartilhado sob demanda numa porta livre aleatória (descoberta via Docker) e
 * todos os ambientes criam `db_<hash>` nele. Quando não-managed, usa um Postgres
 * externo fixo (`EPHEMERAL_PG_HOST/PORT`).
 */
@Injectable()
export class PostgresAdmin {
  constructor(private readonly docker: DockerService) {}

  // Memoiza a resolução do servidor (sobe o container 1x e descobre a porta).
  private serverPromise?: Promise<ServerAddress>;

  private get adminEnv(): Record<string, string> {
    return { PGPASSWORD: env.ephemeralPg.adminPassword };
  }

  /** Garante o servidor efêmero no ar e devolve seu host/porta (memoizado). */
  private ensureServer(): Promise<ServerAddress> {
    if (!this.serverPromise) {
      this.serverPromise = this.resolveServer().catch((err) => {
        // Não memoiza falha: permite nova tentativa no próximo deploy.
        this.serverPromise = undefined;
        throw err;
      });
    }
    return this.serverPromise;
  }

  private async resolveServer(): Promise<ServerAddress> {
    const { managed, host, port, containerName, image, adminUser, adminPassword } = env.ephemeralPg;
    if (!managed) return { host, port };

    const assignedPort = await this.docker.ensurePostgres({
      containerName,
      image,
      user: adminUser,
      password: adminPassword,
    });
    // O Postgres é publicado numa porta do host. Containers (app/build) não
    // alcançam "localhost" — usa o IP de LAN do host (auto-detectado quando o
    // EPHEMERAL_PG_HOST não foi configurado), para a URL servir worker+app+build.
    const effectiveHost = isLoopback(host) ? detectHostIp() ?? host : host;
    if (effectiveHost !== host) {
      console.log(`[pg] EPHEMERAL_PG_HOST=${host} não é alcançável por containers; usando ${effectiveHost}`);
    }
    const address: ServerAddress = { host: effectiveHost, port: assignedPort };
    await this.waitReady(address);
    return address;
  }

  /** Aguarda o Postgres aceitar conexões (após subir o container). */
  private async waitReady(address: ServerAddress, attempts = 30): Promise<void> {
    const url = `postgresql://${env.ephemeralPg.adminUser}:${env.ephemeralPg.adminPassword}@${address.host}:${address.port}/postgres`;
    for (let i = 0; i < attempts; i++) {
      if (await this.canConnect(url)) return;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Postgres efêmero não respondeu em ${address.host}:${address.port}`);
  }

  private async baseArgs(): Promise<string[]> {
    const { host, port } = await this.ensureServer();
    return ["-h", host, "-p", String(port), "-U", env.ephemeralPg.adminUser];
  }

  /** URL de conexão para o banco informado, no servidor efêmero. */
  async buildUrl(databaseName: string): Promise<string> {
    const { host, port } = await this.ensureServer();
    const { adminUser, adminPassword } = env.ephemeralPg;
    return `postgresql://${adminUser}:${adminPassword}@${host}:${port}/${databaseName}`;
  }

  async createDatabase(databaseName: string): Promise<void> {
    // idempotente: ignora erro de "já existe"
    const result = await exec("createdb", [...(await this.baseArgs()), databaseName], {
      env: this.adminEnv,
      allowFailure: true,
    });
    if (result.code !== 0 && !/already exists/i.test(result.stderr)) {
      throw new Error(`Falha ao criar banco ${databaseName}: ${result.stderr}`);
    }
  }

  async dropDatabase(databaseName: string): Promise<void> {
    await exec("dropdb", [...(await this.baseArgs()), "--if-exists", "--force", databaseName], {
      env: this.adminEnv,
      allowFailure: true,
    });
  }

  /** Restaura um dump .sql (texto). Para .sql.gz, descompacte antes. */
  async restoreFromSqlFile(databaseName: string, sqlFilePath: string): Promise<void> {
    await exec("psql", [...(await this.baseArgs()), "-d", databaseName, "-f", sqlFilePath], {
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
      { command: "psql", args: [...(await this.baseArgs()), "-d", targetDatabase] },
      { env: this.adminEnv },
    );
  }

  /** Testa conectividade com um banco (health check). */
  async canConnect(databaseUrl: string): Promise<boolean> {
    const result = await exec("psql", [databaseUrl, "-tAc", "SELECT 1"], { allowFailure: true });
    return result.code === 0 && result.stdout.trim() === "1";
  }

  /**
   * Lista os bancos do servidor (exclui templates e bancos sem conexão).
   * `serverUrl` é uma connection string para qualquer banco do servidor.
   */
  async listDatabases(serverUrl: string): Promise<string[]> {
    const result = await exec(
      "psql",
      [serverUrl, "-tAc", "SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname"],
    );
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((name) => name.length > 0);
  }

  /** Troca o nome do banco no path de uma connection string. */
  withDatabase(serverUrl: string, databaseName: string): string {
    const url = new URL(serverUrl);
    url.pathname = `/${databaseName}`;
    return url.toString();
  }

  /** Gera um dump SQL completo de um banco para `outFilePath` (pg_dump). */
  async dumpToFile(serverUrl: string, databaseName: string, outFilePath: string): Promise<void> {
    await exec("pg_dump", [
      "--no-owner",
      "--no-acl",
      "-f", outFilePath,
      this.withDatabase(serverUrl, databaseName),
    ]);
  }

  /**
   * Gera um dump SQL e grava comprimido (gzip) em `outFilePath` (.sql.gz),
   * encadeando `pg_dump` → zlib → arquivo em STREAMING (sem .sql intermediário).
   * O restore lida com `.gz` via `gunzipToSql` (database strategies).
   */
  dumpToGzipFile(serverUrl: string, databaseName: string, outFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        "pg_dump",
        ["--no-owner", "--no-acl", this.withDatabase(serverUrl, databaseName)],
        { env: process.env },
      );

      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

      const gzip = createGzip();
      const out = createWriteStream(outFilePath);
      const fail = (err: Error) => reject(err);

      child.on("error", fail);
      gzip.on("error", fail);
      out.on("error", fail);

      child.stdout.pipe(gzip).pipe(out);

      child.on("close", (code) => {
        if (code !== 0) {
          out.destroy();
          reject(new Error(`pg_dump de ${databaseName} falhou [${code}]: ${stderr}`));
        }
      });
      out.on("finish", () => resolve());
    });
  }
}
