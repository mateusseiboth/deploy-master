import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { NotFoundError } from "@core/errors/AppError";
import { Cache } from "@core/cache/Cache";
import { ProjectDAO, type ProjectWithConfig } from "./ProjectDAO";
import type { Prisma, Project } from "@prisma-generated/client";
import type {
  CertificateProvider,
  DatabaseStrategy,
  HostnameFormat,
  ReverseProxyProvider,
} from "@prisma-generated/enums";

export interface CreateProjectDTO {
  name: string;
  gitlabProjectId: string;
  repositoryUrl?: string;
  gitlabToken?: string;
  dockerfilePath?: string;
  appPort?: number;
  buildCommand?: string;
  startCommand?: string;
  productionDbUrl?: string;
  homologationDbUrl?: string;
  appDbUser?: string;
  requiresDatabase?: boolean;
  databaseEnvVar?: string;
  databaseUrlTemplate?: string;
  databaseStrategy?: DatabaseStrategy;
  hostnameFormat?: HostnameFormat;
  certificateProvider?: CertificateProvider;
  reverseProxy?: ReverseProxyProvider;
  baseDomain?: string;
  variables?: Array<{ key: string; type?: string; required?: boolean; defaultValue?: string }>;
  deadline?: { defaultDays?: number; maxDays?: number; maxRenewals?: number };
}

/**
 * Edição de um projeto existente. Todos os campos são opcionais: o que vier
 * `undefined` é preservado (Prisma ignora `undefined` no update). Variáveis
 * continuam sendo geridas pelos endpoints próprios (`add/removeVariable`).
 */
export type UpdateProjectDTO = Partial<Omit<CreateProjectDTO, "variables">> & {
  enabled?: boolean;
};

/** Regras de negócio do cadastro de Projetos (Painel Admin). */
@Injectable()
export class ProjectService extends BaseService {
  private static readonly LIST_KEY = "projects:list";

  constructor(
    private readonly dao: ProjectDAO,
    private readonly cache: Cache,
  ) {
    super();
  }

  async create(dto: CreateProjectDTO): Promise<Project> {
    this.cache.delete(ProjectService.LIST_KEY);
    return this.dao.create({
      name: dto.name,
      gitlabProjectId: dto.gitlabProjectId,
      repositoryUrl: dto.repositoryUrl ?? "",
      gitlabToken: dto.gitlabToken ?? "",
      dockerfilePath: dto.dockerfilePath ?? "Dockerfile",
      appPort: dto.appPort && dto.appPort > 0 ? dto.appPort : 80,
      buildCommand: dto.buildCommand,
      startCommand: dto.startCommand,
      productionDbUrl: dto.productionDbUrl,
      homologationDbUrl: dto.homologationDbUrl,
      appDbUser: dto.appDbUser?.trim() || undefined,
      requiresDatabase: dto.requiresDatabase ?? true,
      databaseEnvVar: dto.databaseEnvVar?.trim() || "DATABASE_URL",
      databaseUrlTemplate: dto.databaseUrlTemplate,
      databaseStrategy: dto.databaseStrategy,
      hostnameFormat: dto.hostnameFormat,
      certificateProvider: dto.certificateProvider,
      reverseProxy: dto.reverseProxy,
      // Vazio = usa o domínio base global (SystemSettings.baseDomain) no deploy.
      baseDomain: dto.baseDomain?.trim() ?? "",
      variables: dto.variables
        ? { create: dto.variables.map((v) => ({ key: v.key, type: v.type ?? "string", required: v.required ?? false, defaultValue: v.defaultValue })) }
        : undefined,
      deadline: { create: dto.deadline ?? {} },
    });
  }

  async update(id: string, dto: UpdateProjectDTO): Promise<Project> {
    await this.getById(id); // lança NotFound se não existir
    this.cache.delete(ProjectService.LIST_KEY);

    const data: Prisma.ProjectUpdateInput = {
      name: dto.name,
      gitlabProjectId: dto.gitlabProjectId,
      repositoryUrl: dto.repositoryUrl,
      gitlabToken: dto.gitlabToken,
      dockerfilePath: dto.dockerfilePath,
      appPort: dto.appPort,
      buildCommand: dto.buildCommand,
      startCommand: dto.startCommand,
      productionDbUrl: dto.productionDbUrl,
      homologationDbUrl: dto.homologationDbUrl,
      appDbUser: dto.appDbUser,
      requiresDatabase: dto.requiresDatabase,
      databaseEnvVar: dto.databaseEnvVar?.trim() || undefined,
      databaseUrlTemplate: dto.databaseUrlTemplate,
      databaseStrategy: dto.databaseStrategy,
      hostnameFormat: dto.hostnameFormat,
      certificateProvider: dto.certificateProvider,
      reverseProxy: dto.reverseProxy,
      baseDomain: dto.baseDomain,
      enabled: dto.enabled,
    };

    if (dto.deadline) {
      data.deadline = { upsert: { create: dto.deadline, update: dto.deadline } };
    }

    return this.dao.update(id, data);
  }

  async list(): Promise<Project[]> {
    const cached = this.cache.get<Project[]>(ProjectService.LIST_KEY);
    if (cached) return cached;
    const projects = await this.dao.list();
    this.cache.set(ProjectService.LIST_KEY, projects, 15_000);
    return projects;
  }

  async getById(id: string): Promise<ProjectWithConfig> {
    const project = await this.dao.findById(id);
    if (!project) throw new NotFoundError(`Projeto ${id} não encontrado`);
    return project;
  }

  async addVariable(
    projectId: string,
    dto: { key: string; type?: string; required?: boolean; defaultValue?: string },
  ) {
    await this.getById(projectId); // garante existência
    return this.dao.addVariable(projectId, {
      key: dto.key,
      type: dto.type ?? "string",
      required: dto.required ?? false,
      defaultValue: dto.defaultValue,
    });
  }

  async removeVariable(projectId: string, key: string): Promise<void> {
    const removed = await this.dao.removeVariable(projectId, key);
    if (removed === 0) throw new NotFoundError(`Variável ${key} não encontrada no projeto`);
  }
}
