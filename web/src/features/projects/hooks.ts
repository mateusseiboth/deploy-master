import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import type { GitLabBranch, GitLabCommit, GitLabProjectRef, Project } from "@/lib/types";

const KEY = ["projects"];

export function useProjects() {
  return useQuery({ queryKey: KEY, queryFn: () => unwrap<Project[]>(api.get("/projects")) });
}

/** Projetos visíveis pelo token GERAL do GitLab (para o seletor de cadastro). */
export function useGitlabProjects(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "gitlab-catalog"],
    queryFn: () => unwrap<GitLabProjectRef[]>(api.get("/gitlab/projects")),
    enabled,
    staleTime: 60_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => unwrap<Project>(api.get(`/projects/${id}`)),
    enabled: !!id,
  });
}

export interface CreateProjectInput {
  name: string;
  gitlabProjectId: string;
  // Opcionais: se vazios, usa o GitLab global (token geral em Configurações).
  repositoryUrl?: string;
  gitlabToken?: string;
  dockerfilePath?: string;
  productionDbUrl?: string;
  homologationDbUrl?: string;
  databaseStrategy?: "UPLOAD_SQL" | "COPY_PRODUCTION";
  requiresDatabase?: boolean;
  databaseEnvVar?: string;
  databaseUrlTemplate?: string;
  baseDomain?: string;
  variables?: { key: string; required?: boolean; defaultValue?: string }[];
  deadline?: { defaultDays?: number; maxDays?: number; maxRenewals?: number };
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => unwrap<Project>(api.post("/projects", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Edição: todos os campos opcionais (variáveis ficam fora — endpoints próprios). */
export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "variables">> & {
  enabled?: boolean;
};

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => unwrap<Project>(api.put(`/projects/${id}`, input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Navegação GitLab (branch → commit) ──────────────────────────────────────

export function useBranches(projectId: string) {
  return useQuery({
    queryKey: [...KEY, projectId, "branches"],
    queryFn: () => unwrap<GitLabBranch[]>(api.get(`/projects/${projectId}/gitlab/branches`)),
    enabled: !!projectId,
  });
}

export function useCommits(projectId: string, branch: string) {
  return useQuery({
    queryKey: [...KEY, projectId, "commits", branch],
    queryFn: () => unwrap<GitLabCommit[]>(api.get(`/projects/${projectId}/gitlab/commits`, { params: { branch } })),
    enabled: !!projectId && !!branch,
  });
}

/** Dockerfiles do repositório (para o QA escolher qual usar no build). */
export function useDockerfiles(projectId: string, ref?: string) {
  return useQuery({
    queryKey: [...KEY, projectId, "dockerfiles", ref ?? "default"],
    queryFn: () =>
      unwrap<string[]>(api.get(`/projects/${projectId}/gitlab/dockerfiles`, { params: ref ? { ref } : {} })),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
