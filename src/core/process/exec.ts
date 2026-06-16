import { spawn } from "child_process";

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Não rejeita em exit code != 0; retorna o resultado para o chamador decidir. */
  allowFailure?: boolean;
  /** Recebe cada linha de stderr ao vivo (progresso de comandos longos). */
  onStderr?: (line: string) => void;
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
    // Emite cada linha de stderr ao vivo (progresso) e acumula para o erro final.
    const onChunk = (chunk: Buffer): void => {
      const text = chunk.toString();
      stderr += text;
      if (!options.onStderr) return;
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) options.onStderr(line.trim());
      }
    };
    src.stderr.on("data", onChunk);
    dst.stderr.on("data", onChunk);

    // Se o consumer encerra antes (ex.: psql falha), a escrita do producer no
    // pipe quebrado emite EPIPE. Sem estes handlers, o erro de stream é NÃO
    // TRATADO e DERRUBA o processo do worker. Ignoramos aqui: a causa real vem
    // pelo exit code + stderr nos handlers de "close".
    src.stdout.on("error", () => undefined);
    dst.stdin.on("error", () => undefined);

    src.stdout.pipe(dst.stdin);

    // IMPORTANTE: precisamos checar o exit code dos DOIS processos. Antes só o
    // consumer era verificado — se o `pg_dump` (producer) falhasse, o `psql`
    // recebia entrada vazia, terminava com 0 e o pipe "sucedia" com banco VAZIO.
    let srcCode: number | null = null;
    let dstCode: number | null = null;
    let srcDone = false;
    let dstDone = false;
    let settled = false;

    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const settle = (): void => {
      if (settled || !srcDone || !dstDone) return;
      if (srcCode !== 0) return fail(`pipe ${producer.command} falhou [${srcCode}]: ${stderr}`);
      if (dstCode !== 0) return fail(`pipe ${consumer.command} falhou [${dstCode}]: ${stderr}`);
      settled = true;
      resolve();
    };

    src.on("error", (e) => fail(`pipe ${producer.command} erro: ${e.message}`));
    dst.on("error", (e) => fail(`pipe ${consumer.command} erro: ${e.message}`));
    src.on("close", (code) => { srcCode = code; srcDone = true; settle(); });
    dst.on("close", (code) => { dstCode = code; dstDone = true; settle(); });
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
