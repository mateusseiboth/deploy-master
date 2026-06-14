import type {
  CertificateProvider,
  DatabaseStrategy,
  HostnameFormat,
  ReverseProxyProvider,
} from "@prisma-generated/enums";

/** Configuração imutável do projeto relevante para o deploy. */
export interface DeployProjectConfig {
  id: string;
  name: string;
  gitlabProjectId: string;
  repositoryUrl: string;
  gitlabToken: string;
  dockerfilePath: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  productionDbUrl?: string | null;
  databaseStrategy: DatabaseStrategy;
  hostnameFormat: HostnameFormat;
  certificateProvider: CertificateProvider;
  reverseProxy: ReverseProxyProvider;
  baseDomain: string;
}

/**
 * Configurações de infraestrutura cadastradas pelo ADMIN (banco), não env.
 * Endereços de Pi-hole e proxy reverso usados pelo pipeline.
 */
export interface DeploySettings {
  piholeBaseUrl: string;
  piholeApiToken: string;
  reverseProxyIp: string;
  traefikNetwork: string;
}

/** Solicitação de deploy disparada pelo QA. */
export interface DeployRequest {
  environmentId: string;
  branch: string;
  commitHash: string;
  creatorUsername: string;
  /** Variáveis autorizadas com valores informados pelo QA. */
  variableOverrides: Record<string, string>;
  /** Caminho do backup .sql/.sql.gz enviado (quando UPLOAD_SQL). */
  backupFilePath?: string;
}

/**
 * Estado MUTÁVEL que atravessa os steps do pipeline. Cada step lê o que precisa
 * e grava seus resultados (ex.: `imageTag`, `containerId`) para os próximos.
 * É o "produto" que o Builder monta e a Strategy de cada step transforma.
 */
export class DeployContext {
  readonly project: DeployProjectConfig;
  readonly request: DeployRequest;
  /** Endereços de Pi-hole/proxy vindos do banco (cadastro do admin). */
  readonly settings: DeploySettings;

  /** Identificador derivado do commit: `env-<hash>` (idempotência). */
  readonly slug: string;

  // Resultados preenchidos pelos steps:
  workdir?: string;
  imageTag?: string;
  networkName?: string;
  volumeName?: string;
  databaseName?: string;
  databaseUrl?: string;
  hostname?: string;
  url?: string;
  containerId?: string;
  /** Labels/configuração de roteamento produzidos pela proxy strategy. */
  routeLabels: Record<string, string> = {};
  /** Variáveis finais (overrides + injetadas) que vão para o container. */
  resolvedEnv: Record<string, string> = {};

  /** Trilha de logs para diagnóstico (FAILED expõe isso). */
  readonly logs: string[] = [];

  constructor(project: DeployProjectConfig, request: DeployRequest, settings: DeploySettings) {
    this.project = project;
    this.request = request;
    this.settings = settings;
    this.slug = `env-${request.commitHash.slice(0, 7)}`;
  }

  log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
  }
}
