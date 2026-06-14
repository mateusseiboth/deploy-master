import Docker from "dockerode";
import type { Duplex, Writable } from "stream";
import { env } from "@config/env";
import { Injectable } from "@di/Injectable";
import type { ContainerRunSpec, IContainerOrchestrator } from "@modules/deploy/domain/ports";

/** Sessão de console interativo: stream duplex + ajuste de TTY. */
export interface ConsoleSession {
  stream: Duplex;
  resize: (rows: number, cols: number) => Promise<void>;
}

/**
 * Adapter de orquestração via Docker Engine API (dockerode). Implementa o port
 * `IContainerOrchestrator`. Operações idempotentes e tolerantes a "não existe"
 * para suportar retry/cleanup (CLAUDE.md: deploy idempotente).
 */
@Injectable()
export class DockerService implements IContainerOrchestrator {
  private readonly docker = new Docker({ socketPath: env.docker.socket });

  async buildImage(contextDir: string, dockerfilePath: string, tag: string): Promise<void> {
    const stream = await this.docker.buildImage(
      { context: contextDir, src: ["."] },
      { t: tag, dockerfile: dockerfilePath },
    );
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });
  }

  async createNetwork(name: string): Promise<void> {
    const existing = await this.docker.listNetworks({ filters: { name: [name] } });
    if (existing.length > 0) return;
    await this.docker.createNetwork({ Name: name, Driver: "bridge" });
  }

  async runContainer(spec: ContainerRunSpec): Promise<string> {
    await this.removeByName(spec.name); // idempotência

    const container = await this.docker.createContainer({
      Image: spec.image,
      name: spec.name,
      Cmd: spec.command ? spec.command.split(" ") : undefined,
      Labels: spec.labels,
      Env: Object.entries(spec.env).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        NetworkMode: spec.network,
        RestartPolicy: { Name: "unless-stopped" },
      },
    });

    // conecta também à rede do proxy reverso para roteamento externo
    await this.connectToProxyNetwork(container.id, spec.proxyNetwork);
    await container.start();
    return container.id;
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.safe(() => this.docker.getContainer(containerId).stop());
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.safe(() => this.docker.getContainer(containerId).remove({ force: true, v: true }));
  }

  async removeNetwork(name: string): Promise<void> {
    await this.safe(() => this.docker.getNetwork(name).remove());
  }

  async removeImage(tag: string): Promise<void> {
    await this.safe(() => this.docker.getImage(tag).remove({ force: true }));
  }

  async isHealthy(containerId: string): Promise<boolean> {
    const info = await this.safe(() => this.docker.getContainer(containerId).inspect());
    if (!info) return false;
    const health = info.State.Health?.Status;
    // sem healthcheck definido na imagem: considera saudável se running
    return health ? health === "healthy" : info.State.Running === true;
  }

  // ── Streaming: logs em tempo real e console interativo ────────────────────

  /**
   * Segue os logs do container (stdout+stderr) escrevendo as linhas demultiplexadas
   * num destino. Retorna uma função para encerrar o stream (cleanup do SSE).
   */
  async followLogs(
    containerId: string,
    sink: Writable,
    tail = 200,
  ): Promise<() => void> {
    const container = this.docker.getContainer(containerId);
    const stream = (await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail,
    })) as unknown as NodeJS.ReadableStream;

    // Demultiplexa o protocolo de stream do Docker (stdout/stderr) para o sink.
    this.docker.modem.demuxStream(stream, sink, sink);
    return () => {
      (stream as unknown as Duplex).destroy?.();
    };
  }

  /**
   * Abre um shell interativo no container (exec + hijack). Devolve o stream
   * duplex (stdin/stdout) e um `resize(rows, cols)` que ajusta o TTY do exec,
   * para o console web propagar o tamanho do terminal.
   */
  async openConsole(containerId: string, shell = "/bin/sh"): Promise<ConsoleSession> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: [shell],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });
    const stream = (await exec.start({ hijack: true, stdin: true, Tty: true })) as unknown as Duplex;
    const resize = async (rows: number, cols: number): Promise<void> => {
      if (rows > 0 && cols > 0) await exec.resize({ h: rows, w: cols });
    };
    return { stream, resize };
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  private async connectToProxyNetwork(containerId: string, proxyNet: string): Promise<void> {
    if (!proxyNet) return;
    const nets = await this.docker.listNetworks({ filters: { name: [proxyNet] } });
    if (nets.length === 0) return;
    await this.safe(() => this.docker.getNetwork(proxyNet).connect({ Container: containerId }));
  }

  private async removeByName(name: string): Promise<void> {
    const containers = await this.docker.listContainers({ all: true, filters: { name: [name] } });
    await Promise.all(
      containers.map((c) =>
        this.safe(() => this.docker.getContainer(c.Id).remove({ force: true, v: true })),
      ),
    );
  }

  /** Executa uma operação Docker ignorando erros (idempotência de cleanup). */
  private async safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch {
      return undefined;
    }
  }
}
