import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import { NotFoundError } from "@core/errors/AppError";
import { Cache } from "@core/cache/Cache";
import { ProjectDAO } from "@modules/project/ProjectDAO";
import {
  GitLabClient,
  type GitLabBranch,
  type GitLabCommit,
  type GitLabPipeline,
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
  ) {
    super();
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

  private async loadAccess(projectId: string): Promise<GitLabAccess> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError(`Projeto ${projectId} não encontrado`);
    return {
      repositoryUrl: project.repositoryUrl,
      gitlabProjectId: project.gitlabProjectId,
      gitlabToken: project.gitlabToken,
    };
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
