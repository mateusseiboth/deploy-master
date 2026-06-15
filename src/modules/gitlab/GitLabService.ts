import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { BadRequestError, NotFoundError } from "@core/errors/AppError";
import { Cache } from "@core/cache/Cache";
import { runInTransaction } from "@core/transaction/withTransaction";
import { ProjectDAO } from "@modules/project/ProjectDAO";
import { SettingsService } from "@modules/settings/SettingsService";
import {
  GitLabClient,
  type GitLabBranch,
  type GitLabCommit,
  type GitLabPipeline,
  type GitLabProjectRef,
} from "./GitLabClient";

interface GitLabAccess {
  repositoryUrl: string;
  gitlabProjectId: string;
  gitlabToken: string;
}

/**
 * Orquestra a navegação no GitLab a partir da configuração persistida do
 * projeto, com cache para reduzir chamadas à API. Os tokens nunca saem daqui:
 * controllers passam só o `projectId`.
 */
@Injectable()
export class GitLabService extends BaseService {
  private static readonly TTL = 30_000;

  constructor(
    private readonly projects: ProjectDAO,
    private readonly gitlab: GitLabClient,
    private readonly cache: Cache,
    private readonly settings: SettingsService,
  ) {
    super();
  }

  /**
   * Lista os projetos visíveis pelo token GERAL do GitLab (settings). Usado no
   * cadastro para escolher o projeto sem digitar URL/token. Cacheado por 60s.
   */
  listGlobalProjects(): Promise<GitLabProjectRef[]> {
    return this.cached("gitlab:global:projects", async () => {
      // Lê settings em transação CURTA; a chamada HTTP roda FORA da transação.
      const s = await runInTransaction(() => this.settings.get());
      if (!s.gitlabBaseUrl || !s.gitlabApiToken) {
        throw new BadRequestError("Configure a URL e o token do GitLab nas Configurações");
      }
      return this.gitlab.listProjects(s.gitlabBaseUrl, s.gitlabApiToken);
    });
  }

  async validateAccess(projectId: string): Promise<{ valid: boolean }> {
    const access = await this.loadAccess(projectId);
    const valid = await this.gitlab.validateAccess(
      access.repositoryUrl,
      access.gitlabProjectId,
      access.gitlabToken,
    );
    return { valid };
  }

  listBranches(projectId: string): Promise<GitLabBranch[]> {
    return this.cached(`gitlab:${projectId}:branches`, async () => {
      const a = await this.loadAccess(projectId);
      return this.gitlab.listBranches(a.repositoryUrl, a.gitlabProjectId, a.gitlabToken);
    });
  }

  listCommits(projectId: string, branch: string): Promise<GitLabCommit[]> {
    return this.cached(`gitlab:${projectId}:commits:${branch}`, async () => {
      const a = await this.loadAccess(projectId);
      return this.gitlab.listCommits(a.repositoryUrl, a.gitlabProjectId, a.gitlabToken, branch);
    });
  }

  getCommit(projectId: string, hash: string): Promise<GitLabCommit> {
    return this.cached(`gitlab:${projectId}:commit:${hash}`, async () => {
      const a = await this.loadAccess(projectId);
      return this.gitlab.getCommit(a.repositoryUrl, a.gitlabProjectId, a.gitlabToken, hash);
    });
  }

  getPipeline(projectId: string, ref: string): Promise<GitLabPipeline | null> {
    return this.cached(`gitlab:${projectId}:pipeline:${ref}`, async () => {
      const a = await this.loadAccess(projectId);
      return this.gitlab.getLatestPipeline(a.repositoryUrl, a.gitlabProjectId, a.gitlabToken, ref);
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private loadAccess(projectId: string): Promise<GitLabAccess> {
    // Transação CURTA só para ler projeto + settings; o HTTP do GitLab roda fora
    // dela (evita P2028: transação expirando durante a chamada externa).
    return runInTransaction(async () => {
      const project = await this.projects.findById(projectId);
      if (!project) throw new NotFoundError(`Projeto ${projectId} não encontrado`);
      const settings = await this.settings.get();
      // Fallback para o GitLab global quando o projeto não tem URL/token próprios.
      return {
        repositoryUrl: project.repositoryUrl || settings.gitlabBaseUrl,
        gitlabProjectId: project.gitlabProjectId,
        gitlabToken: project.gitlabToken || settings.gitlabApiToken,
      };
    });
  }

  /** Memoiza no cache (TTL curto) operações de leitura idempotentes. */
  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await loader();
    this.cache.set(key, value, GitLabService.TTL);
    return value;
  }
}
