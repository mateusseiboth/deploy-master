import dayjs from "dayjs";
import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "@core/errors/AppError";
import { SqliteJobQueue } from "@core/queue/SqliteJobQueue";
import { JobType } from "@core/queue/IJobQueue";
import { AuditService } from "@modules/audit/AuditService";
import { ProjectDAO } from "@modules/project/ProjectDAO";
import {
  EnvironmentDAO,
  type EnvironmentDetailed,
} from "./EnvironmentDAO";
import type { Environment } from "@prisma-generated/client";
import { BackupSource, type EnvironmentStatus } from "@prisma-generated/enums";
import type {
  DeployProjectConfig,
  DeployRequest,
  DeploySettings,
} from "@modules/deploy/domain/DeployContext";
import { SettingsService } from "@modules/settings/SettingsService";

export interface CreateEnvironmentDTO {
  projectId: string;
  branch: string;
  commitHash: string;
  commitAuthor?: string;
  commitMessage?: string;
  commitDate?: string;
  variableOverrides?: Record<string, string>;
  backup: { source: BackupSource; filePath?: string };
}

export interface DeployInputs {
  project: DeployProjectConfig;
  request: DeployRequest;
  settings: DeploySettings;
}

/** Dados de runtime persistidos após o pipeline concluir com sucesso. */
export interface ReadyData {
  hostname: string;
  url: string;
  containerId: string;
  networkName: string;
  databaseName: string;
  imageTag: string;
}

const DEFAULT_DEADLINE = { defaultDays: 7, maxDays: 30, maxRenewals: 5 };

/**
 * Orquestra o ciclo de vida do ambiente efêmero. Concentra as regras de negócio
 * (CLAUDE.md §5/§6): validação de whitelist de variáveis, política de prazos,
 * RBAC, auditoria e enfileiramento dos jobs de deploy/cleanup.
 */
@Injectable()
export class EnvironmentService extends BaseService {
  constructor(
    private readonly dao: EnvironmentDAO,
    private readonly projects: ProjectDAO,
    private readonly audit: AuditService,
    private readonly queue: SqliteJobQueue,
    private readonly settings: SettingsService,
  ) {
    super();
  }

  // ── Ações do usuário ────────────────────────────────────────────────────

  async create(dto: CreateEnvironmentDTO): Promise<Environment> {
    const project = await this.projects.findById(dto.projectId);
    if (!project) throw new NotFoundError(`Projeto ${dto.projectId} não encontrado`);

    // Idempotência: um único ambiente ativo por (projeto, commit).
    const existing = await this.dao.findActiveByProjectCommit(project.id, dto.commitHash);
    if (existing) {
      throw new ConflictError(
        `Já existe um ambiente ativo para este commit (${existing.name})`,
        { environmentId: existing.id },
      );
    }

    const overrides = this.validateVariableOverrides(project.variables, dto.variableOverrides ?? {});
    this.requireBackup(project.databaseStrategy, dto.backup);

    const deadline = project.deadline ?? DEFAULT_DEADLINE;
    const expiresAt = dayjs().add(deadline.defaultDays, "day").toDate();
    const name = `env-${dto.commitHash.slice(0, 7)}`;

    const environment = await this.dao.create({
      name,
      project: { connect: { id: project.id } },
      creator: { connect: { id: this.requireUser().id } },
      branch: dto.branch,
      commitHash: dto.commitHash,
      commitAuthor: dto.commitAuthor,
      commitMessage: dto.commitMessage,
      commitDate: dto.commitDate ? new Date(dto.commitDate) : undefined,
      status: "PENDING",
      expiresAt,
      variableValues: {
        create: Object.entries(overrides).map(([key, value]) => ({ key, value })),
      },
      backup: {
        create: { source: dto.backup.source, filePath: dto.backup.filePath },
      },
    });

    await this.audit.record({
      action: "CREATE",
      environmentId: environment.id,
      projectId: project.id,
      commitHash: dto.commitHash,
    });

    this.queue.enqueue(JobType.DEPLOY, { environmentId: environment.id });
    return environment;
  }

  async renew(id: string, days: number): Promise<Environment> {
    const environment = await this.requireOwnedOrAdmin(id);
    const project = await this.projects.findById(environment.projectId);
    const deadline = project?.deadline ?? DEFAULT_DEADLINE;

    if (environment.renewalCount >= deadline.maxRenewals) {
      throw new UnprocessableError(`Limite de renovações atingido (${deadline.maxRenewals})`);
    }

    const base = environment.expiresAt ?? new Date();
    const newExpiry = dayjs(base).add(days, "day");
    const maxAllowed = dayjs(environment.createdAt).add(deadline.maxDays, "day");
    if (newExpiry.isAfter(maxAllowed)) {
      throw new UnprocessableError(`Renovação excede o prazo máximo de ${deadline.maxDays} dias`);
    }

    const updated = await this.dao.update(id, {
      expiresAt: newExpiry.toDate(),
      renewalCount: { increment: 1 },
      status: environment.status === "EXPIRING" ? "READY" : environment.status,
    });

    await this.audit.record({ action: "RENEW", environmentId: id, metadata: { days } });
    return updated;
  }

  async restart(id: string): Promise<void> {
    const environment = await this.requireOwnedOrAdmin(id);
    await this.dao.update(id, { status: "PENDING", failureReason: null });
    await this.audit.record({ action: "RESTART", environmentId: id });
    this.queue.enqueue(JobType.DEPLOY, { environmentId: environment.id });
  }

  async remove(id: string): Promise<void> {
    const environment = await this.requireOwnedOrAdmin(id);
    await this.dao.update(id, { status: "REMOVING" });
    await this.audit.record({ action: "DELETE", environmentId: id, commitHash: environment.commitHash });
    this.queue.enqueue(JobType.CLEANUP, { environmentId: id, reason: "manual" });
  }

  list(filter: { status?: EnvironmentStatus; projectId?: string } = {}): Promise<EnvironmentDetailed[]> {
    return this.dao.list(filter);
  }

  async getById(id: string): Promise<EnvironmentDetailed> {
    const environment = await this.dao.findById(id);
    if (!environment) throw new NotFoundError(`Ambiente ${id} não encontrado`);
    return environment;
  }

  // ── Suporte aos workers / cron (sem RBAC: chamadas do sistema) ───────────

  async buildDeployInputs(environmentId: string): Promise<DeployInputs> {
    const environment = await this.dao.findById(environmentId);
    if (!environment) throw new NotFoundError(`Ambiente ${environmentId} não encontrado`);
    const project = environment.project;

    const overrides = Object.fromEntries(environment.variableValues.map((v) => [v.key, v.value]));
    const settings = await this.settings.get();

    return {
      settings: {
        piholeBaseUrl: settings.piholeBaseUrl,
        piholeApiToken: settings.piholeApiToken,
        reverseProxyIp: settings.reverseProxyIp,
        traefikNetwork: settings.traefikNetwork,
      },
      project: {
        id: project.id,
        name: project.name,
        gitlabProjectId: project.gitlabProjectId,
        repositoryUrl: project.repositoryUrl,
        gitlabToken: project.gitlabToken,
        dockerfilePath: project.dockerfilePath,
        buildCommand: project.buildCommand,
        startCommand: project.startCommand,
        productionDbUrl: project.productionDbUrl,
        databaseStrategy: project.databaseStrategy,
        hostnameFormat: project.hostnameFormat,
        certificateProvider: project.certificateProvider,
        reverseProxy: project.reverseProxy,
        baseDomain: project.baseDomain,
      },
      request: {
        environmentId: environment.id,
        branch: environment.branch,
        commitHash: environment.commitHash,
        creatorUsername: environment.creator.name,
        variableOverrides: overrides,
        backupFilePath: environment.backup?.filePath ?? undefined,
      },
    };
  }

  /**
   * Varre ambientes próximos do vencimento (→ EXPIRING, aviso visual) e os
   * vencidos (→ EXPIRED + enfileira cleanup). Chamado pelo cron de expiração.
   */
  async processExpirations(warningDays = 2): Promise<{ expiring: number; expired: number }> {
    const now = new Date();
    const threshold = dayjs().add(warningDays, "day").toDate();

    const expiring = await this.dao.findExpiring(threshold);
    for (const environment of expiring) {
      await this.dao.update(environment.id, { status: "EXPIRING" });
    }

    const expired = await this.dao.findExpired(now);
    for (const environment of expired) {
      await this.dao.update(environment.id, { status: "EXPIRED" });
      await this.audit.record({
        action: "AUTO_EXPIRE",
        environmentId: environment.id,
        commitHash: environment.commitHash,
      });
      this.queue.enqueue(JobType.CLEANUP, { environmentId: environment.id, reason: "expired" });
    }

    return { expiring: expiring.length, expired: expired.length };
  }

  /**
   * Reserva o ambiente para deploy via CAS PENDING→PROVISIONING. Retorna false se
   * outro processo já o reservou (lock de concorrência cross-process). O worker
   * que receber false deve descartar o job (idempotência).
   */
  claimForDeploy(id: string): Promise<boolean> {
    return this.dao.casStatus(id, "PENDING", "PROVISIONING");
  }

  async markReady(id: string, data: ReadyData): Promise<void> {
    await this.dao.update(id, { status: "READY", failureReason: null, ...data });
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.dao.update(id, { status: "FAILED", failureReason: reason });
  }

  markRemoving(id: string): Promise<Environment> {
    return this.dao.update(id, { status: "REMOVING" });
  }

  async markRemoved(id: string): Promise<void> {
    await this.dao.update(id, { status: "REMOVED" });
    await this.audit.record({ action: "AUTO_EXPIRE", environmentId: id });
  }

  // ── Helpers de regra de negócio ──────────────────────────────────────────

  /** Garante que só variáveis AUTORIZADAS sejam sobrescritas; aplica defaults. */
  private validateVariableOverrides(
    authorized: Array<{ key: string; required: boolean; defaultValue: string | null }>,
    provided: Record<string, string>,
  ): Record<string, string> {
    const allowed = new Set(authorized.map((v) => v.key));
    for (const key of Object.keys(provided)) {
      if (!allowed.has(key)) {
        throw new ForbiddenError(`Variável não autorizada para sobrescrita: ${key}`);
      }
    }
    const resolved: Record<string, string> = {};
    for (const variable of authorized) {
      const value = provided[variable.key] ?? variable.defaultValue ?? undefined;
      if (value === undefined) {
        if (variable.required) {
          throw new BadRequestError(`Variável obrigatória ausente: ${variable.key}`);
        }
        continue;
      }
      resolved[variable.key] = value;
    }
    return resolved;
  }

  private requireBackup(strategy: string, backup: CreateEnvironmentDTO["backup"]): void {
    if (strategy === "UPLOAD_SQL" && backup.source === BackupSource.UPLOAD && !backup.filePath) {
      throw new BadRequestError("Arquivo de backup (.sql/.sql.gz) é obrigatório para UPLOAD_SQL");
    }
  }

  private requireUser() {
    const user = this.currentUser;
    if (!user) throw new ForbiddenError("Usuário não autenticado");
    return user;
  }

  /** RBAC: QA só age no próprio ambiente; ADMIN em qualquer um. */
  private async requireOwnedOrAdmin(id: string): Promise<EnvironmentDetailed> {
    const environment = await this.getById(id);
    const user = this.requireUser();
    if (user.role === "ADMIN") return environment;
    if (user.role === "VIEWER") throw new ForbiddenError("Visualizador não pode alterar ambientes");
    if (environment.creatorId !== user.id) {
      throw new ForbiddenError("QA só pode gerenciar ambientes próprios");
    }
    return environment;
  }
}
