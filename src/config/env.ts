/**
 * Configuração centralizada e tipada das variáveis de ambiente.
 * Single source of truth para acesso a `process.env` — nenhuma outra camada
 * deve ler `process.env` diretamente (SRP + facilita testes).
 */
import { isAbsolute, resolve } from "path";
import { fileURLToPath } from "url";

// Raiz do projeto ancorada NESTE módulo (não no cwd). Garante que API e worker
// resolvam os mesmos arquivos SQLite mesmo iniciados de diretórios diferentes.
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Resolve um caminho relativo contra a raiz do projeto (absoluto = inalterado). */
function absolute(value: string): string {
  return isAbsolute(value) ? value : resolve(PROJECT_ROOT, value);
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  app: {
    port: int("PORT", 3000),
    nodeEnv: optional("NODE_ENV", "development"),
  },
  database: {
    url: optional("DATABASE_URL", ""),
    // Transação interativa do Prisma (P2028). O default de 5s é curto para
    // operações sobre um banco remoto/lento; maxWait é a espera por conexão.
    txTimeoutMs: int("DB_TX_TIMEOUT_MS", 15000),
    txMaxWaitMs: int("DB_TX_MAX_WAIT_MS", 5000),
  },
  ephemeralPg: {
    // managed=true: o sistema SOBE um container Postgres compartilhado sob demanda
    // numa porta livre aleatória (descoberta via inspect). managed=false: usa um
    // Postgres externo em host/port fixos (EPHEMERAL_PG_HOST/PORT).
    managed: optional("EPHEMERAL_PG_MANAGED", "true") === "true",
    image: optional("EPHEMERAL_PG_IMAGE", "postgres:16-alpine"),
    containerName: optional("EPHEMERAL_PG_CONTAINER", "deploy-master-ephemeral-pg"),
    // Host pelo qual app/build/worker alcançam o Postgres. Com managed, deve ser
    // um IP roteável a partir dos containers (NÃO "localhost").
    host: optional("EPHEMERAL_PG_HOST", "localhost"),
    port: int("EPHEMERAL_PG_PORT", 5432), // usado só quando managed=false
    adminUser: optional("EPHEMERAL_PG_ADMIN_USER", "postgres"),
    adminPassword: optional("EPHEMERAL_PG_ADMIN_PASSWORD", "postgres"),
  },
  queue: {
    // Absoluto: API e worker (processos distintos) precisam do MESMO arquivo.
    dbPath: absolute(optional("QUEUE_DB_PATH", "./data/queue.sqlite")),
  },
  cache: {
    driver: optional("CACHE_DRIVER", "memory"), // memory | sqlite
    dbPath: absolute(optional("CACHE_DB_PATH", "./data/cache.sqlite")),
  },
  auth: {
    accessSecret: optional("JWT_ACCESS_SECRET", "dev-access-secret"),
    refreshSecret: optional("JWT_REFRESH_SECRET", "dev-refresh-secret"),
    accessTtl: optional("JWT_ACCESS_TTL", "15m"),
    refreshTtl: optional("JWT_REFRESH_TTL", "7d"),
  },
  docker: {
    socket: optional("DOCKER_SOCKET", "/var/run/docker.sock"),
    workspaceDir: optional("WORKSPACE_DIR", "/tmp/deploy-master/workspaces"),
    traefikNetwork: optional("TRAEFIK_NETWORK", "traefik-public"),
  },
  dns: {
    // Pi-hole v6: URL raiz (sem /admin) + senha do admin (não há mais API token).
    piholeBaseUrl: optional("PIHOLE_BASE_URL", "http://localhost"),
    piholePassword: optional("PIHOLE_PASSWORD", ""),
    reverseProxyIp: optional("REVERSE_PROXY_IP", "127.0.0.1"),
  },
  gitlab: {
    // Token geral: projetos buscam metadados/repos pela API sem URL/token manuais.
    baseUrl: optional("GITLAB_BASE_URL", ""),
    apiToken: optional("GITLAB_API_TOKEN", ""),
  },
  backup: {
    // Backup automático do servidor PostgreSQL de produção (agendamento por banco).
    prodDbUrl: optional("PROD_BACKUP_DB_URL", ""),
    prodDir: optional("PROD_BACKUP_DIR", ""),
    prodEnabled: optional("PROD_BACKUP_ENABLED", "false") === "true",
  },
  proxy: {
    provider: optional("REVERSE_PROXY_PROVIDER", "traefik"),
    certificateProvider: optional("CERTIFICATE_PROVIDER", "internal-ca"),
    baseDomain: optional("BASE_DOMAIN", "qa.local"),
  },
} as const;

export { required as requireEnv };
