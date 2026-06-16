import type {
  BackupSource,
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
  appPort: number;
  buildCommand?: string | null;
  startCommand?: string | null;
  productionDbUrl?: string | null;
  homologationDbUrl?: string | null;
  /** Usuário de aplicação (role sujeito a RLS) com que o container conecta. */
  appDbUser?: string | null;
  requiresDatabase: boolean;
  databaseEnvVar: string;
  databaseUrlTemplate?: string | null;
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
  /** Servidores Pi-hole (DNS balanceado): registro vai para todos. */
  piholes: { baseUrl: string; password: string }[];
  reverseProxyIp: string;
  traefikNetwork: string;
  /** GitLab global: usado quando o projeto não tem URL/token próprios. */
  gitlabBaseUrl: string;
  gitlabApiToken: string;
}

/** Solicitação de deploy disparada pelo QA. */
export interface DeployRequest {
  environmentId: string;
  branch: string;
  commitHash: string;
  creatorUsername: string;
  /** Variáveis autorizadas com valores informados pelo QA. */
  variableOverrides: Record<string, string>;
  /** Origem do banco escolhida para este deploy (autoritativa no pipeline). */
  databaseSource: BackupSource;
  /** Caminho do backup .sql/.sql.gz (quando UPLOAD ou STORED_BACKUP). */
  backupFilePath?: string;
  /** Dockerfile escolhido para este deploy (override do padrão do projeto). */
  dockerfilePath?: string;
  /** Porta interna do container neste deploy (override do padrão do projeto). */
  appPort?: number;
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

  /** Rótulo da fase corrente do pipeline (exibição inline na lista). */
  currentPhase?: string;

  /** Callback de progresso: recebe a trilha completa a cada nova linha (SSE). */
  private readonly onProgress?: (trail: string) => void;
  /** Callback de mudança de fase: recebe o rótulo do step que vai executar. */
  private readonly onPhase?: (label: string) => void;

  /** Dockerfile efetivo deste deploy (override do ambiente ou padrão do projeto). */
  get dockerfile(): string {
    return this.request.dockerfilePath || this.project.dockerfilePath;
  }

  /** Porta interna efetiva (override do ambiente ou padrão do projeto). */
  get appPort(): number {
    return this.request.appPort || this.project.appPort;
  }

  constructor(
    project: DeployProjectConfig,
    request: DeployRequest,
    settings: DeploySettings,
    onProgress?: (trail: string) => void,
    onPhase?: (label: string) => void,
  ) {
    this.project = project;
    this.request = request;
    this.settings = settings;
    this.onProgress = onProgress;
    this.onPhase = onPhase;
    this.slug = `env-${request.commitHash.slice(0, 7)}`;
  }

  log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    this.onProgress?.(this.logs.join("\n"));
  }

  /** Marca a fase corrente (rótulo do step) e notifica via callback. */
  phase(label: string): void {
    this.currentPhase = label;
    this.onPhase?.(label);
  }
}
