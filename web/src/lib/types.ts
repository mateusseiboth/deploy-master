// Tipos espelhando os contratos da API (Prisma é a fonte da verdade no backend).

export type UserRole = "ADMIN" | "QA" | "VIEWER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export type EnvironmentStatus =
  | "PENDING"
  | "PROVISIONING"
  | "READY"
  | "FAILED"
  | "EXPIRING"
  | "EXPIRED"
  | "REMOVING"
  | "REMOVED";

export interface ProjectVariable {
  id: string;
  key: string;
  type: string;
  required: boolean;
  defaultValue?: string | null;
}

export interface ProjectDeadline {
  defaultDays: number;
  maxDays: number;
  maxRenewals: number;
}

export interface Project {
  id: string;
  name: string;
  gitlabProjectId: string;
  repositoryUrl: string;
  gitlabToken?: string;
  dockerfilePath?: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  productionDbUrl?: string | null;
  homologationDbUrl?: string | null;
  requiresDatabase?: boolean;
  databaseEnvVar?: string;
  databaseUrlTemplate?: string | null;
  databaseStrategy: "UPLOAD_SQL" | "COPY_PRODUCTION";
  hostnameFormat: string;
  baseDomain: string;
  enabled?: boolean;
  variables?: ProjectVariable[];
  deadline?: ProjectDeadline | null;
}

export interface EnvironmentService {
  id: string;
  name: string;
  url: string;
}

export interface Environment {
  id: string;
  name: string;
  projectId: string;
  project?: { id: string; name: string };
  creator?: { id: string; name: string };
  branch: string;
  commitHash: string;
  commitAuthor?: string | null;
  commitMessage?: string | null;
  status: EnvironmentStatus;
  hostname?: string | null;
  url?: string | null;
  dockerfilePath?: string | null;
  deployLog?: string | null;
  deployPhase?: string | null;
  failureReason?: string | null;
  expiresAt?: string | null;
  renewalCount: number;
  createdAt: string;
  services?: EnvironmentService[];
}

export interface GitLabBranch {
  name: string;
  commitHash: string;
}

export interface GitLabCommit {
  id: string;
  shortId: string;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface GitLabProjectRef {
  id: number;
  name: string;
  pathWithNamespace: string;
  httpUrlToRepo: string;
  webUrl: string;
}

export type QueueJobType = "deploy" | "cleanup" | "backup";

export interface QueueJob {
  id: string;
  type: QueueJobType;
  status: "pending" | "active" | "completed" | "failed";
  payload: { environmentId?: string; trigger?: string; databaseName?: string } | null;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  lockedBy?: string | null;
  runAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface QueueSnapshot {
  jobs: QueueJob[];
  stats: Record<string, number>;
  /** Último heartbeat do worker (ms epoch) e se está online (< ~15s). */
  lastHeartbeat?: number | null;
  workerOnline?: boolean;
}

export interface DashboardIndicators {
  active: number;
  expiring: number;
  expired: number;
  failed: number;
  byStatus: Record<string, number>;
  deploysByProject: { key: string; count: number }[];
  deploysByUser: { key: string; count: number }[];
}
