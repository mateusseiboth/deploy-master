import { spawn } from "child_process";

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Não rejeita em exit code != 0; retorna o resultado para o chamador decidir. */
  allowFailure?: boolean;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runner único e reutilizável de processos externos (git, psql, pg_dump...).
 * Centraliza captura de stdout/stderr e merge do ambiente (DRY).
 */
/**
 * Encadeia dois processos via pipe (stdout do produtor → stdin do consumidor),
 * sem arquivo intermediário. Usado para `pg_dump | psql` em streaming.
 */
export function pipe(
  producer: { command: string; args: string[] },
  consumer: { command: string; args: string[] },
  options: ExecOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...options.env };
    const src = spawn(producer.command, producer.args, { env });
    const dst = spawn(consumer.command, consumer.args, { env });

    let stderr = "";
    src.stderr.on("data", (c) => (stderr += c.toString()));
    dst.stderr.on("data", (c) => (stderr += c.toString()));

    src.stdout.pipe(dst.stdin);
    src.on("error", reject);
    dst.on("error", reject);
    dst.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`pipe ${producer.command} | ${consumer.command} falhou [${code}]: ${stderr}`));
    });
  });
}

export function exec(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      const result: ExecResult = { code: code ?? -1, stdout, stderr };
      if (code === 0 || options.allowFailure) return resolve(result);
      reject(
        new Error(`Comando falhou (${command} ${args.join(" ")}) [${code}]: ${stderr || stdout}`),
      );
    });
  });
}
