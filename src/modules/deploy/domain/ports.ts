import type { DeployContext } from "./DeployContext";

/**
 * Ports (interfaces) das integrações. Os steps dependem destas abstrações, não
 * das implementações concretas (DIP). Implementações ficam em `@modules/*`.
 */

/** Provedor de código-fonte (clone/checkout). */
export interface ISourceProvider {
  clone(ctx: DeployContext): Promise<void>;
  checkout(ctx: DeployContext): Promise<void>;
  cleanup(ctx: DeployContext): Promise<void>;
}

export interface ContainerRunSpec {
  image: string;
  name: string;
  network: string;
  /** Rede do proxy reverso (Traefik) para roteamento externo. */
  proxyNetwork: string;
  env: Record<string, string>;
  labels: Record<string, string>;
  command?: string;
}

/** Orquestrador de containers (Docker Engine). */
export interface IContainerOrchestrator {
  buildImage(contextDir: string, dockerfilePath: string, tag: string): Promise<void>;
  createNetwork(name: string): Promise<void>;
  runContainer(spec: ContainerRunSpec): Promise<string>; // -> containerId
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  removeNetwork(name: string): Promise<void>;
  removeImage(tag: string): Promise<void>;
  isHealthy(containerId: string): Promise<boolean>;
}

/**
 * Credenciais do Pi-hole (vindas do banco, cadastradas pelo admin).
 * Pi-hole v6 autentica com a SENHA do admin (não há mais API token).
 */
export interface PiholeConfig {
  baseUrl: string;
  password: string;
}

/** Provedor de DNS (Pi-hole). */
export interface IDnsProvider {
  register(hostname: string, ip: string, pihole: PiholeConfig): Promise<void>;
  unregister(hostname: string, ip: string, pihole: PiholeConfig): Promise<void>;
  isResolving(hostname: string, expectedIp: string): Promise<boolean>;
  /** Aguarda a propagação do registro (resolução == ip esperado). */
  waitForPropagation(hostname: string, expectedIp: string, attempts?: number, delayMs?: number): Promise<boolean>;
}
