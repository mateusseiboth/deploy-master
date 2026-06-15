import { Injectable } from "@di/Injectable";

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

export interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  webUrl: string;
}

/**
 * Cliente da API REST do GitLab. Responsabilidade única: falar com o GitLab.
 * Sem regra de negócio — apenas mapeia a resposta para tipos do domínio.
 */
@Injectable()
export class GitLabClient {
  /** Monta a base da API a partir da URL do repositório. */
  private apiBase(repositoryUrl: string): string {
    const url = new URL(repositoryUrl);
    return `${url.protocol}//${url.host}/api/v4`;
  }

  private async request<T>(
    repositoryUrl: string,
    token: string,
    path: string,
  ): Promise<T> {
    const response = await fetch(`${this.apiBase(repositoryUrl)}${path}`, {
      headers: { "PRIVATE-TOKEN": token },
    });
    if (!response.ok) {
      throw new Error(`GitLab API ${path} -> ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  /** Valida o token tentando acessar o projeto. */
  async validateAccess(repositoryUrl: string, projectId: string, token: string): Promise<boolean> {
    try {
      await this.request(repositoryUrl, token, `/projects/${encodeURIComponent(projectId)}`);
      return true;
    } catch {
      return false;
    }
  }

  async listBranches(repositoryUrl: string, projectId: string, token: string): Promise<GitLabBranch[]> {
    const raw = await this.request<Array<{ name: string; commit: { id: string } }>>(
      repositoryUrl,
      token,
      `/projects/${encodeURIComponent(projectId)}/repository/branches`,
    );
    return raw.map((b) => ({ name: b.name, commitHash: b.commit.id }));
  }

  async listCommits(
    repositoryUrl: string,
    projectId: string,
    token: string,
    branch: string,
  ): Promise<GitLabCommit[]> {
    const raw = await this.request<Array<RawCommit>>(
      repositoryUrl,
      token,
      `/projects/${encodeURIComponent(projectId)}/repository/commits?ref_name=${encodeURIComponent(branch)}`,
    );
    return raw.map(toCommit);
  }

  async getCommit(
    repositoryUrl: string,
    projectId: string,
    token: string,
    commitHash: string,
  ): Promise<GitLabCommit> {
    const raw = await this.request<RawCommit>(
      repositoryUrl,
      token,
      `/projects/${encodeURIComponent(projectId)}/repository/commits/${commitHash}`,
    );
    return toCommit(raw);
  }

  /** Pipeline mais recente associado a uma ref (branch/commit). */
  async getLatestPipeline(
    repositoryUrl: string,
    projectId: string,
    token: string,
    ref: string,
  ): Promise<GitLabPipeline | null> {
    const raw = await this.request<Array<RawPipeline>>(
      repositoryUrl,
      token,
      `/projects/${encodeURIComponent(projectId)}/pipelines?ref=${encodeURIComponent(ref)}&per_page=1`,
    );
    const first = raw[0];
    return first ? toPipeline(first) : null;
  }

  /**
   * Projetos acessíveis pelo token (para popular o seletor de projeto).
   * `baseUrl` pode ser a URL base do GitLab (token geral) — só o host é usado.
   */
  async listProjects(baseUrl: string, token: string): Promise<GitLabProjectRef[]> {
    const raw = await this.request<Array<RawProject>>(
      baseUrl,
      token,
      `/projects?membership=true&per_page=100&order_by=last_activity_at`,
    );
    return raw.map(toProjectRef);
  }
}

interface RawPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
}

interface RawProject {
  id: number;
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  web_url: string;
}

function toProjectRef(raw: RawProject): GitLabProjectRef {
  return {
    id: raw.id,
    name: raw.name,
    pathWithNamespace: raw.path_with_namespace,
    httpUrlToRepo: raw.http_url_to_repo,
    webUrl: raw.web_url,
  };
}

function toPipeline(raw: RawPipeline): GitLabPipeline {
  return { id: raw.id, status: raw.status, ref: raw.ref, sha: raw.sha, webUrl: raw.web_url };
}

interface RawCommit {
  id: string;
  short_id: string;
  author_name: string;
  message: string;
  created_at: string;
}

function toCommit(raw: RawCommit): GitLabCommit {
  return {
    id: raw.id,
    shortId: raw.short_id,
    authorName: raw.author_name,
    message: raw.message,
    createdAt: raw.created_at,
  };
}
